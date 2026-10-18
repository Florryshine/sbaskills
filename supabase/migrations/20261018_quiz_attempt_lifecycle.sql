-- Quiz attempt lifecycle tracking for manual quizzes.
-- Existing completed attempts remain intact; status is inferred where possible.
alter table public.quiz_attempts
  add column if not exists status text not null default 'completed',
  add column if not exists started_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.quiz_attempts
set status = case when completed_at is null then 'in_progress' else 'completed' end
where status is null or status = '' or (completed_at is null and status = 'completed');

update public.quiz_attempts
set started_at = coalesce(started_at, completed_at),
    updated_at = coalesce(updated_at, completed_at)
where started_at is null or updated_at is null;

create index if not exists quiz_attempts_quiz_status_updated_idx
  on public.quiz_attempts (quiz_id, status, updated_at desc);
create index if not exists quiz_attempts_student_quiz_completed_idx
  on public.quiz_attempts (student_id, quiz_id, completed_at desc);

-- Restrict attempt access to the student who owns it and tutors who own the quiz.
alter table public.quiz_attempts enable row level security;

drop policy if exists "Students read own quiz attempts" on public.quiz_attempts;
create policy "Students read own quiz attempts"
  on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "Students create own quiz attempts" on public.quiz_attempts;
create policy "Students create own quiz attempts"
  on public.quiz_attempts for insert to authenticated
  with check (student_id = auth.uid());

drop policy if exists "Students update own quiz attempts" on public.quiz_attempts;
create policy "Students update own quiz attempts"
  on public.quiz_attempts for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

drop policy if exists "Tutors read attempts for their quizzes" on public.quiz_attempts;
create policy "Tutors read attempts for their quizzes"
  on public.quiz_attempts for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_attempts.quiz_id and q.tutor_id = auth.uid()
    )
  );

grant select, insert, update on public.quiz_attempts to authenticated;

-- Published manual quizzes and their questions are readable before sign-in.
-- This grants read-only access only; all attempt writes remain authenticated.
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;

drop policy if exists "Anyone can read published quizzes" on public.quizzes;
create policy "Anyone can read published quizzes"
  on public.quizzes for select to anon, authenticated
  using (is_published = true);

drop policy if exists "Anyone can read questions in published quizzes" on public.quiz_questions;
create policy "Anyone can read questions in published quizzes"
  on public.quiz_questions for select to anon, authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_questions.quiz_id and q.is_published = true
    )
  );

grant select on public.quizzes, public.quiz_questions to anon, authenticated;
