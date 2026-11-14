-- Whiteboard Engine v3 — job queue + narration assets bucket.
-- Date: 2026-11-13

create table if not exists whiteboard_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'general',
  -- queued | narrating | rendering | ready | failed
  status text not null default 'queued',
  script_text text not null,
  timeline jsonb,
  audio_files jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  video_url text,
  storage_path text,
  duration_seconds numeric,
  error_message text,
  created_by uuid references auth.users (id) on delete set null,
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  media_file_id uuid references public.media_files(id) on delete set null,
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table whiteboard_jobs is
  'Whiteboard Engine v3 jobs. The Next.js route validates and queues; local-video-renderer/whiteboard-worker.js narrates, builds the timeline, renders the MP4, and fills video_url.';

alter table whiteboard_jobs enable row level security;

-- Admins manage their own jobs; jobs are otherwise private because the
-- finished MP4 goes through the standard lesson-videos/media_files flow.
drop policy if exists "Admins can read whiteboard jobs" on whiteboard_jobs;
create policy "Admins can read whiteboard jobs"
  on whiteboard_jobs for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can insert whiteboard jobs" on whiteboard_jobs;
create policy "Admins can insert whiteboard jobs"
  on whiteboard_jobs for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update whiteboard jobs" on whiteboard_jobs;
create policy "Admins can update whiteboard jobs"
  on whiteboard_jobs for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Narration audio + any intermediate assets live here; the bucket is public
-- so the @remotion/player preview can stream the per-scene audio directly.
insert into storage.buckets (id, name, public)
values ('whiteboard-assets', 'whiteboard-assets', true)
on conflict (id) do nothing;


-- A worker must claim narration/render jobs atomically. SKIP LOCKED prevents
-- two worker processes from processing the same job concurrently.
drop index if exists public.idx_whiteboard_jobs_render_queue;
create index idx_whiteboard_jobs_render_queue
  on public.whiteboard_jobs (created_at)
  where status in ('narrating', 'rendering');

create or replace function public.claim_whiteboard_job(p_worker_id text)
returns setof public.whiteboard_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidate as (
    select id
    from public.whiteboard_jobs
    where status in ('narrating', 'rendering')
      and (
        claim_token is null
        or heartbeat_at is null
        or heartbeat_at < now() - interval '5 minutes'
      )
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.whiteboard_jobs as job
  set status = case
        when job.timeline is not null and coalesce(job.audio_files, '[]'::jsonb) <> '[]'::jsonb then 'rendering'
        else 'narrating'
      end,
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'whiteboard-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

revoke all on function public.claim_whiteboard_job(text) from public, anon, authenticated;
grant execute on function public.claim_whiteboard_job(text) to service_role;
