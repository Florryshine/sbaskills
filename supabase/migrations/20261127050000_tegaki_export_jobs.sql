-- Tegaki Studio Phase 5: durable Remotion export queue and Social Engine draft handoff.
create extension if not exists pg_net;
create table if not exists public.tegaki_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default 'general',
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  media_file_id uuid references public.media_files(id) on delete set null,
  scenes jsonb not null default '[]'::jsonb,
  aspect_ratio text not null default '9:16' check (aspect_ratio in ('9:16','16:9','1:1')),
  style_id text not null default 'classic-notebook',
  brand text not null default 'SHINEY BRAIN ACADEMY',
  narration_volume numeric not null default 1 check (narration_volume between 0 and 1),
  music_src text,
  music_volume numeric not null default 0.12 check (music_volume between 0 and 1),
  duration_seconds numeric,
  status text not null default 'queued' check (status in ('queued','rendering','uploading','ready','failed')),
  stage text not null default 'queued',
  stage_message text,
  video_url text,
  storage_path text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  claim_token uuid,
  worker_id text,
  heartbeat_at timestamptz,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tegaki_jobs_queue on public.tegaki_jobs(created_at) where status in ('queued','rendering','uploading');
alter table public.tegaki_jobs enable row level security;

create table if not exists public.tegaki_workers (
  worker_id text primary key,
  last_seen_at timestamptz not null default now(),
  current_job_id uuid,
  info jsonb not null default '{}'::jsonb
);
alter table public.tegaki_workers enable row level security;

create or replace function public.claim_tegaki_job(p_worker_id text)
returns setof public.tegaki_jobs
language plpgsql security definer set search_path = public
as $$
begin
  update public.tegaki_jobs
  set status='failed', stage='failed',
      stage_message='Worker stopped responding repeatedly',
      error_message='Renderer lease expired after three attempts. Use Retry to run it again.',
      claim_token=null, worker_id=null, heartbeat_at=null, updated_at=now()
  where status in ('queued','rendering','uploading')
    and claim_token is not null
    and heartbeat_at < now() - interval '5 minutes'
    and attempt_count >= 3;

  return query
  with candidate as (
    select id from public.tegaki_jobs
    where status in ('queued','rendering','uploading')
      and (claim_token is null or heartbeat_at is null or heartbeat_at < now() - interval '5 minutes')
      and attempt_count < 3
    order by created_at asc
    for update skip locked limit 1
  )
  update public.tegaki_jobs j
  set status='rendering', stage='claimed', stage_message='Renderer claimed export',
      claim_token=gen_random_uuid(), worker_id=left(coalesce(p_worker_id,'tegaki-worker'),120),
      heartbeat_at=now(), attempt_count=j.attempt_count+1, updated_at=now()
  from candidate where j.id=candidate.id returning j.*;
end;
$$;
revoke all on function public.claim_tegaki_job(text) from public, anon, authenticated;
grant execute on function public.claim_tegaki_job(text) to service_role;

create table if not exists public.tegaki_dispatch_attempts (
  id bigint generated always as identity primary key,
  request_id bigint,
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  http_status integer,
  error_message text
);
alter table public.tegaki_dispatch_attempts enable row level security;
revoke all on public.tegaki_dispatch_attempts from public, anon, authenticated;
grant all on public.tegaki_dispatch_attempts to service_role;

create or replace function public.tegaki_dispatch_renderer(p_source text default 'job-created')
returns bigint language plpgsql security definer
set search_path = public, vault, net, pg_temp
as $$
declare v_token text; v_request_id bigint;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name='github_dispatch_token' limit 1;
  if coalesce(v_token,'')='' then
    insert into public.tegaki_dispatch_attempts(source,error_message)
    values(coalesce(p_source,'unknown'),'missing_token: add github_dispatch_token to Supabase Vault');
    return null;
  end if;
  v_request_id := net.http_post(
    url := 'https://api.github.com/repos/Florryshine/sbaskills/dispatches',
    headers := jsonb_build_object('Authorization','Bearer '||v_token,'Accept','application/vnd.github+json','Content-Type','application/json','X-GitHub-Api-Version','2022-11-28','User-Agent','SBA-Tegaki-Dispatcher'),
    body := jsonb_build_object('event_type','tegaki-job','client_payload',jsonb_build_object('source',coalesce(p_source,'unknown'))),
    timeout_milliseconds := 5000
  );
  insert into public.tegaki_dispatch_attempts(source,request_id) values(coalesce(p_source,'unknown'),v_request_id);
  return v_request_id;
exception when others then
  insert into public.tegaki_dispatch_attempts(source,error_message) values(coalesce(p_source,'unknown'),left(sqlerrm,1000));
  return null;
end;
$$;
revoke all on function public.tegaki_dispatch_renderer(text) from public, anon, authenticated;
grant execute on function public.tegaki_dispatch_renderer(text) to service_role;

create or replace function public.tegaki_jobs_dispatch_trigger()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if tg_op='INSERT' and new.status='queued' then
    perform public.tegaki_dispatch_renderer('job-created');
  elsif new.status='queued' and old.status is distinct from new.status then
    perform public.tegaki_dispatch_renderer('job-requeued');
  end if;
  return new;
end;
$$;
drop trigger if exists tegaki_jobs_auto_dispatch on public.tegaki_jobs;
create trigger tegaki_jobs_auto_dispatch after insert or update of status on public.tegaki_jobs
for each row execute function public.tegaki_jobs_dispatch_trigger();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('tegaki-assets','tegaki-assets',true,26214400,array['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/ogg'])
on conflict(id) do update set public=true, file_size_limit=26214400, allowed_mime_types=excluded.allowed_mime_types;
