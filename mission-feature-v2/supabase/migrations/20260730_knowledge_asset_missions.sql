-- ============================================================================
-- knowledge_asset_missions
--
-- Optional, hand-authored mission step order for specific knowledge_assets.
-- This is the "Option 2" extension point referenced in lib/journeyEngine.js
-- (fetchCustomMissionOrder). It is entirely optional: the Journey Engine
-- auto-builds a step order from whatever content exists for a topic
-- (DEFAULT_STEP_ORDER in journeyEngine.js) whenever no row exists here.
--
-- Use this table only for topics where you want a deliberately different,
-- hand-designed flow (flagship lessons, launch-day topics, etc.) instead of
-- the automatic default. Most topics should have NO row here.
--
-- step_order is a simple JSON array of activity type strings, e.g.:
--   ["study_note", "memory_game", "flashcards", "quiz", "boss_battle"]
--
-- Valid activity type strings match the keys in journeyEngine.js's
-- DEFAULT_STEP_ORDER / STEP_XP objects: study_note, video, podcast,
-- flashcards, memory_game, quiz, boss_battle. Any step type listed here
-- that has no actual published content for the asset is silently skipped
-- by buildSteps() in the engine — so it's safe to list an activity type
-- speculatively before its content exists.
-- ============================================================================

create table if not exists public.knowledge_asset_missions (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  step_order jsonb not null default '[]'::jsonb,
  notes text, -- optional: why this topic gets a custom flow, for admin reference
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (knowledge_asset_id)
);

comment on table public.knowledge_asset_missions is
  'Optional hand-authored mission step order overriding the Journey Engine''s auto-built default for a specific topic. Absence of a row here is the normal case.';

comment on column public.knowledge_asset_missions.step_order is
  'Ordered JSON array of activity type strings, e.g. ["study_note","flashcards","quiz","boss_battle"]. Types with no published content for this asset are skipped automatically.';

-- Keep updated_at current on edits, matching the pattern likely used
-- elsewhere in this schema for editable admin content.
create or replace function public.set_knowledge_asset_missions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_knowledge_asset_missions_updated_at on public.knowledge_asset_missions;
create trigger trg_knowledge_asset_missions_updated_at
  before update on public.knowledge_asset_missions
  for each row execute procedure public.set_knowledge_asset_missions_updated_at();

-- RLS: readable by any authenticated user (needed so the Journey Engine can
-- read it as the logged-in student via the anon-key route handler client,
-- consistent with how other content tables like quizzes/boss_battles are
-- read in this repo). Writes restricted to admins only.
alter table public.knowledge_asset_missions enable row level security;

drop policy if exists "knowledge_asset_missions_select_authenticated" on public.knowledge_asset_missions;
create policy "knowledge_asset_missions_select_authenticated"
  on public.knowledge_asset_missions
  for select
  to authenticated
  using (true);

drop policy if exists "knowledge_asset_missions_admin_write" on public.knowledge_asset_missions;
create policy "knowledge_asset_missions_admin_write"
  on public.knowledge_asset_missions
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create index if not exists idx_knowledge_asset_missions_asset_id
  on public.knowledge_asset_missions (knowledge_asset_id);
