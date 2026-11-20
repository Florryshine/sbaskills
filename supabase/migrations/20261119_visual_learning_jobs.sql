-- Visual Learning Engine - job queue + assets bucket.
-- Date: 2026-11-19
-- Pattern: cloned from stickman_jobs (20261118) / whiteboard_jobs (20261113)
-- so ops stay consistent across all three engines. The admin route queues a
-- job (topic + spec, or a pasted script); the Bun worker
-- (local-video-renderer/visual-learning-worker.js) plans the script, prepares
-- narration/illustrations/music, compiles the deterministic timeline, renders
-- through Remotion and saves via the content_assets contract.

create table if not exists visual_learning_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null,
  -- queued | scripting | imagery | narrating | timeline | rendering | saving | ready | failed
  status text not null default 'queued',
  stage text,
  stage_message text,
  stage_updated_at timestamptz,
  -- Job spec (VLJobSpec from visual-learning-engine/src/types.ts)
  spec jsonb not null default '{}'::jsonb,
  -- Optional caller-provided episode script; when null the worker plans it
  script jsonb,
  -- Artifacts saved by the worker so jobs resume at the failed stage
  image_manifest jsonb,
  narration_manifest jsonb,
  timeline jsonb,
  script_provider text,
  used_fallback boolean default false,
  warnings jsonb default '[]'::jsonb,
  video_url text,
  storage_path text,
  duration_seconds numeric,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  knowledge_asset_id uuid references public.knowledge_assets (id) on delete set null,
  content_asset_id uuid references public.content_assets (id) on delete set null,
  media_file_id uuid references public.media_files (id) on delete set null,
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table visual_learning_jobs is
  'Visual Learning Engine jobs (topic -> script -> narration -> illustrations -> music -> MP4). 100% free toolchain: LLM fallback chain or deterministic architect, edge-tts/proxy TTS, pollinations/pexels/pixabay/wikimedia/openverse imagery, procedural music, Remotion render.';

alter table visual_learning_jobs enable row level security;

drop policy if exists "Admins can read visual learning jobs" on visual_learning_jobs;
create policy "Admins can read visual learning jobs"
  on visual_learning_jobs for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can insert visual learning jobs" on visual_learning_jobs;
create policy "Admins can insert visual learning jobs"
  on visual_learning_jobs for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update visual learning jobs" on visual_learning_jobs;
create policy "Admins can update visual learning jobs"
  on visual_learning_jobs for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Public bucket: script/timeline artifacts + preview assets for the studio.
insert into storage.buckets (id, name, public)
values ('visual-learning-assets', 'visual-learning-assets', true)
on conflict (id) do nothing;

-- Queue index: workers only poll actionable jobs.
drop index if exists public.idx_visual_learning_jobs_render_queue;
create index idx_visual_learning_jobs_render_queue
  on public.visual_learning_jobs (created_at)
  where status in ('queued', 'scripting', 'imagery', 'narrating', 'timeline', 'rendering', 'saving');

-- Atomic claim with lease takeover (SKIP LOCKED + stale heartbeat check).
create or replace function public.claim_visual_learning_job(p_worker_id text)
returns setof public.visual_learning_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.visual_learning_jobs
    where status in ('queued', 'scripting', 'imagery', 'narrating', 'timeline', 'rendering', 'saving')
      and (
        claim_token is null
        or heartbeat_at is null
        or heartbeat_at < now() - interval '8 minutes'
      )
      and attempt_count < 3
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.visual_learning_jobs as job
  set status = 'scripting',
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'visual-learning-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

revoke all on function public.claim_visual_learning_job(text) from public, anon, authenticated;
grant execute on function public.claim_visual_learning_job(text) to service_role;

-- Heartbeat keeps the lease alive while the worker renders.
create or replace function public.visual_learning_heartbeat(p_job_id uuid, p_claim_token uuid, p_stage text default null, p_message text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.visual_learning_jobs
  set heartbeat_at = now(),
      stage = coalesce(p_stage, stage),
      stage_message = coalesce(p_message, stage_message),
      stage_updated_at = case when p_stage is not null then now() else stage_updated_at end,
      updated_at = now()
  where id = p_job_id and claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.visual_learning_heartbeat(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.visual_learning_heartbeat(uuid, uuid, text, text) to service_role;

-- Worker liveness beacon (admin UI: "no worker online" vs "worker busy").
create table if not exists visual_learning_workers (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid,
  info jsonb default '{}'::jsonb
);

alter table visual_learning_workers enable row level security;

drop policy if exists "Admins can read visual learning workers" on visual_learning_workers;
create policy "Admins can read visual learning workers"
  on visual_learning_workers for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Dispatch diagnostics (GitHub Actions trigger attempts, whiteboard pattern).
create table if not exists visual_learning_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.visual_learning_jobs (id) on delete cascade,
  attempt integer not null,
  status text not null,
  detail jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table visual_learning_dispatch_attempts enable row level security;

drop policy if exists "Admins can read visual learning dispatch attempts" on visual_learning_dispatch_attempts;
create policy "Admins can read visual learning dispatch attempts"
  on visual_learning_dispatch_attempts for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
