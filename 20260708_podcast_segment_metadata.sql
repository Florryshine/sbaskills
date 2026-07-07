-- ─── Podcast segment metadata (additive only, no existing columns touched) ──
-- Safe to run on top of 20260707_podcast_engine.sql. Existing rows get sane
-- defaults so nothing that already reads podcast_segments breaks.

alter table public.podcast_segments
  add column if not exists topic text,
  add column if not exists keywords jsonb not null default '[]'::jsonb,
  add column if not exists exam_tip boolean not null default false,
  add column if not exists difficulty text check (difficulty in ('easy', 'medium', 'hard') or difficulty is null),
  add column if not exists estimated_duration_seconds numeric;

-- Useful for the Phase-2 player filters ("show only exam tips", etc.)
create index if not exists idx_podcast_segments_exam_tip
  on public.podcast_segments (episode_id, exam_tip) where exam_tip = true;

create index if not exists idx_podcast_segments_topic
  on public.podcast_segments (episode_id, topic);
