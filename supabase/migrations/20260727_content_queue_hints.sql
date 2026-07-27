-- 20260727_content_queue_hints.sql
-- Adds optional admin-provided hint columns to content_queue.
-- These are NOT authoritative — the generation step still does full
-- research and writes its own subject/exam_type/learning_objectives to
-- knowledge_assets. These hints just steer that research toward the exact
-- exam context the admin already knows, instead of the AI guessing cold
-- from keyword + category alone.
--
-- All columns nullable/default-empty so existing rows and the old
-- 3-column CSV format keep working unchanged.
-- Safe to run multiple times.

alter table content_queue
  add column if not exists subject_hint text;

alter table content_queue
  add column if not exists exam_type_hint text[] not null default '{}';

alter table content_queue
  add column if not exists learning_objectives_hint text[] not null default '{}';

comment on column content_queue.subject_hint is
  'Optional admin-provided subject hint (e.g. Chemistry) to steer AI research. Not authoritative — AI still determines final subject.';

comment on column content_queue.exam_type_hint is
  'Optional admin-provided exam type hint(s) (e.g. {JAMB,WAEC}) to steer AI research. Not authoritative — AI still determines final exam_type.';

comment on column content_queue.learning_objectives_hint is
  'Optional admin-provided learning objective hints to steer AI research toward exact exam context instead of generic coverage. AI still writes its own final learning_objectives.';
