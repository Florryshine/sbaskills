-- Store teacher-provided explanations for manually created quizzes.
-- Safe to run repeatedly and preserves all existing quiz questions.
alter table if exists public.quiz_questions
  add column if not exists explanation text;
