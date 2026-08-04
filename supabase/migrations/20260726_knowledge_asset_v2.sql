-- ============================================================================
-- Knowledge Asset Schema v2
-- Extends the existing knowledge_assets table (created ad hoc in the Supabase
-- SQL editor, not previously tracked in migrations — this file is additive
-- and safe to run regardless of exact current column state).
--
-- Adds the fields identified as missing from the "Curriculum Engine" plan:
-- learning objectives, exam type, estimated study duration, prerequisites,
-- and related topics. sub_topics already exists and is left untouched.
--
-- Nothing here drops or renames existing columns. Safe to run multiple times.
-- ============================================================================

-- Learning objectives: what a student should be able to do after studying
-- this topic. Array of short strings, e.g. "Define isotopes.",
-- "Differentiate isotopes from isobars."
alter table knowledge_assets
  add column if not exists learning_objectives jsonb not null default '[]'::jsonb;

-- Which exam(s) this topic is relevant for. Array because most topics span
-- more than one exam (e.g. Atomic Structure matters for both JAMB and WAEC).
alter table knowledge_assets
  add column if not exists exam_type text[] not null default '{}';

-- Estimated time (minutes) for a student to work through this topic's
-- content end-to-end (lesson + quiz). Used for "Chapter 4/15, ~25 min" style
-- progress UI later; nullable because AI estimates are rough and admins may
-- prefer to leave it unset until they've reviewed the content.
alter table knowledge_assets
  add column if not exists estimated_duration_minutes integer;

-- Prerequisites: other knowledge_assets a student should understand first.
-- Stored as an array of knowledge_asset ids rather than a join table —
-- simple ordered list, no extra metadata needed per prerequisite.
alter table knowledge_assets
  add column if not exists prerequisite_ids uuid[] not null default '{}';

-- Related topics: softer than prerequisites — "see also" links, also stored
-- as knowledge_asset ids. Powers "Related Topics" sections without needing
-- a join table.
alter table knowledge_assets
  add column if not exists related_asset_ids uuid[] not null default '{}';

-- Sanity constraint: keep exam_type values from drifting into typos over time.
-- (Not enforced as a hard check constraint since array + check is awkward in
-- Postgres and the app already validates on the way in; documented here for
-- reference.)
comment on column knowledge_assets.exam_type is
  'Array of exam codes this topic applies to. Expected values: JAMB, WAEC, NECO, POST_UTME, GENERAL.';

comment on column knowledge_assets.learning_objectives is
  'Array of short student-facing objective strings, e.g. "Define isotopes."';

comment on column knowledge_assets.prerequisite_ids is
  'knowledge_assets.id values that should be studied before this one.';

comment on column knowledge_assets.related_asset_ids is
  'knowledge_assets.id values that are related but not required first.';

-- Helpful indexes for the admin filter UI and future recommendation logic.
create index if not exists idx_knowledge_assets_exam_type on knowledge_assets using gin (exam_type);
create index if not exists idx_knowledge_assets_prerequisite_ids on knowledge_assets using gin (prerequisite_ids);
