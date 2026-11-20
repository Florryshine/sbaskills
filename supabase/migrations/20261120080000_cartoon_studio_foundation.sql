-- Cartoon Animation Studio + engine-neutral Visual Asset Library.
-- Additive foundation only. This migration is NOT applied automatically.
-- Production integrations: Supabase/Postgres, existing Knowledge Assets,
-- content_assets/media_files, and the existing persistent worker pattern.

create table if not exists public.cartoon_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Cartoon',
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  custom_topic text,
  orientation text not null default '9:16' check (orientation in ('9:16','16:9','1:1')),
  subtitles boolean not null default true,
  status text not null default 'draft'
    check (status in ('draft','queued','scripting','narrating','cast_ready','rendering','ready','failed','cancelled')),
  stage text not null default 'idle',
  stage_message text,
  progress integer not null default 0 check (progress between 0 and 100),
  raw_script jsonb,
  spec jsonb,
  narration jsonb not null default '{}'::jsonb,
  video_url text,
  video_storage_path text,
  video_size_bytes bigint,
  duration_seconds numeric,
  content_asset_id uuid references public.content_assets(id) on delete set null,
  media_file_id uuid references public.media_files(id) on delete set null,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cartoon_projects_owner_created
  on public.cartoon_projects(created_by, created_at desc);
create index if not exists idx_cartoon_projects_status_updated
  on public.cartoon_projects(status, updated_at desc);

create table if not exists public.cartoon_characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preset_key text not null unique,
  dna jsonb not null,
  is_preset boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cartoon_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.cartoon_projects(id) on delete cascade,
  job_type text not null check (job_type in ('script','narrate','render')),
  status text not null default 'queued'
    check (status in ('queued','processing','completed','failed','cancelled')),
  stage text not null default 'queued',
  stage_message text,
  progress integer not null default 0 check (progress between 0 and 100),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  claim_token uuid,
  worker_id text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_cartoon_jobs_queue
  on public.cartoon_jobs(created_at)
  where status in ('queued','processing');
create index if not exists idx_cartoon_jobs_project
  on public.cartoon_jobs(project_id, created_at desc);

create table if not exists public.cartoon_workers (
  worker_id text primary key,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  current_job_id uuid references public.cartoon_jobs(id) on delete set null,
  info jsonb not null default '{}'::jsonb
);

-- One engine-neutral catalogue shared by Cartoon, Whiteboard, Notebook and
-- future Mixed Media engines. File bytes live in Supabase Storage.
create table if not exists public.visual_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  subject text not null default 'General',
  category text not null default 'object',
  asset_type text not null default 'svg' check (asset_type in ('svg','image','3d','gif','video')),
  keywords text[] not null default '{}',
  storage_path text not null,
  public_url text not null,
  mime_type text not null default 'image/svg+xml',
  width integer,
  height integer,
  file_size_bytes bigint not null default 0,
  source text not null default 'catalog',
  source_ref text,
  source_url text,
  creator text,
  license text not null default 'SBA Original (CC0)',
  license_url text,
  attribution_required boolean not null default false,
  attribution text,
  content_hash text not null unique,
  generation_params jsonb not null default '{}'::jsonb,
  usage_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_visual_assets_subject_category
  on public.visual_assets(subject, category) where is_active = true;
create index if not exists idx_visual_assets_active_created
  on public.visual_assets(is_active, created_at desc);
create index if not exists idx_visual_assets_keywords
  on public.visual_assets using gin(keywords);
create index if not exists idx_visual_assets_source_ref
  on public.visual_assets(source, source_ref) where source_ref is not null;

-- Keep timestamps consistent with the rest of the production schema.
drop trigger if exists trg_cartoon_projects_updated on public.cartoon_projects;
create trigger trg_cartoon_projects_updated before update on public.cartoon_projects
  for each row execute function public.set_updated_at();
drop trigger if exists trg_cartoon_characters_updated on public.cartoon_characters;
create trigger trg_cartoon_characters_updated before update on public.cartoon_characters
  for each row execute function public.set_updated_at();
drop trigger if exists trg_cartoon_jobs_updated on public.cartoon_jobs;
create trigger trg_cartoon_jobs_updated before update on public.cartoon_jobs
  for each row execute function public.set_updated_at();
drop trigger if exists trg_visual_assets_updated on public.visual_assets;
create trigger trg_visual_assets_updated before update on public.visual_assets
  for each row execute function public.set_updated_at();

