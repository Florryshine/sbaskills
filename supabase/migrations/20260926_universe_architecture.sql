-- Build 6A: student learning worlds for course-level experience routing.
-- Content-level exam relevance remains separate (knowledge_assets.exam_type).

alter table public.courses
  add column if not exists universe text not null default 'GENERAL';

alter table public.courses
  drop constraint if exists courses_universe_check;

alter table public.courses
  add constraint courses_universe_check
  check (universe in ('JAMB', 'WAEC_NECO', 'POST_UTME', 'UNIVERSITY', 'AI_SKILLS', 'GENERAL'));

create index if not exists idx_courses_universe on public.courses(universe);
create index if not exists idx_courses_universe_published on public.courses(universe, is_published);
