-- ─── AI Podcast Engine: episodes + segments ──────────────────────────────
-- Run this in the Supabase SQL editor (or via `supabase db push` if you use
-- the CLI). Safe to re-run — uses IF NOT EXISTS throughout.

create table if not exists public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  content_draft_id uuid references public.content_drafts(id) on delete cascade,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'generating', 'ready', 'failed')),
  host_a_voice text not null default 'en-NG-EzinneNeural',
  host_b_voice text not null default 'en-US-AvaMultilingualNeural',
  total_duration_seconds numeric default 0,
  error_message text,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.podcast_segments (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.podcast_episodes(id) on delete cascade,
  position integer not null,
  speaker text not null check (speaker in ('host_a', 'host_b')),
  text text not null,
  emotion_tag text default 'neutral',
  audio_url text,
  duration_seconds numeric default 0,
  created_at timestamptz default now(),
  unique (episode_id, position)
);

-- One active episode lookup per post is common, index it
create index if not exists idx_podcast_episodes_content_draft
  on public.podcast_episodes (content_draft_id);

create index if not exists idx_podcast_segments_episode
  on public.podcast_segments (episode_id, position);

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.podcast_episodes enable row level security;
alter table public.podcast_segments enable row level security;

-- Public can read ready episodes/segments (same pattern as your other
-- public-read content tables)
drop policy if exists "Public can read ready podcast episodes" on public.podcast_episodes;
create policy "Public can read ready podcast episodes"
  on public.podcast_episodes for select
  using (status = 'ready');

drop policy if exists "Public can read segments of ready episodes" on public.podcast_segments;
create policy "Public can read segments of ready episodes"
  on public.podcast_segments for select
  using (
    exists (
      select 1 from public.podcast_episodes e
      where e.id = podcast_segments.episode_id and e.status = 'ready'
    )
  );

-- Writes go through the service-role key from the API routes only,
-- so no insert/update/delete policy is added for anon/authenticated.

-- ─── Storage bucket ───────────────────────────────────────────────────────
-- Create this once in Supabase Dashboard → Storage → New bucket:
--   name: podcast-audio
--   public: true
-- (Mirrors your existing "audio-files" bucket setup.)
