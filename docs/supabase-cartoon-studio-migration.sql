-- ============================================================================
-- Cartoon Animation Studio — Supabase migration for sbaskills
-- Port: run this in the Supabase SQL editor (or supabase/migrations/).
-- It mirrors the sandbox Prisma schema 1:1 and follows the exact
-- conventions of supabase/migrations/20260718_social_engine_v2.sql
-- (service-role-only RLS) and 20261113_whiteboard_engine_jobs.sql
-- (job lifecycle columns).
-- Safe for existing data: only NEW tables are created, nothing existing
-- is altered. knowledge_assets / social_channels_v2 / publish_jobs are
-- REUSED, not duplicated.
-- ============================================================================

-- 1) cartoon_projects — the production job (mirrors whiteboard_jobs pattern)
create table if not exists public.cartoon_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Cartoon',
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  custom_topic text,
  orientation text not null default '9:16' check (orientation in ('9:16','16:9','1:1')),
  subtitles boolean not null default true,
  -- lifecycle: scripting -> narrating -> cast_ready -> rendering -> ready | failed
  status text not null default 'draft'
    check (status in ('draft','scripting','narrating','cast_ready','rendering','ready','failed')),
  stage text not null default 'idle'
    check (stage in ('idle','scripting','narration','render','saving','done','failed')),
  stage_message text not null default '',
  progress double precision not null default 0,
  raw_script jsonb,
  spec jsonb,               -- validated CartoonSpec (production master)
  narration jsonb,          -- {sceneId: {audioPath, audioUrl, durationSeconds, words[]}}
  video_url text,
  video_path text,          -- storage path inside lesson-videos bucket
  video_size_bytes bigint,
  duration_seconds double precision,
  error text,
  attempt_count int not null default 0,
  render_job_token text,    -- claim token: prevents duplicate render jobs
  render_started_at timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cartoon_projects_status_idx
  on public.cartoon_projects (status)
  where status in ('scripting','narrating','rendering');
create index if not exists cartoon_projects_created_idx
  on public.cartoon_projects (created_at desc);

-- 2) cartoon_characters — reusable cast (presets seeded by the app)
create table if not exists public.cartoon_characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preset_key text unique not null,     -- 'tobi', 'ada', 'custom-...'
  dna jsonb not null,                  -- CharacterDNA (skin, hairStyle, outfit, colors...)
  is_preset boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) RLS: service role only (same policy style as social_engine_v2)
alter table public.cartoon_projects enable row level security;
alter table public.cartoon_characters enable row level security;

drop policy if exists "service role full access cartoon_projects" on public.cartoon_projects;
create policy "service role full access cartoon_projects" on public.cartoon_projects
  for all to service_role using (true) with check (true);

drop policy if exists "service role full access cartoon_characters" on public.cartoon_characters;
create policy "service role full access cartoon_characters" on public.cartoon_characters
  for all to service_role using (true) with check (true);

-- 4) Storage: narration audio bucket (public read so Remotion/Publisher can fetch)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cartoon-assets', 'cartoon-assets', true, 52428800, array['audio/wav','audio/mpeg','audio/mp4'])
on conflict (id) do nothing;

-- Finished videos go to the EXISTING public 'lesson-videos' bucket at
-- path cartoon/<projectId>/<slug>.mp4 — the same bucket the whiteboard
-- engine and video studio use, so Social Publishing keeps one convention.

-- 5) notes
-- content_assets rows created by the studio use:
--   asset_type = 'cartoon_video', platform = null, format = 'video'
--   metadata.cartoon_project_id = <project id>  (recovery key, idempotent)
-- plus a media_files row {media_type:'video', role:'primary', position:0,
-- source:'render'} — which makes them publishable through
-- lib/publish-engine.js and the Social Engine UI with ZERO changes.

-- ============================================================================
-- SECTION 7 ADDENDUM — Shared Visual Asset Library
-- One library for every production engine (Cartoon/Whiteboard/Notebook/…).
-- Safe for existing data: only NEW objects, nothing existing is altered.
-- ============================================================================

-- 6) visual_assets — the shared library (metadata follows media_files
--    conventions; licence fields are first-class so attribution survives
--    publishing)
create table if not exists public.visual_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  subject text not null default 'General',
  category text not null default 'object',
  asset_type text not null default 'svg' check (asset_type in ('svg','image','3d')),
  keywords jsonb not null default '[]',
  file_path text not null,          -- path inside the 'visual-assets' bucket
  public_url text not null,
  mime_type text not null default 'image/svg+xml',
  width int,
  height int,
  file_size_bytes bigint not null default 0,
  source text not null default 'catalog'
    check (source in ('catalog','svg-llm','upload','openverse','wikimedia','pexels','pixabay','unsplash')),
  source_ref text,                  -- provider photo id (per-provider dedup)
  source_url text,                  -- provider page (licence proof)
  creator text,
  license text not null default 'SBA Original (CC0)',
  license_url text,
  attribution_required boolean not null default false,
  attribution text,
  content_hash text not null unique,  -- sha256 of normalised content (hard dedup)
  generation_params jsonb not null default '{}',
  usage_count int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visual_assets_subject_idx on public.visual_assets (subject);
create index if not exists visual_assets_category_idx on public.visual_assets (category);
create index if not exists visual_assets_source_idx on public.visual_assets (source);
create index if not exists visual_assets_active_idx on public.visual_assets (is_active);

alter table public.visual_assets enable row level security;
drop policy if exists "service role full access visual_assets" on public.visual_assets;
create policy "service role full access visual_assets" on public.visual_assets
  for all to service_role using (true) with check (true);

-- 7) Storage: shared visual-assets bucket (public read so engines and the
--    render worker can fetch SVGs/images directly)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visual-assets', 'visual-assets', true, 15728640,
        array['image/svg+xml','image/png','image/jpeg','image/webp','image/gif',
              'model/gltf-binary','model/gltf+json'])
on conflict (id) do nothing;

-- 8) notes
-- cartoon_projects.spec may carry per-scene `customAssets` entries:
--   { assetId, url, x, y, scale, popAt, name, license }
-- licence info is embedded in the spec so published videos can always be
-- credited correctly, even if the library row changes later.