-- Admins can use the project studio through authenticated API routes.
alter table public.cartoon_projects enable row level security;
alter table public.cartoon_characters enable row level security;
alter table public.cartoon_jobs enable row level security;
alter table public.cartoon_workers enable row level security;
alter table public.visual_assets enable row level security;

drop policy if exists "Admins can manage cartoon projects" on public.cartoon_projects;
create policy "Admins can manage cartoon projects" on public.cartoon_projects
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can manage cartoon characters" on public.cartoon_characters;
create policy "Admins can manage cartoon characters" on public.cartoon_characters
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can read cartoon jobs" on public.cartoon_jobs;
create policy "Admins can read cartoon jobs" on public.cartoon_jobs
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can create cartoon jobs" on public.cartoon_jobs;
create policy "Admins can create cartoon jobs" on public.cartoon_jobs
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
drop policy if exists "Admins can update cartoon jobs" on public.cartoon_jobs;
create policy "Admins can update cartoon jobs" on public.cartoon_jobs
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can manage visual assets" on public.visual_assets;
create policy "Admins can manage visual assets" on public.visual_assets
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- Worker and service-role access only for liveness and queue processing.
revoke all on public.cartoon_workers from public, anon, authenticated;
grant all on public.cartoon_workers to service_role;
grant all on public.cartoon_projects, public.cartoon_characters, public.cartoon_jobs, public.visual_assets to service_role;

-- Narration and visual files are served to Remotion/preview via Storage URLs.
insert into storage.buckets (id, name, public)
values ('cartoon-assets', 'cartoon-assets', true),
       ('visual-assets', 'visual-assets', true)
on conflict (id) do nothing;

-- Atomic job claim with bounded retries and stale-lease recovery.
create or replace function public.claim_cartoon_job(p_worker_id text)
returns setof public.cartoon_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cartoon_jobs
  set status = 'failed',
      stage = 'failed',
      stage_message = 'Worker stopped responding repeatedly',
      error_message = 'Cartoon worker stopped responding after the maximum number of attempts.',
      claim_token = null, worker_id = null, claimed_at = null, heartbeat_at = null,
      updated_at = now()
  where status = 'processing'
    and heartbeat_at < now() - interval '5 minutes'
    and attempt_count >= max_attempts;

  return query
  with candidate as (
    select id
    from public.cartoon_jobs
    where status = 'queued'
       or (status = 'processing'
           and (claim_token is null or heartbeat_at is null
                or heartbeat_at < now() - interval '5 minutes')
           and attempt_count < max_attempts)
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.cartoon_jobs j
  set status = 'processing',
      stage = case when j.stage in ('queued','failed') then 'preparing' else j.stage end,
      stage_message = 'Claimed by Cartoon worker',
      claim_token = gen_random_uuid(),
      worker_id = left(coalesce(p_worker_id, 'cartoon-worker'), 120),
      claimed_at = now(),
      heartbeat_at = now(),
      attempt_count = j.attempt_count + 1,
      updated_at = now()
  from candidate c
  where j.id = c.id
  returning j.*;
end;
$$;

revoke all on function public.claim_cartoon_job(text) from public, anon, authenticated;
grant execute on function public.claim_cartoon_job(text) to service_role;

create or replace function public.cartoon_job_heartbeat(
  p_job_id uuid,
  p_claim_token uuid,
  p_stage text default null,
  p_progress integer default null,
  p_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cartoon_jobs
  set heartbeat_at = now(),
      stage = coalesce(p_stage, stage),
      progress = coalesce(p_progress, progress),
      stage_message = coalesce(p_message, stage_message),
      updated_at = now()
  where id = p_job_id
    and claim_token = p_claim_token
    and status = 'processing';
  return found;
end;
$$;

revoke all on function public.cartoon_job_heartbeat(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.cartoon_job_heartbeat(uuid, uuid, text, integer, text) to service_role;

comment on table public.visual_assets is
  'Engine-neutral shared visual asset catalogue. Asset bytes live in the visual-assets Supabase Storage bucket; licence and attribution metadata remain attached to each record.';
comment on table public.cartoon_jobs is
  'Durable Cartoon Animation Studio work queue. API routes enqueue; persistent workers claim, heartbeat, retry and save results.';
comment on table public.cartoon_projects is
  'Cartoon Animation Studio projects. Storyboards/narration are JSONB; final videos register through content_assets and media_files.';
