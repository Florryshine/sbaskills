-- Whiteboard Engine v3 — reliability hardening.
-- Apply after 20261113_whiteboard_engine_jobs.sql. Safe to re-run after that base table exists.

alter table public.whiteboard_jobs
  add column if not exists knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  add column if not exists content_asset_id uuid references public.content_assets(id) on delete set null,
  add column if not exists media_file_id uuid references public.media_files(id) on delete set null,
  add column if not exists claim_token uuid,
  add column if not exists worker_id text,
  add column if not exists claimed_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists attempt_count integer not null default 0;

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
