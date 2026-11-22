-- Shared Visual Discovery & Asset Intelligence — additive foundation.
--
-- SAFETY: this migration is idempotent and additive. It can run whether or
-- not 20261120080000_cartoon_studio_foundation.sql (which introduces
-- public.visual_assets) has been applied:
--   * the visual_assets table is created only if missing (identical shape),
--   * new columns are added with `add column if not exists`,
--   * no existing column, constraint, policy or engine table is modified or
--     dropped,
--   * storage buckets are inserted `on conflict do nothing`.
--
-- Apply manually in the Supabase SQL editor (repo convention: migrations are
-- NOT applied automatically). Re-running is a no-op.

-- ---------------------------------------------------------------------------
-- TIER C — permanent visual library (existing table; extended additively)
-- ---------------------------------------------------------------------------
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

-- New additive columns for the visual intelligence system.
alter table public.visual_assets add column if not exists approval_status text not null default 'approved';
alter table public.visual_assets add column if not exists provider text;
alter table public.visual_assets add column if not exists provider_asset_id text;
alter table public.visual_assets add column if not exists inspection jsonb not null default '{}'::jsonb;
alter table public.visual_assets add column if not exists tier text not null default 'library';

create index if not exists idx_visual_assets_approval
  on public.visual_assets(approval_status) where is_active = true;
create index if not exists idx_visual_assets_tier
  on public.visual_assets(tier) where is_active = true;

-- Atomic usage counter for engine reuse tracking.
create or replace function public.increment_visual_asset_usage(p_asset_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.visual_assets
  set usage_count = usage_count + 1
  where id = p_asset_id;
$$;

revoke all on function public.increment_visual_asset_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_visual_asset_usage(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- TIER A — search result cache (provider results, TTL-bounded)
-- ---------------------------------------------------------------------------
create table if not exists public.visual_search_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  provider text not null default 'multi',
  query text not null default '',
  params jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);

create index if not exists idx_visual_search_cache_expiry
  on public.visual_search_cache(expires_at);

-- ---------------------------------------------------------------------------
-- TIER B — ephemeral media (staged for renders/previews, purged by TTL)
-- ---------------------------------------------------------------------------
create table if not exists public.visual_ephemeral_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Ephemeral asset',
  storage_path text not null,
  public_url text,
  mime_type text not null default 'application/octet-stream',
  file_size_bytes bigint not null default 0,
  content_hash text,
  retained_for text,
  request_context jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default now() + interval '7 days',
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_visual_ephemeral_expiry
  on public.visual_ephemeral_assets(expires_at);
create index if not exists idx_visual_ephemeral_hash
  on public.visual_ephemeral_assets(content_hash) where content_hash is not null;

-- ---------------------------------------------------------------------------
-- TIER D — procedural library lives in code (lib/visual-intelligence/
-- procedural.js); generated outputs are stored in visual_assets with
-- source='procedural' and tier='procedural'. No table needed.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- RLS + grants (same pattern as the existing engine tables)
-- ---------------------------------------------------------------------------
alter table public.visual_search_cache enable row level security;
alter table public.visual_ephemeral_assets enable row level security;

-- visual_assets policies (idempotent with the cartoon foundation migration).
drop policy if exists "Admins can manage visual assets" on public.visual_assets;
create policy "Admins can manage visual assets" on public.visual_assets
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can manage visual search cache" on public.visual_search_cache;
create policy "Admins can manage visual search cache" on public.visual_search_cache
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

drop policy if exists "Admins can manage visual ephemeral assets" on public.visual_ephemeral_assets;
create policy "Admins can manage visual ephemeral assets" on public.visual_ephemeral_assets
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

grant all on public.visual_assets, public.visual_search_cache, public.visual_ephemeral_assets to service_role;

-- Timestamps trigger (function set_updated_at exists in production).
drop trigger if exists trg_visual_assets_updated on public.visual_assets;
create trigger trg_visual_assets_updated before update on public.visual_assets
  for each row execute function public.set_updated_at();
drop trigger if exists trg_visual_search_cache_updated on public.visual_search_cache;
create trigger trg_visual_search_cache_updated before update on public.visual_search_cache
  for each row execute function public.set_updated_at();
drop trigger if exists trg_visual_ephemeral_updated on public.visual_ephemeral_assets;
create trigger trg_visual_ephemeral_updated before update on public.visual_ephemeral_assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets (same bucket as the existing library; new prefixes
-- ephemeral/ and library/ are path-based, no new bucket required)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('visual-assets', 'visual-assets', true)
on conflict (id) do nothing;

comment on table public.visual_search_cache is
  'Tier A: provider search result cache. TTL-bounded; Pixabay entries never exceed 24h per their API terms. Purged by the visual-cache-purge cron.';
comment on table public.visual_ephemeral_assets is
  'Tier B: media staged for a render window or admin preview. Expired rows and their bytes are purged by the visual-cache-purge cron.';
comment on column public.visual_assets.approval_status is
  'approved | pending_review | rejected. External assets only become reusable after admin approval.';
