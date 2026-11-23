-- Dynamic Motion Graphics Engine ("Motion Graphics Studio").
-- Additive foundation only, following the same conventions as the Cartoon
-- Animation Studio foundation (20261120080000) and the Whiteboard auto
-- dispatch migration (20261116020000). Safe to re-run; no existing table or
-- engine is modified.

-- ---------------------------------------------------------------------------
-- Projects: one row per motion graphics video. Holds the script, the generated
-- creative direction, the scene plan and the finished video.
create table if not exists public.motion_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Motion Graphics Video',
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  custom_topic text,
  script_text text,
  source text not null default 'script' check (source in ('script','topic','asset')),
  orientation text not null default '9:16' check (orientation in ('9:16','16:9','1:1')),
  fps integer not null default 30 check (fps between 24 and 60),
  visual_intensity text not null default 'balanced' check (visual_intensity in ('calm','balanced','bold')),
  music_style text,                -- null = engine chooses from the direction
  narration_mode text not null default 'tts' check (narration_mode in ('tts','uploaded','silent')),
  narration_url text,              -- optional uploaded full-length narration track
  use_sfx boolean not null default true,
  subtitles boolean not null default true,
  brand_line text not null default 'Shiney Brain Academy',
  direction jsonb,                 -- creative direction (palette, type, motion, sound kits)
  scenes jsonb,                    -- scene plan (per-scene composition spec)
  narration jsonb not null default '{}'::jsonb,
  audio_meta jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','queued','directing','direction_ready','rendering','ready','failed','cancelled')),
  stage text not null default 'idle',
  stage_message text,
  progress integer not null default 0 check (progress between 0 and 100),
  video_url text,
  video_storage_path text,
  video_size_bytes bigint,
  duration_seconds numeric,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  media_file_id uuid references public.media_files(id) on delete set null,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_motion_projects_owner_created
  on public.motion_projects(created_by, created_at desc);
create index if not exists idx_motion_projects_status_updated
  on public.motion_projects(status, updated_at desc);

-- ---------------------------------------------------------------------------
-- Jobs: 'direction' (analyse script -> creative direction -> scene plan) and
-- 'render' (narration -> music/sfx -> Remotion render -> storage).
create table if not exists public.motion_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.motion_projects(id) on delete cascade,
  job_type text not null check (job_type in ('direction','render')),
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed','cancelled')),
  stage text not null default 'queued',
  stage_message text,
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_motion_jobs_queue
  on public.motion_jobs(created_at)
  where status in ('queued','processing');
create index if not exists idx_motion_jobs_project
  on public.motion_jobs(project_id, created_at desc);

