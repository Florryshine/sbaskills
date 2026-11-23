-- Visual Learning automatic GitHub Actions dispatch + one-minute recovery sweeper.
-- Uses the existing github_dispatch_token in Supabase Vault and the existing
-- repository_dispatch event in .github/workflows/visual-learning-worker.yml.

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.visual_learning_dispatch_attempts
  add column if not exists request_id bigint,
  add column if not exists completed_at timestamptz,
  add column if not exists http_status integer,
  add column if not exists error_message text;

create index if not exists idx_visual_learning_dispatch_attempts_created
  on public.visual_learning_dispatch_attempts (created_at desc);

create or replace function public.visual_learning_dispatch_renderer(p_source text default 'job-created')
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
  v_attempt integer;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'github_dispatch_token'
  limit 1;

  select coalesce(max(attempt), 0) + 1 into v_attempt
  from public.visual_learning_dispatch_attempts;

  if coalesce(v_token, '') = '' then
    insert into public.visual_learning_dispatch_attempts(job_id, attempt, status, detail, error_message)
    values (null, v_attempt, 'failed', jsonb_build_object('source', coalesce(p_source, 'unknown')),
      'missing_token: add github_dispatch_token to Supabase Vault');
    return null;
  end if;

  v_request_id := net.http_post(
    url := 'https://api.github.com/repos/Florryshine/sbaskills/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_token,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'SBA-Visual-Learning-Dispatcher'
    ),
    body := jsonb_build_object(
      'event_type', 'visual-learning-render',
      'client_payload', jsonb_build_object('source', coalesce(p_source, 'unknown'))
    ),
    timeout_milliseconds := 5000
  );

  insert into public.visual_learning_dispatch_attempts(job_id, attempt, status, detail, request_id)
  values (null, v_attempt, 'submitted',
    jsonb_build_object('source', coalesce(p_source, 'unknown')), v_request_id);

  return v_request_id;
exception when others then
  insert into public.visual_learning_dispatch_attempts(job_id, attempt, status, detail, error_message)
  values (null, coalesce(v_attempt, 1), 'failed',
    jsonb_build_object('source', coalesce(p_source, 'unknown')), left(sqlerrm, 1000));
  return null;
end;
$$;

revoke all on function public.visual_learning_dispatch_renderer(text) from public, anon, authenticated;
grant execute on function public.visual_learning_dispatch_renderer(text) to service_role;

create or replace function public.visual_learning_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    perform public.visual_learning_dispatch_renderer('job-created');
  elsif new.status = 'queued' and old.status is distinct from new.status then
    perform public.visual_learning_dispatch_renderer('job-requeued');
  end if;
  return new;
end;
$$;

drop trigger if exists visual_learning_jobs_auto_dispatch on public.visual_learning_jobs;
create trigger visual_learning_jobs_auto_dispatch
after insert or update of status on public.visual_learning_jobs
for each row execute function public.visual_learning_jobs_dispatch_trigger();

create or replace function public.visual_learning_reconcile_dispatches()
returns integer
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.visual_learning_dispatch_attempts a
  set http_status = r.status_code,
      error_message = coalesce(r.error_msg,
        case when r.status_code < 200 or r.status_code >= 300 then left(r.content, 1000) else null end),
      status = case when r.status_code >= 200 and r.status_code < 300 then 'accepted' else 'failed' end,
      completed_at = now()
  from net._http_response r
  where a.request_id = r.id
    and a.completed_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.visual_learning_reconcile_dispatches() from public, anon, authenticated;
grant execute on function public.visual_learning_reconcile_dispatches() to service_role;

create or replace function public.visual_learning_sweep_renderer()
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
  perform public.visual_learning_reconcile_dispatches();

  select exists (
    select 1
    from public.visual_learning_jobs
    where status in ('queued', 'scripting', 'imagery', 'narrating', 'timeline', 'rendering', 'saving')
      and (
        status = 'queued'
        or heartbeat_at is null
        or heartbeat_at < now() - interval '8 minutes'
      )
      and attempt_count < 3
  ) into v_waiting;

  if not v_waiting then return false; end if;

  select exists (
    select 1 from public.visual_learning_workers
    where last_seen_at > now() - interval '90 seconds'
  ) into v_worker_online;

  if v_worker_online then return false; end if;

  select exists (
    select 1 from public.visual_learning_dispatch_attempts
    where created_at > now() - interval '3 minutes'
  ) into v_recent_dispatch;

  if v_recent_dispatch then return false; end if;

  perform public.visual_learning_dispatch_renderer('minute-sweeper');
  return true;
end;
$$;

revoke all on function public.visual_learning_sweep_renderer() from public, anon, authenticated;
grant execute on function public.visual_learning_sweep_renderer() to service_role;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname = 'visual-learning-renderer-sweeper'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'visual-learning-renderer-sweeper',
    '* * * * *',
    'select public.visual_learning_sweep_renderer();'
  );
end;
$$;

-- Immediately wake the worker for any jobs already waiting.
select public.visual_learning_sweep_renderer();
