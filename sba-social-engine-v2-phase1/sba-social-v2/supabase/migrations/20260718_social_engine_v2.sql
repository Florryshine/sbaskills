-- ============================================================================
-- Shiney Brain Academy — Social/Content Engine v2
-- Replaces the old single-platform-per-row social_post_drafts model.
-- Safe to run alongside old tables — nothing here drops existing data.
-- Old tables (social_post_drafts, social_channels, social_publish_history)
-- can be migrated/retired in a follow-up once v2 is verified in production.
-- ============================================================================

-- Every piece of generated content, of every type, for a knowledge asset.
-- One row per generated artifact — a blog post, a quiz, an Instagram caption,
-- a carousel, a thumbnail, etc. Platform-specific content has platform set;
-- internal content (blog, quiz, flashcards, study notes, podcast) has it null.
create table if not exists content_assets (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid not null references knowledge_assets(id) on delete cascade,

  -- what this is: 'blog' | 'study_notes' | 'flashcards' | 'quiz' | 'podcast'
  -- | 'image' | 'instagram_carousel' | 'instagram_caption' | 'facebook_post'
  -- | 'telegram_post' | 'linkedin_post' | 'x_post' | 'pinterest_pin'
  -- | 'youtube_short' | 'youtube_video' | 'tiktok_video' | 'thumbnail'
  -- | 'hashtags' | 'seo_metadata'
  asset_type text not null,

  -- null for non-social content (blog/quiz/flashcards/podcast/study_notes)
  platform text,

  -- 'text' | 'image' | 'carousel' | 'video' | 'audio' | 'document'
  format text not null default 'text',

  title text,
  body text,               -- caption / description / script / article body
  metadata jsonb default '{}'::jsonb,   -- hashtags[], seo{}, cta, alt_text, tags[], playlist_id, etc.

  status text not null default 'draft'
    check (status in ('draft','approved','scheduled','publishing','published','failed','archived')),

  -- lets "regenerate only this platform" create a new version without losing history
  version int not null default 1,
  regenerated_from uuid references content_assets(id),

  generated_by text,        -- which model/provider produced it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_assets_ka on content_assets(knowledge_asset_id);
create index if not exists idx_content_assets_platform on content_assets(platform);
create index if not exists idx_content_assets_status on content_assets(status);

-- Media files, decoupled from content so a carousel can hold N images in
-- order, a YouTube short can have a video + separate thumbnail, etc.
create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  content_asset_id uuid references content_assets(id) on delete cascade,

  media_type text not null check (media_type in ('image','video','audio','document')),
  role text not null default 'primary',   -- 'primary' | 'thumbnail' | 'carousel_slide'
  position int not null default 0,        -- ordering within a carousel/media group

  url text not null,
  storage_path text,
  width int,
  height int,
  duration_seconds numeric,
  file_size_bytes bigint,
  mime_type text,

  source text default 'ai_generated',     -- 'ai_generated' | 'stock' | 'upload' | 'render'
  alt_text text,

  created_at timestamptz not null default now()
);

create index if not exists idx_media_files_content_asset on media_files(content_asset_id);

-- Connected accounts. One row per connected channel — supports multiple
-- accounts per platform (e.g. two Instagram pages) via the label field.
create table if not exists social_channels_v2 (
  id uuid primary key default gen_random_uuid(),
  platform text not null,       -- 'instagram' | 'facebook' | 'telegram' | 'linkedin'
                                  -- | 'x' | 'pinterest' | 'youtube' | 'tiktok' | 'threads' | 'whatsapp'
  label text not null default 'Main',
  account_id text,               -- page id / channel id / bot chat id, etc.
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, label)
);

-- One row per (content_asset, channel) publish intent. This is what makes
-- "publish IG + FB but not TikTok" and "schedule YouTube for tomorrow" work
-- cleanly — each target gets its own row, its own status, its own retries.
create table if not exists publish_jobs (
  id uuid primary key default gen_random_uuid(),
  content_asset_id uuid not null references content_assets(id) on delete cascade,
  channel_id uuid not null references social_channels_v2(id) on delete cascade,

  status text not null default 'queued'
    check (status in ('queued','scheduled','publishing','published','failed','cancelled','rate_limited')),

  scheduled_at timestamptz,
  published_at timestamptz,
  external_post_id text,
  external_url text,

  attempt_count int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  rate_limit_until timestamptz,

  created_by text,           -- admin user who approved/scheduled this
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_publish_jobs_status on publish_jobs(status);
create index if not exists idx_publish_jobs_scheduled on publish_jobs(scheduled_at)
  where status = 'scheduled';
create index if not exists idx_publish_jobs_content_asset on publish_jobs(content_asset_id);

-- Immutable audit trail — every publish attempt, success or failure.
create table if not exists publish_history (
  id uuid primary key default gen_random_uuid(),
  publish_job_id uuid references publish_jobs(id) on delete set null,
  content_asset_id uuid,
  platform text,
  status text not null,        -- 'success' | 'error' | 'retry'
  response jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_publish_history_job on publish_history(publish_job_id);

-- Lightweight analytics pull-in (populated by a future sync job per platform).
create table if not exists publish_analytics (
  id uuid primary key default gen_random_uuid(),
  publish_job_id uuid references publish_jobs(id) on delete cascade,
  impressions int,
  likes int,
  comments int,
  shares int,
  clicks int,
  raw jsonb default '{}'::jsonb,
  fetched_at timestamptz not null default now()
);

-- updated_at triggers
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_content_assets_updated on content_assets;
create trigger trg_content_assets_updated before update on content_assets
  for each row execute function set_updated_at();

drop trigger if exists trg_publish_jobs_updated on publish_jobs;
create trigger trg_publish_jobs_updated before update on publish_jobs
  for each row execute function set_updated_at();

drop trigger if exists trg_social_channels_v2_updated on social_channels_v2;
create trigger trg_social_channels_v2_updated before update on social_channels_v2
  for each row execute function set_updated_at();

-- RLS: service-role only for now (admin dashboard uses the service key via
-- createAdminClient(), same pattern as the rest of the codebase).
alter table content_assets enable row level security;
alter table media_files enable row level security;
alter table social_channels_v2 enable row level security;
alter table publish_jobs enable row level security;
alter table publish_history enable row level security;
alter table publish_analytics enable row level security;

-- Restricted to service_role only — the admin dashboard talks to these
-- tables exclusively via createAdminClient() (service key), never the
-- anon/browser client, so no anon/authenticated policy is defined here
-- on purpose. Add narrower authenticated policies later if you build a
-- direct-from-browser admin UI instead of going through API routes.
create policy "service role full access" on content_assets for all
  to service_role using (true) with check (true);
create policy "service role full access" on media_files for all
  to service_role using (true) with check (true);
create policy "service role full access" on social_channels_v2 for all
  to service_role using (true) with check (true);
create policy "service role full access" on publish_jobs for all
  to service_role using (true) with check (true);
create policy "service role full access" on publish_history for all
  to service_role using (true) with check (true);
create policy "service role full access" on publish_analytics for all
  to service_role using (true) with check (true);
