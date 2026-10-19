-- Flashcard and podcast completion already call completeActivity(), but the
-- original student_progress activity whitelist omitted both types. Keep the
-- database constraint aligned with the activity types used by the app.
alter table public.student_progress
  drop constraint if exists student_progress_activity_type_check;

alter table public.student_progress
  add constraint student_progress_activity_type_check
  check (activity_type = any (array[
    'blog'::text,
    'audio'::text,
    'lesson'::text,
    'course'::text,
    'quiz'::text,
    'assignment'::text,
    'flashcard'::text,
    'podcast'::text
  ]));
