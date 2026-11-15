-- Whiteboard Engine v3 — observable progress, worker liveness, bounded retries.
-- Apply after 20261114_whiteboard_engine_reliability.sql. Safe to re-run.
--
-- Why: a job inserted as status='narrating' looked "in progress" even when no
-- worker existed. `stage` is only ever moved off 'queued' by claim_whiteboard_job()
-- (i.e. when a worker really owns the job), and whiteboard_workers lets the
-- admin UI tell "waiting for a worker" apart from "worker is busy".

alter table public.whiteboard_jobs
  add column if not exists topic text, -- AI jobs store only the topic; the worker writes the script
  add column if not exists stage text not null default 'queued',
  add column if not exists stage_message text,
  add column if not exists stage_updated_at timestamptz not null default now();

-- Backfill: finished/failed rows get a terminal stage; rows already claimed keep a truthful one.
update public.whiteboard_jobs set stage = 'completed' where status = 'ready' and stage = 'queued';
update public.whiteboard_jobs set stage = 'failed'    where status = 'failed' and stage = 'queued';
update public.whiteboard_jobs set stage = 'rendering' where status = 'rendering' and claim_token is not null and stage = 'queued';
update public.whiteboard_jobs set stage = 'narrating' where status = 'narrating' and claim_token is not null and stage = 'queued';

-- Worker liveness. Workers upsert this on every poll, so "no worker online" is detectable
-- even when no job is running.
create table if not exists public.whiteboard_workers (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid,
  info jsonb not null default '{}'::jsonb
);
alter table public.whiteboard_workers enable row level security; -- service role only (no policies)

-- Bounded retries: a job whose lease expired MAX times (worker crashed / OOM mid-job) is failed
-- with a clear message instead of being reclaimed forever.
create or replace function public.claim_whiteboard_job(p_worker_id text)
returns setof public.whiteboard_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max_attempts constant integer := 3;
begin
  -- Give up on poison jobs first (stale lease + attempts exhausted).
  update public.whiteboard_jobs
  set status = 'failed',
      stage = 'failed',
      stage_message = 'Worker stopped responding repeatedly',
      error_message = 'Worker stopped responding after ' || attempt_count || ' attempts (crash, out-of-memory or restart during processing). Use Retry to run it again.',
      claim_token = null, worker_id = null, claimed_at = null, heartbeat_at = null,
      stage_updated_at = now(), updated_at = now()
  where status in ('narrating', 'rendering')
    and claim_token is not null
    and heartbeat_at < now() - interval '5 minutes'
    and attempt_count >= v_max_attempts;

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
      stage = case
        when job.timeline is not null and coalesce(job.audio_files, '[]'::jsonb) <> '[]'::jsonb then 'rendering'
        else 'narrating'
      end,
      stage_message = case when job.attempt_count > 0 then 'Resuming after worker interruption' else 'Worker started the job' end,
      stage_updated_at = now(),
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'whiteboard-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = job.attempt_count + 1,
      error_message = null,
      updated_at = now()
  from candidate
  where job.id = candidate.id
  returning job.*;
end;
$$;

revoke all on function public.claim_whiteboard_job(text) from public, anon, authenticated;
grant execute on function public.claim_whiteboard_job(text) to service_role;