create table if not exists public.motion_workers (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid references public.motion_jobs(id) on delete set null,
  info jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Timestamps are kept consistent with the rest of the production schema.
drop trigger if exists trg_motion_projects_updated on public.motion_projects;
create trigger trg_motion_projects_updated before update on public.motion_projects
  for each row execute function public.set_updated_at();
drop trigger if exists trg_motion_jobs_updated on public.motion_jobs;
create trigger trg_motion_jobs_updated before update on public.motion_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: admins use the studio through authenticated API routes.
alter table public.motion_projects enable row level security;
alter table public.motion_jobs enable row level security;
alter table public.motion_workers enable row level security;

drop policy if exists "Admins can manage motion projects" on public.motion_projects;
create policy "Admins can manage motion projects" on public.motion_projects
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can read motion jobs" on public.motion_jobs;
create policy "Admins can read motion jobs" on public.motion_jobs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can create motion jobs" on public.motion_jobs;
create policy "Admins can create motion jobs" on public.motion_jobs
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can update motion jobs" on public.motion_jobs;
create policy "Admins can update motion jobs" on public.motion_jobs
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Worker and service-role access only for liveness and queue processing.
revoke all on public.motion_workers from public, anon, authenticated;
grant all on public.motion_workers to service_role;
grant all on public.motion_projects, public.motion_jobs to service_role;

-- Narration, music and SFX artifacts are served to Remotion via public URLs.
insert into storage.buckets (id, name, public)
values ('motion-assets', 'motion-assets', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Atomic job claim with bounded retries and stale-lease recovery
-- (same contract as claim_cartoon_job).
create or replace function public.claim_motion_job(p_worker_id text)
returns setof public.motion_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.motion_jobs
  set status = 'failed',
      stage = 'failed',
      stage_message = 'Worker stopped responding repeatedly',
      error_message = 'Motion Graphics worker stopped responding after the maximum number of attempts.',
      claim_token = null, worker_id = null, claimed_at = null, heartbeat_at = null,
      updated_at = now()
  where status = 'processing'
    and (heartbeat_at is null or heartbeat_at < now() - interval '5 minutes')
    and attempt_count >= max_attempts;

  update public.motion_jobs
  set status = 'failed',
      stage = 'failed',
      stage_message = 'Job reached the maximum number of attempts',
      error_message = 'Motion Graphics job reached its maximum retry count before a worker could claim it.',
      updated_at = now()
  where status = 'queued'
    and attempt_count >= max_attempts;

  return query
  with candidate as (
    select id
    from public.motion_jobs
    where (status = 'queued' and attempt_count < max_attempts)
       or (status = 'processing'
           and (claim_token is null or heartbeat_at is null
                or heartbeat_at < now() - interval '5 minutes')
           and attempt_count < max_attempts)
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.motion_jobs j
  set status = 'processing',
      stage = case when j.stage in ('queued','failed') then 'preparing' else j.stage end,
      stage_message = 'Claimed by Motion Graphics worker',
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'motion-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_motion_job(text) from public, anon, authenticated;
grant execute on function public.claim_motion_job(text) to service_role;

create or replace function public.motion_job_heartbeat(
  p_job_id uuid,
  p_claim_token uuid,
  p_stage text default null,
  p_progress integer default null,
  p_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.motion_jobs
  set stage = coalesce(p_stage, stage),
      progress = coalesce(greatest(0, least(100, p_progress)), progress),
      stage_message = coalesce(p_message, stage_message),
      heartbeat_at = now(),
      updated_at = now()
  where id = p_job_id
    and claim_token = p_claim_token
    and status = 'processing';
  return found;
end;
$$;

revoke all on function public.motion_job_heartbeat(uuid, uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.motion_job_heartbeat(uuid, uuid, text, integer, text) to service_role;

-- ---------------------------------------------------------------------------
-- Automatic GitHub Actions renderer dispatch (same shape as the whiteboard
-- engine). Requires github_dispatch_token in Supabase Vault.
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.motion_dispatch_attempts (
  id bigint generated always as identity primary key,
  request_id bigint,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  error_message text
);

alter table public.motion_dispatch_attempts enable row level security;
revoke all on public.motion_dispatch_attempts from public, anon, authenticated;
grant all on public.motion_dispatch_attempts to service_role;

create or replace function public.motion_dispatch_renderer(p_source text default 'job-created')
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
    insert into public.motion_dispatch_attempts(source, error_message)
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
      'User-Agent', 'SBA-Motion-Dispatcher'
    ),
    body := jsonb_build_object(
      'event_type', 'motion-graphics-render',
      'client_payload', jsonb_build_object('source', coalesce(p_source, 'unknown'))
    ),
    timeout_milliseconds := 5000
  );

  insert into public.motion_dispatch_attempts(source, request_id)
  values (coalesce(p_source, 'unknown'), v_request_id);

  return v_request_id;
exception when others then
  insert into public.motion_dispatch_attempts(source, error_message)
  values (coalesce(p_source, 'unknown'), left(sqlerrm, 1000));
  return null;
end;
$$;

revoke all on function public.motion_dispatch_renderer(text) from public, anon, authenticated;
grant execute on function public.motion_dispatch_renderer(text) to service_role;

create or replace function public.motion_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.motion_dispatch_renderer('job-created');
  elsif new.status = 'queued' and old.status is distinct from new.status then
    perform public.motion_dispatch_renderer('job-requeued');
  end if;
  return new;
end;
$$;

drop trigger if exists motion_jobs_auto_dispatch on public.motion_jobs;
create trigger motion_jobs_auto_dispatch
after insert or update of status on public.motion_jobs
for each row execute function public.motion_jobs_dispatch_trigger();

create or replace function public.motion_reconcile_dispatches()
returns integer
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.motion_dispatch_attempts a
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

revoke all on function public.motion_reconcile_dispatches() from public, anon, authenticated;
grant execute on function public.motion_reconcile_dispatches() to service_role;

create or replace function public.motion_sweep_renderer()
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
  perform public.motion_reconcile_dispatches();

  select exists (
    select 1
    from public.motion_jobs
    where status in ('queued', 'processing')
      and (
        status = 'queued'
        or heartbeat_at is null
        or heartbeat_at < now() - interval '5 minutes'
      )
  ) into v_waiting;

  if not v_waiting then return false; end if;

  select exists (
    select 1 from public.motion_workers
    where last_seen_at > now() - interval '90 seconds'
  ) into v_worker_online;

  if v_worker_online then return false; end if;

  select exists (
    select 1 from public.motion_dispatch_attempts
    where created_at > now() - interval '3 minutes'
  ) into v_recent_dispatch;

  if v_recent_dispatch then return false; end if;

  perform public.motion_dispatch_renderer('minute-sweeper');
  return true;
end;
$$;

revoke all on function public.motion_sweep_renderer() from public, anon, authenticated;
grant execute on function public.motion_sweep_renderer() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in select jobid from cron.job where jobname = 'motion-graphics-renderer-sweeper'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'motion-graphics-renderer-sweeper',
    '* * * * *',
    'select public.motion_sweep_renderer();'
  );
end;
$$;

-- Kick any jobs already waiting when this migration is installed.
select public.motion_sweep_renderer();
