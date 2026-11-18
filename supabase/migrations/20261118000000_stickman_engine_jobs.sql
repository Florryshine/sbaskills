-- Stickman Animation Engine - job queue + narration assets bucket.
-- Date: 2026-11-18
-- Pattern: cloned from whiteboard_jobs (20261113) so ops stay consistent.
-- The Next.js route validates the SceneScript and queues the job; the
-- Bun worker (local-video-renderer/stickman-worker.js) narrates, compiles
-- the timeline, renders the MP4, and fills video_url.

create table if not exists stickman_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text not null default 'story',
  -- queued | narrating | rendering | ready | failed
  status text not null default 'queued',
  stage text,
  stage_message text,
  stage_updated_at timestamptz,
  -- SceneScript JSON (see stickman-engine/src/rig/character.ts)
  script_text text not null,
  timeline jsonb,
  audio_files jsonb default '[]'::jsonb,
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

comment on table stickman_jobs is
  'Stickman Animation Engine jobs. The admin route validates a SceneScript and queues it; local-video-renderer/stickman-worker.js narrates (free edge-tts via lib/podcastTTS), compiles the deterministic timeline and renders through Remotion.';

alter table stickman_jobs enable row level security;

drop policy if exists "Admins can read stickman jobs" on stickman_jobs;
create policy "Admins can read stickman jobs"
  on stickman_jobs for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can insert stickman jobs" on stickman_jobs;
create policy "Admins can insert stickman jobs"
  on stickman_jobs for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update stickman jobs" on stickman_jobs;
create policy "Admins can update stickman jobs"
  on stickman_jobs for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Narration audio + intermediate assets (public so the admin preview can stream).
insert into storage.buckets (id, name, public)
values ('stickman-assets', 'stickman-assets', true)
on conflict (id) do nothing;

-- Queue index: workers only poll actionable jobs.
drop index if exists public.idx_stickman_jobs_render_queue;
create index idx_stickman_jobs_render_queue
  on public.stickman_jobs (created_at)
  where status in ('queued', 'narrating', 'rendering');

-- Atomic claim with lease takeover (SKIP LOCKED + stale heartbeat check).
create or replace function public.claim_stickman_job(p_worker_id text)
returns setof public.stickman_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
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
        when job.timeline is not null and coalesce(job.audio_files, '[]'::jsonb) <> '[]'::jsonb then 'rendering'
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

-- Heartbeat keeps the lease alive while the worker renders.
create or replace function public.stickman_heartbeat(p_job_id uuid, p_claim_token uuid, p_stage text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stickman_jobs
  set heartbeat_at = now(),
      stage = coalesce(p_stage, stage),
      stage_updated_at = case when p_stage is not null then now() else stage_updated_at end,
      updated_at = now()
  where id = p_job_id and claim_token = p_claim_token;
  return found;
end;
$$;

revoke all on function public.stickman_heartbeat(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.stickman_heartbeat(uuid, uuid, text) to service_role;
