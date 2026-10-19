-- Add the quiz attempt lifecycle fields required by the student performance dashboard.
-- Preserve existing rows and existing RLS policies.
alter table public.quiz_attempts
  add column if not exists status text not null default 'completed',
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.quiz_attempts
set status = case when completed_at is null then 'in_progress' else 'completed' end
where status is null or status = '' or (completed_at is null and status = 'completed');

update public.quiz_attempts
set started_at = coalesce(started_at, created_at, completed_at, now()),
    updated_at = coalesce(updated_at, completed_at, created_at, now())
where started_at is null or updated_at is null;

create index if not exists quiz_attempts_quiz_status_updated_idx
  on public.quiz_attempts (quiz_id, status, updated_at desc);
create index if not exists quiz_attempts_student_quiz_completed_idx
  on public.quiz_attempts (student_id, quiz_id, completed_at desc);

-- The existing "Students can view own attempts" policy already includes is_admin().
-- Do not replace existing student/tutor policies here.
