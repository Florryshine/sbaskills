-- Quiz attempt lifecycle tracking for manual quizzes.
-- Existing completed attempts remain intact; status is inferred where possible.
alter table public.quiz_attempts
  add column if not exists status text not null default 'completed',
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.quiz_attempts
set status = case when completed_at is null then 'in_progress' else 'completed' end
where status is null or status = '';

update public.quiz_attempts
set started_at = coalesce(started_at, completed_at),
    updated_at = coalesce(updated_at, completed_at)
where started_at is null or updated_at is null;

create index if not exists quiz_attempts_quiz_status_updated_idx
  on public.quiz_attempts (quiz_id, status, updated_at desc);
create index if not exists quiz_attempts_student_quiz_completed_idx
  on public.quiz_attempts (student_id, quiz_id, completed_at desc);
