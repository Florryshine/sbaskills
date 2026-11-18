-- Stickman Animation Engine — reliability, observability, script library.
-- Apply after 20261118000000_stickman_engine_jobs.sql. Safe to re-run.
--
-- Mirrors the Whiteboard engine's hardening (20261114 reliability,
-- 20261115 observability, 20261116 auto-dispatch) so ops stay consistent:
--   * stickman_jobs gains subject/auto_publish columns
--   * stickman_workers liveness table (admin UI can tell "offline" from "busy")
--   * bounded retries: stale lease + 3 attempts => failed, not reclaimed forever
--   * automatic GitHub Actions dispatch (event_type "stickman-job") + minute sweeper
--   * stickman_scripts: the saved-script library behind Save/Load/Reuse

alter table public.stickman_jobs
  add column if not exists subject text not null default 'general',
  add column if not exists auto_publish boolean not null default true,
  add column if not exists stage text not null default 'queued',
  add column if not exists stage_message text,
  add column if not exists stage_updated_at timestamptz default now();

-- Worker liveness. Workers upsert this on every poll, so "no worker online"
-- is detectable even when no job is running.
create table if not exists public.stickman_workers (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid,
  info jsonb not null default '{}'::jsonb
);
alter table public.stickman_workers enable row level security; -- service role only (no policies)

