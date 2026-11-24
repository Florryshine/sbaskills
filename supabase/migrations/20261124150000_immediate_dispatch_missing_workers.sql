-- Immediate GitHub Actions dispatch for every queue-backed video engine that
-- previously depended only on a five-minute poll. Uses the existing
-- github_dispatch_token in Supabase Vault and pg_net.
-- Covered here: Image Explainer narration + render, and Cartoon Studio.
-- Whiteboard, Stickman, Visual Learning, Music Learning and Motion Graphics
-- already have their own database dispatchers and are intentionally untouched.

create extension if not exists pg_net;

create table if not exists public.sba_worker_dispatch_attempts (
  id bigint generated always as identity primary key,
  engine text not null,
  event_type text not null,
  source text not null default 'unknown',
  request_id bigint,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  error_message text
);

create index if not exists idx_sba_worker_dispatch_attempts_engine_created
  on public.sba_worker_dispatch_attempts(engine, created_at desc);

alter table public.sba_worker_dispatch_attempts enable row level security;
revoke all on public.sba_worker_dispatch_attempts from public, anon, authenticated;
grant all on public.sba_worker_dispatch_attempts to service_role;

create or replace function public.sba_dispatch_worker(
  p_engine text,
  p_event_type text,
  p_source text default 'job-created'
)
returns bigint
language plpgsql
security definer
set search_path = public, vault, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  if p_engine not in ('image-explainer-narration', 'image-explainer-render', 'cartoon') then
    raise exception 'Unsupported worker engine: %', p_engine;
  end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where name = 'github_dispatch_token'
  limit 1;

  if coalesce(v_token, '') = '' then
    insert into public.sba_worker_dispatch_attempts(engine, event_type, source, error_message)
    values (p_engine, p_event_type, coalesce(p_source, 'unknown'),
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
      'User-Agent', 'SBA-Worker-Dispatcher'
    ),
    body := jsonb_build_object(
      'event_type', p_event_type,
      'client_payload', jsonb_build_object('engine', p_engine, 'source', coalesce(p_source, 'unknown'))
    ),
    timeout_milliseconds := 5000
  );

  insert into public.sba_worker_dispatch_attempts(engine, event_type, source, request_id)
  values (p_engine, p_event_type, coalesce(p_source, 'unknown'), v_request_id);

  return v_request_id;
exception when others then
  insert into public.sba_worker_dispatch_attempts(engine, event_type, source, error_message)
  values (p_engine, p_event_type, coalesce(p_source, 'unknown'), left(sqlerrm, 1000));
  return null;
end;
$$;

revoke all on function public.sba_dispatch_worker(text, text, text) from public, anon, authenticated;
grant execute on function public.sba_dispatch_worker(text, text, text) to service_role;

-- Image Explainer uses one durable job table but two independently running
-- workers. Dispatch only when a job enters the exact queue stage for that worker.
create or replace function public.image_explainer_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'narrating' and new.stage = 'narration_queued'
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.stage is distinct from new.stage) then
    perform public.sba_dispatch_worker('image-explainer-narration', 'image-explainer-narration', 'job-queued');
  elsif new.status = 'rendering' and new.stage = 'render_queued'
     and (tg_op = 'INSERT' or old.status is distinct from new.status or old.stage is distinct from new.stage) then
    perform public.sba_dispatch_worker('image-explainer-render', 'image-explainer-render', 'job-queued');
  end if;
  return new;
end;
$$;

revoke all on function public.image_explainer_jobs_dispatch_trigger() from public, anon, authenticated;

drop trigger if exists image_explainer_jobs_auto_dispatch on public.image_explainer_jobs;
create trigger image_explainer_jobs_auto_dispatch
after insert or update of status, stage on public.image_explainer_jobs
for each row execute function public.image_explainer_jobs_dispatch_trigger();

-- Cartoon Studio's worker already drains the durable cartoon_jobs queue. It
-- lacked a database trigger and therefore relied on cron/manual workflow runs.
create or replace function public.cartoon_jobs_dispatch_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'queued'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.sba_dispatch_worker('cartoon', 'cartoon-job', 'job-queued');
  end if;
  return new;
end;
$$;

revoke all on function public.cartoon_jobs_dispatch_trigger() from public, anon, authenticated;

drop trigger if exists cartoon_jobs_auto_dispatch on public.cartoon_jobs;
create trigger cartoon_jobs_auto_dispatch
after insert or update of status on public.cartoon_jobs
for each row execute function public.cartoon_jobs_dispatch_trigger();

-- Record GitHub's asynchronous HTTP response so dispatch failures are visible.
create or replace function public.sba_reconcile_worker_dispatches()
returns integer
language plpgsql
security definer
set search_path = public, net, pg_temp
as $$
declare
  v_updated integer;
begin
  update public.sba_worker_dispatch_attempts a
  set http_status = r.status_code,
      error_message = coalesce(r.error_msg,
        case when r.status_code < 200 or r.status_code >= 300 then left(r.content, 1000) else null end),
      completed_at = now()
  from net._http_response r
  where a.request_id = r.id and a.completed_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.sba_reconcile_worker_dispatches() from public, anon, authenticated;
grant execute on function public.sba_reconcile_worker_dispatches() to service_role;

-- Wake the workers for jobs that were already queued before this migration.
select public.sba_dispatch_worker('image-explainer-narration', 'image-explainer-narration', 'migration-backfill')
where exists (select 1 from public.image_explainer_jobs where status = 'narrating' and stage = 'narration_queued');
select public.sba_dispatch_worker('image-explainer-render', 'image-explainer-render', 'migration-backfill')
where exists (select 1 from public.image_explainer_jobs where status = 'rendering' and stage = 'render_queued');
select public.sba_dispatch_worker('cartoon', 'cartoon-job', 'migration-backfill')
where exists (select 1 from public.cartoon_jobs where status = 'queued');
