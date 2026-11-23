-- =============================================================================
-- SBA Social Publishing System — UPGRADE MIGRATION (Supabase / Postgres)
-- 2026-11-22 · social-publishing-upgrade
--
-- BACKWARD COMPATIBLE BY DESIGN:
--   * Every statement is IF NOT EXISTS / additive. No columns are dropped or
--     renamed, no data is deleted, no connected accounts or tokens are touched.
--   * Existing tables (channels, content_assets, media_files, publish_jobs)
--     keep their shapes; new columns are added with safe defaults or NULLable.
--   * New tables: platform_content, publish_events, fb_groups, fb_group_shares.
--     If your live database already has any of these names, review before running.
--
-- RLS: enabled for the app roles below. Adjust role names to your setup:
--   * staff / authenticated users manage publishing data through the app.
--   * service_role (used by the worker + storage driver) has full access
--     via Supabase's default service_role policies (BYPASSRLS on server side).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) New columns on existing tables (additive only)
-- ---------------------------------------------------------------------------
alter table public.channels
  add column if not exists mode text not null default 'live',
  add column if not exists sim_behavior text not null default 'success',
  add column if not exists sim_failure_rate double precision not null default 0,
  add column if not exists token_expires_at timestamptz,
  add column if not exists last_error text,
  add column if not exists sort_order int not null default 0;

alter table public.content_assets
  add column if not exists hashtags text not null default '',
  add column if not exists keywords text not null default '',
  add column if not exists approved_at timestamptz;

-- publish_jobs: per-platform independence + reliability columns
alter table public.publish_jobs
  add column if not exists payload_json text not null default '{}',
  add column if not exists thumbnail_media_id uuid references public.media_files (id) on delete set null,
  add column if not exists max_attempts int not null default 3,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists scheduled_at timestamptz,
  add column if not exists external_post_id text,
  add column if not exists external_url text,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists error_guidance text,
  add column if not exists thumbnail_error text,
  add column if not exists idempotency_key text;

-- unique idempotency key (one active publish per asset+channel+revision).
-- A plain unique index is used; if your existing table already has duplicate
-- keys the index creation will fail loudly — de-duplicate first, do NOT force it.
create unique index if not exists publish_jobs_idempotency_key_uq
  on public.publish_jobs (idempotency_key);

create index if not exists publish_jobs_status_next_attempt_idx
  on public.publish_jobs (status, next_attempt_at);
create index if not exists publish_jobs_asset_idx on public.publish_jobs (asset_id);

-- ---------------------------------------------------------------------------
-- 2) platform_content — per-platform captions/options (NEW)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_content (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.content_assets (id) on delete cascade,
  platform text not null,
  use_default boolean not null default true,
  title text not null default '',
  description text not null default '',
  hashtags text not null default '',
  tags text not null default '',
  options_json text not null default '{}',
  updated_at timestamptz not null default now(),
  unique (asset_id, platform),
  constraint platform_content_platform_check check (platform in
    ('youtube','facebook','instagram','tiktok','linkedin','x','pinterest','telegram'))
);

-- ---------------------------------------------------------------------------
-- 3) publish_events — append-only job history (NEW)
-- ---------------------------------------------------------------------------
create table if not exists public.publish_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.publish_jobs (id) on delete cascade,
  event text not null,
  detail_json text not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists publish_events_job_created_idx
  on public.publish_events (job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4) Facebook Groups assisted sharing (NEW — NOT automated publishing;
--    Meta removed the Groups API in v19.0, see UPGRADE_REPORT.md)
-- ---------------------------------------------------------------------------
create table if not exists public.fb_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.fb_group_shares (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.content_assets (id) on delete cascade,
  group_id uuid not null references public.fb_groups (id) on delete cascade,
  status text not null default 'not_started',
  opened_at timestamptz,
  confirmed_at timestamptz,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (asset_id, group_id),
  constraint fb_group_shares_status_check check (status in ('not_started','opened','confirmed'))
);

-- Guard rail: a share can only be confirmed after it was opened.
create or replace function public.fb_share_confirm_guard()
returns trigger language plpgsql as $$
begin
  if new.status = 'confirmed' and old.status = 'not_started' and new.opened_at is null then
    raise exception 'fb_group_shares: cannot confirm before the group was opened';
  end if;
  return new;
end $$;

drop trigger if exists fb_group_shares_confirm_guard on public.fb_group_shares;
create trigger fb_group_shares_confirm_guard
  before update on public.fb_group_shares
  for each row execute function public.fb_share_confirm_guard();

-- ---------------------------------------------------------------------------
-- 5) RLS — enable on new tables + hardened policies for app users
--    (adjust 'authenticated' to your staff role if you use a dedicated one)
-- ---------------------------------------------------------------------------
alter table public.platform_content enable row level security;
alter table public.publish_events   enable row level security;
alter table public.fb_groups        enable row level security;
alter table public.fb_group_shares  enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'platform_content' and policyname = 'platform_content_all_authenticated') then
    create policy platform_content_all_authenticated on public.platform_content
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'publish_events' and policyname = 'publish_events_all_authenticated') then
    create policy publish_events_all_authenticated on public.publish_events
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'fb_groups' and policyname = 'fb_groups_all_authenticated') then
    create policy fb_groups_all_authenticated on public.fb_groups
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'fb_group_shares' and policyname = 'fb_group_shares_all_authenticated') then
    create policy fb_group_shares_all_authenticated on public.fb_group_shares
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- If RLS was not yet enabled on the EXISTING tables, enable it now and grant the
-- same access. (Comment out if your live project already manages these.)
-- alter table public.channels      enable row level security;
-- alter table public.content_assets enable row level security;
-- alter table public.media_files   enable row level security;
-- alter table public.publish_jobs  enable row level security;

-- ---------------------------------------------------------------------------
-- 6) Storage — media bucket (thumbnails/videos live as OBJECTS, never rows)
--    Run as service_role or in the SQL editor with owner rights.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Public read for rendering previews; writes only for authenticated staff and service_role.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sba_media_public_read') then
    create policy sba_media_public_read on storage.objects
      for select using (bucket_id = 'media');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'sba_media_auth_write') then
    create policy sba_media_auth_write on storage.objects
      for all to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
  end if;
end $$;