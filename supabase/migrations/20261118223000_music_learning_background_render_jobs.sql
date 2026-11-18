-- Durable Musical Learning Studio render queue.
-- Background jobs are persisted in Supabase and dispatched to the dedicated GitHub Actions worker.
-- Existing content_assets/media_files and music-studio-media bucket remain the publishing contract.

create table if not exists public.music_render_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  title text not null,
  topic text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  stage text not null default 'queued',
  stage_message text,
  progress integer not null default 0 check (progress between 0 and 100),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  dispatch_requested_at timestamptz,
  audio_url text,
  audio_storage_path text,
  video_url text,
  video_storage_path text,
  media_file_ids uuid[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_music_render_jobs_queue on public.music_render_jobs(created_at) where status in ('queued','processing');
create index if not exists idx_music_render_jobs_owner_created on public.music_render_jobs(created_by,created_at desc);
alter table public.music_render_jobs enable row level security;
revoke all on public.music_render_jobs from anon, authenticated;
grant select,insert,update on public.music_render_jobs to authenticated;
grant all on public.music_render_jobs to service_role;

drop policy if exists "Admins can read music render jobs" on public.music_render_jobs;
create policy "Admins can read music render jobs" on public.music_render_jobs for select to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "Admins can create music render jobs" on public.music_render_jobs;
create policy "Admins can create music render jobs" on public.music_render_jobs for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
drop policy if exists "Admins can update music render jobs" on public.music_render_jobs;
create policy "Admins can update music render jobs" on public.music_render_jobs for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create table if not exists public.music_render_workers (
 worker_id text primary key, started_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 current_job_id uuid references public.music_render_jobs(id) on delete set null,
 info jsonb not null default '{}'::jsonb
);
alter table public.music_render_workers enable row level security;
revoke all on public.music_render_workers from public,anon,authenticated;
grant all on public.music_render_workers to service_role;

create table if not exists public.music_render_dispatch_attempts (
 id bigint generated always as identity primary key, request_id bigint,
 source text not null default 'unknown', created_at timestamptz not null default now(),
 completed_at timestamptz, http_status integer, error_message text
);
alter table public.music_render_dispatch_attempts enable row level security;
revoke all on public.music_render_dispatch_attempts from public,anon,authenticated;
grant all on public.music_render_dispatch_attempts to service_role;

create or replace function public.claim_music_render_job(p_worker_id text)
returns setof public.music_render_jobs language plpgsql security definer set search_path=public as $$
begin
 update public.music_render_jobs set status='failed',stage='failed',
  stage_message='Worker stopped responding repeatedly',
  error_message='Background renderer stopped responding after '||attempt_count||' attempts. Retry this job from Musical Learning Studio.',
  claim_token=null,worker_id=null,claimed_at=null,heartbeat_at=null,updated_at=now()
 where status='processing' and heartbeat_at < now()-interval '5 minutes' and attempt_count>=max_attempts;
 return query
 with candidate as (
  select id from public.music_render_jobs
  where status='queued' or (status='processing' and (heartbeat_at is null or heartbeat_at<now()-interval '5 minutes') and attempt_count<max_attempts)
  order by created_at for update skip locked limit 1
 )
 update public.music_render_jobs j set status='processing',
  stage=case when j.stage in ('queued','failed') then 'preparing' else j.stage end,
  stage_message='Background worker claimed this song',claim_token=gen_random_uuid(),
  worker_id=left(coalesce(p_worker_id,'music-worker'),120),claimed_at=now(),heartbeat_at=now(),
  attempt_count=j.attempt_count+1,updated_at=now()
 from candidate c where j.id=c.id returning j.*;
end; $$;
revoke all on function public.claim_music_render_job(text) from public,anon,authenticated;
grant execute on function public.claim_music_render_job(text) to service_role;

create or replace function public.music_render_heartbeat(p_job_id uuid,p_claim_token uuid,p_stage text default null,p_progress integer default null,p_message text default null)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update public.music_render_jobs set heartbeat_at=now(),stage=coalesce(p_stage,stage),
 progress=coalesce(p_progress,progress),stage_message=coalesce(p_message,stage_message),updated_at=now()
 where id=p_job_id and claim_token=p_claim_token and status='processing';
 return found;
end; $$;
revoke all on function public.music_render_heartbeat(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.music_render_heartbeat(uuid,uuid,text,integer,text) to service_role;

create or replace function public.music_render_dispatch_renderer(p_source text default 'job-created')
returns bigint language plpgsql security definer set search_path=public,vault,net,pg_temp as $$
declare v_token text; v_request_id bigint;
begin
 select decrypted_secret into v_token from vault.decrypted_secrets where name='github_dispatch_token' limit 1;
 if coalesce(v_token,'')='' then
  insert into public.music_render_dispatch_attempts(source,error_message) values(coalesce(p_source,'unknown'),'missing_token: github_dispatch_token is not configured in Supabase Vault');
  return null;
 end if;
 v_request_id:=net.http_post(
  url:='https://api.github.com/repos/Florryshine/sbaskills/dispatches',
  headers:=jsonb_build_object('Authorization','Bearer '||v_token,'Accept','application/vnd.github+json','Content-Type','application/json','X-GitHub-Api-Version','2022-11-28','User-Agent','SBA-Music-Renderer'),
  body:=jsonb_build_object('event_type','music-render-job','client_payload',jsonb_build_object('source',coalesce(p_source,'unknown'))),
  timeout_milliseconds:=5000);
 insert into public.music_render_dispatch_attempts(source,request_id) values(coalesce(p_source,'unknown'),v_request_id);
 return v_request_id;
exception when others then
 insert into public.music_render_dispatch_attempts(source,error_message) values(coalesce(p_source,'unknown'),left(sqlerrm,1000));
 return null;
end; $$;
revoke all on function public.music_render_dispatch_renderer(text) from public,anon,authenticated;
grant execute on function public.music_render_dispatch_renderer(text) to service_role;

create or replace function public.music_render_jobs_dispatch_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' and new.status='queued' then perform public.music_render_dispatch_renderer('job-created');
 elsif new.status='queued' and old.status is distinct from new.status then perform public.music_render_dispatch_renderer('job-requeued');
 end if;
 return new;
end; $$;
revoke all on function public.music_render_jobs_dispatch_trigger() from public,anon,authenticated;
drop trigger if exists music_render_jobs_auto_dispatch on public.music_render_jobs;
create trigger music_render_jobs_auto_dispatch after insert or update of status on public.music_render_jobs
for each row execute function public.music_render_jobs_dispatch_trigger();

create or replace function public.music_render_reconcile_dispatches()
returns integer language plpgsql security definer set search_path=public,net,pg_temp as $$
declare v_updated integer;
begin
 update public.music_render_dispatch_attempts a set http_status=r.status_code,
  error_message=coalesce(r.error_msg,case when r.status_code>=400 then left(r.content,1000) else null end),
  completed_at=now()
 from net._http_response r where a.request_id=r.id and a.completed_at is null;
 get diagnostics v_updated=row_count; return v_updated;
end; $$;
revoke all on function public.music_render_reconcile_dispatches() from public,anon,authenticated;
grant execute on function public.music_render_reconcile_dispatches() to service_role;

create or replace function public.music_render_sweep_renderer()
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_waiting boolean; v_worker_online boolean; v_recent_dispatch boolean;
begin
 perform public.music_render_reconcile_dispatches();
 select exists(select 1 from public.music_render_jobs where status in ('queued','processing')
  and (status='queued' or heartbeat_at is null or heartbeat_at<now()-interval '5 minutes')) into v_waiting;
 if not v_waiting then return false; end if;
 select exists(select 1 from public.music_render_workers where last_seen_at>now()-interval '90 seconds') into v_worker_online;
 if v_worker_online then return false; end if;
 select exists(select 1 from public.music_render_dispatch_attempts where created_at>now()-interval '3 minutes') into v_recent_dispatch;
 if v_recent_dispatch then return false; end if;
 perform public.music_render_dispatch_renderer('minute-sweeper'); return true;
end; $$;
revoke all on function public.music_render_sweep_renderer() from public,anon,authenticated;
grant execute on function public.music_render_sweep_renderer() to service_role;

do $$ declare v_job_id bigint; begin
 for v_job_id in select jobid from cron.job where jobname='music-renderer-sweeper' loop perform cron.unschedule(v_job_id); end loop;
 perform cron.schedule('music-renderer-sweeper','* * * * *','select public.music_render_sweep_renderer();');
end; $$;
