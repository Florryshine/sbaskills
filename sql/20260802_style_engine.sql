-- ─── Style Engine: podcast + study notes style columns ───────────────────
-- Run in the Supabase SQL Editor. Safe to re-run.

-- Which style generated each podcast episode (for traceability + regenerate).
alter table public.podcast_episodes
  add column if not exists style text not null default 'qa_conversation';

-- Optional per-asset default so "Generate Podcast" from a knowledge asset
-- already knows which style you usually want for that kind of topic
-- (e.g. always Deep Dive for your AI Audio Academy assets). Nullable —
-- when null, the app falls back to 'qa_conversation'.
alter table public.knowledge_assets
  add column if not exists default_podcast_style text;

-- Which style generated each study note draft.
alter table public.study_note_drafts
  add column if not exists style text not null default 'note_only';

-- Optional per-asset default for study notes, same idea as podcasts.
alter table public.knowledge_assets
  add column if not exists default_study_note_style text;
