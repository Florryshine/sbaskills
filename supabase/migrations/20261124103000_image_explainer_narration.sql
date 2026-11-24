-- Phase 4: durable narration queue and private audio storage.
create index if not exists idx_image_explainer_narration_queue
  on public.image_explainer_jobs(status, created_at)
  where status = 'narrating';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('image-explainer-audio', 'image-explainer-audio', false, 52428800, array['audio/mpeg','audio/wav'])
on conflict (id) do update
set public = false, file_size_limit = 52428800, allowed_mime_types = array['audio/mpeg','audio/wav'];

create or replace function public.claim_image_explainer_narration_job(p_worker_id text)
returns setof public.image_explainer_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Convert exhausted abandoned leases into visible failures instead of leaving them stuck forever.
  update public.image_explainer_jobs
  set status = 'failed',
      stage = 'narration_failed',
      stage_message = 'Narration worker lease expired after the retry limit.',
      error_message = coalesce(error_message, 'The narration worker stopped responding after three attempts. Retry this job from the admin studio.'),
      claim_token = null, worker_id = null, heartbeat_at = null,
      updated_at = now()
  where status = 'narrating'
    and attempt_count >= 3
    and (heartbeat_at is null or heartbeat_at < now() - interval '10 minutes');

  return query
  with candidate as (
    select id
    from public.image_explainer_jobs
    where status = 'narrating'
      and attempt_count < 3
      and (claim_token is null or heartbeat_at is null or heartbeat_at < now() - interval '10 minutes')
      and script is not null
      and script->>'review_status' = 'admin_reviewed'
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.image_explainer_jobs j
  set claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'image-explainer-worker'), 160),
      attempt_count = j.attempt_count + 1,
      heartbeat_at = now(),
      stage = 'narration_generating',
      stage_message = 'Worker claimed the narration job.',
      updated_at = now()
  from candidate
  where j.id = candidate.id
  returning j.*;
end;
$$;

revoke all on function public.claim_image_explainer_narration_job(text) from public, anon, authenticated;
grant execute on function public.claim_image_explainer_narration_job(text) to service_role;
