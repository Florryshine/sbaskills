-- Whiteboard Studio: automatic GitHub Actions renderer dispatch.
-- Requires a fine-grained GitHub token stored in Supabase Vault as github_dispatch_token.
-- Token permission: Contents: read/write on Florryshine/sbaskills (repository_dispatch API).
-- Safe to re-run; existing jobs are preserved.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.whiteboard_dispatch_attempts (
  id bigint generated always as identity primary key,
  request_id bigint,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  error_message text
);

alter table public.whiteboard_dispatch_attempts enable row level security;
revoke all on public.whiteboard_dispatch_attempts from public, anon, authenticated;
grant all on public.whiteboard_dispatch_attempts to service_role;

create or replace function public.whiteboard_dispatch_renderer(p_source text default 'job-created')
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
    insert into public.whiteboard_dispatch_attempts(source, error_message)
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
      'User-Agent', 'SBA-Whiteboard-Dispatcher'
    ),
    body := jsonb_build_object(
      'event_type', 'whiteboard-job',
      'client_payload', jsonb_build_object('source', coalesce(p_source, 'unknown'))
    ),
    timeout_milliseconds := 5000
  );

  insert into public.whiteboard_dispatch_attempts(source, request_id)
  values (coalesce(p_source, 'unknown'), v_request_id);

  return v_request_id;
exception when others then
  insert into public.whiteboard_dispatch_attempts(source, error_message)
  values (coalesce(p_source, 'unknown'), left(sqlerrm, 1000));
  return null;
end;
$$;

revoke all on function public.whiteboard_dispatch_renderer(text) from public, anon, authenticated;
grant execute on function public.whiteboard_dispatch_renderer(text) to service_role;

create or replace function public.whiteboard_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status in ('narrating', 'rendering') and coalesce(new.stage, 'queued') = 'queued' then
      perform public.whiteboard_dispatch_renderer('job-created');
    end if;
  elsif new.status in ('narrating', 'rendering')
    and new.stage = 'queued'
    and (old.stage is distinct from new.stage or old.status is distinct from new.status) then
    perform public.whiteboard_dispatch_renderer('job-requeued');
  end if;
  return new;
end;
$$;

drop trigger if exists whiteboard_jobs_auto_dispatch on public.whiteboard_jobs;
create trigger whiteboard_jobs_auto_dispatch
after insert or update of status, stage on public.whiteboard_jobs
for each row execute function public.whiteboard_jobs_dispatch_trigger();

create or replace function public.whiteboard_reconcile_dispatches()
returns integer
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.whiteboard_dispatch_attempts a
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

revoke all on function public.whiteboard_reconcile_dispatches() from public, anon, authenticated;
grant execute on function public.whiteboard_reconcile_dispatches() to service_role;

create or replace function public.whiteboard_sweep_renderer()
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
  perform public.whiteboard_reconcile_dispatches();

  select exists (
    select 1
    from public.whiteboard_jobs
    where status in ('narrating', 'rendering')
      and (
        coalesce(stage, 'queued') = 'queued'
        or heartbeat_at is null
        or heartbeat_at < now() - interval '5 minutes'
      )
  ) into v_waiting;

  if not v_waiting then return false; end if;

  select exists (
    select 1 from public.whiteboard_workers
    where last_seen_at > now() - interval '90 seconds'
  ) into v_worker_online;

  if v_worker_online then return false; end if;

  select exists (
    select 1 from public.whiteboard_dispatch_attempts
    where created_at > now() - interval '3 minutes'
  ) into v_recent_dispatch;

  if v_recent_dispatch then return false; end if;

  perform public.whiteboard_dispatch_renderer('minute-sweeper');
  return true;
end;
$$;

revoke all on function public.whiteboard_sweep_renderer() from public, anon, authenticated;
grant execute on function public.whiteboard_sweep_renderer() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'whiteboard-renderer-sweeper'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'whiteboard-renderer-sweeper',
    '* * * * *',
    'select public.whiteboard_sweep_renderer();'
  );
end;
$$;

-- Kick any jobs already waiting when this migration is installed.
select public.whiteboard_sweep_renderer();