-- Saved SceneScripts (the studio's script library).
create table if not exists public.stickman_scripts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'general',
  topic text,
  script_text text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table stickman_scripts enable row level security;

drop policy if exists "Admins can read stickman scripts" on stickman_scripts;
create policy "Admins can read stickman scripts"
  on stickman_scripts for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can write stickman scripts" on stickman_scripts;
create policy "Admins can write stickman scripts"
  on stickman_scripts for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update stickman scripts" on stickman_scripts;
create policy "Admins can update stickman scripts"
  on stickman_scripts for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can delete stickman scripts" on stickman_scripts;
create policy "Admins can delete stickman scripts"
  on stickman_scripts for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Bounded retries: a job whose lease expired MAX times (worker crashed / OOM
-- mid-job) is failed with a clear message instead of being reclaimed forever.
create or replace function public.claim_stickman_job(p_worker_id text)
returns setof public.stickman_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_attempts constant integer := 3;
begin
  -- Give up on poison jobs first (stale lease + attempts exhausted).
  update public.stickman_jobs
  set status = 'failed',
      stage = 'failed',
      stage_message = 'Worker stopped responding repeatedly',
      error_message = 'Worker stopped responding after ' || attempt_count || ' attempts (crash, out-of-memory or restart during processing). Use Retry to run it again.',
      claim_token = null, worker_id = null, claimed_at = null, heartbeat_at = null,
      stage_updated_at = now(), updated_at = now()
  where status in ('queued', 'narrating', 'rendering')
    and claim_token is not null
    and heartbeat_at < now() - interval '5 minutes'
    and attempt_count >= v_max_attempts;

  return query
  with candidate as (
    select id
    from public.stickman_jobs
    where status in ('queued', 'narrating', 'rendering')
      and (
        claim_token is null
        or heartbeat_at is null
        or heartbeat_at < now() - interval '5 minutes'
      )
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.stickman_jobs as job
  set status = case
        when coalesce(job.script_text, '') = '' then 'queued'
        when job.timeline is not null
          and coalesce(nullif(job.audio_files, 'null'::jsonb), '[]'::jsonb) <> '[]'::jsonb then 'rendering'
        else 'narrating'
      end,
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'stickman-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

revoke all on function public.claim_stickman_job(text) from public, anon, authenticated;
grant execute on function public.claim_stickman_job(text) to service_role;

-- ---------------- automatic GitHub Actions renderer dispatch ----------------
-- Requires a fine-grained GitHub token stored in Supabase Vault as
-- github_dispatch_token (same secret the Whiteboard dispatcher uses).
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.stickman_dispatch_attempts (
  id bigint generated always as identity primary key,
  request_id bigint,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  error_message text
);

alter table public.stickman_dispatch_attempts enable row level security;
revoke all on public.stickman_dispatch_attempts from public, anon, authenticated;
grant all on public.stickman_dispatch_attempts to service_role;

create or replace function public.stickman_dispatch_renderer(p_source text default 'job-created')
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'github_dispatch_token'
  limit 1;

  if coalesce(v_token, '') = '' then
    insert into public.stickman_dispatch_attempts(source, error_message)
    values (coalesce(p_source, 'unknown'), 'missing_token: add github_dispatch_token to Supabase Vault');
    return null;
  end if;

  v_request_id := net.http_post(
    url := 'https://api.github.com/repos/Florryshine/sbaskills/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'SBA-Stickman-Dispatcher'
    ),
    body := jsonb_build_object(
      'event_type', 'stickman-job',
      'client_payload', jsonb_build_object('source', coalesce(p_source, 'unknown'))
    ),
    timeout_milliseconds := 5000
  );

  insert into public.stickman_dispatch_attempts(source, request_id)
  values (coalesce(p_source, 'unknown'), v_request_id);

  return v_request_id;
exception when others then
  insert into public.stickman_dispatch_attempts(source, error_message)
  values (coalesce(p_source, 'unknown'), left(sqlerrm, 1000));
  return null;
end;
$$;

revoke all on function public.stickman_dispatch_renderer(text) from public, anon, authenticated;
grant execute on function public.stickman_dispatch_renderer(text) to service_role;

create or replace function public.stickman_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('queued', 'narrating', 'rendering') and coalesce(new.stage, 'queued') = 'queued' then
      perform public.stickman_dispatch_renderer('job-created');
    end if;
  elsif new.status in ('queued', 'narrating', 'rendering')
    and new.stage = 'queued'
    and (old.stage is distinct from new.stage or old.status is distinct from new.status) then
    perform public.stickman_dispatch_renderer('job-requeued');
  end if;
  return new;
end;
$$;

drop trigger if exists stickman_jobs_auto_dispatch on public.stickman_jobs;
create trigger stickman_jobs_auto_dispatch
after insert or update of status, stage on public.stickman_jobs
for each row execute function public.stickman_jobs_dispatch_trigger();

create or replace function public.stickman_reconcile_dispatches()
returns integer
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.stickman_dispatch_attempts a
  set http_status = r.status_code,
      error_message = coalesce(r.error_msg, case when r.status_code >= 400 then left(r.content, 1000) else null end),
      completed_at = now()
  from net._http_response r
  where a.request_id = r.id
    and a.completed_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.stickman_reconcile_dispatches() from public, anon, authenticated;
grant execute on function public.stickman_reconcile_dispatches() to service_role;

create or replace function public.stickman_sweep_renderer()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_waiting boolean;
  v_worker_online boolean;
  v_recent_dispatch boolean;
begin
  perform public.stickman_reconcile_dispatches();

  select exists (
    select 1
    from public.stickman_jobs
    where status in ('queued', 'narrating', 'rendering')
      and (
        coalesce(stage, 'queued') = 'queued'
        or heartbeat_at is null
        or heartbeat_at < now() - interval '5 minutes'
      )
  ) into v_waiting;

  if not v_waiting then return false; end if;

  select exists (
    select 1 from public.stickman_workers
    where last_seen_at > now() - interval '90 seconds'
  ) into v_worker_online;

  if v_worker_online then return false; end if;

  select exists (
    select 1 from public.stickman_dispatch_attempts
    where created_at > now() - interval '3 minutes'
  ) into v_recent_dispatch;

  if v_recent_dispatch then return false; end if;

  perform public.stickman_dispatch_renderer('minute-sweeper');
  return true;
end;
$$;

revoke all on function public.stickman_sweep_renderer() from public, anon, authenticated;
grant execute on function public.stickman_sweep_renderer() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'stickman-renderer-sweeper'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'stickman-renderer-sweeper',
    '* * * * *',
    'select public.stickman_sweep_renderer();'
  );
end;
$$;

-- Kick any jobs already waiting when this migration is installed.
select public.stickman_sweep_renderer();
