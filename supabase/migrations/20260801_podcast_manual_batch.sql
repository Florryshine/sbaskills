-- ─── Podcast: manual/playbook text + batch series support ────────────────
-- Run this in the Supabase SQL editor (or `supabase db push`).
-- Idempotent — safe to re-run.

-- Lets raw pasted/playbook text skip the structured-research pipeline and
-- go straight to podcast generation, without pretending it's AI research.
alter table public.knowledge_assets
  add column if not exists raw_content text;

alter table public.knowledge_assets
  add column if not exists source text not null default 'ai_research';
comment on column public.knowledge_assets.source is
  'ai_research | ai_playbook | manual_paste | manual_paste_batch | blog_post';

-- Traceability (which asset an episode came from) + batching (series of
-- episodes split from one long paste) on podcast_episodes.
alter table public.podcast_episodes
  add column if not exists knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null;

alter table public.podcast_episodes
  add column if not exists series_id uuid;

alter table public.podcast_episodes
  add column if not exists series_title text;

alter table public.podcast_episodes
  add column if not exists episode_number integer;

create index if not exists idx_podcast_episodes_knowledge_asset
  on public.podcast_episodes (knowledge_asset_id);

create index if not exists idx_podcast_episodes_series
  on public.podcast_episodes (series_id, episode_number);

-- ─── Batch job tracking ────────────────────────────────────────────────
-- A long paste can split into 8-18 episodes, each with its own script +
-- TTS pass — far past any serverless request's time budget. Mirrors the
-- books.generation_status pattern (see 20260730_book_generation_jobs.sql):
-- generate-batch/route.js creates this row and returns immediately with
-- id = seriesId while the actual split + per-episode generation runs in
-- the background (lib/backgroundTask.js's runInBackground). The admin
-- paste-text page polls GET .../generate-batch/status?seriesId=... until
-- status is 'ready' or 'failed'.
create table if not exists public.podcast_batch_jobs (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  series_title text not null,
  status text not null default 'queued'
    check (status in ('queued', 'splitting', 'generating', 'ready', 'failed')),
  episode_count integer,
  completed_count integer not null default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_podcast_batch_jobs_created
  on public.podcast_batch_jobs (created_at desc);
