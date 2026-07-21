-- 20260721_past_questions.sql
-- Safe to run multiple times. Run in Supabase SQL editor.
--
-- past_questions has been referenced by three separate places in the
-- codebase (app/admin/past-questions/upload/page.js,
-- lib/syncQuizToPastQuestions.js, lib/syncBossBattleDraftToPastQuestions.js)
-- and read by three more (app/challenge/page.js, app/boss/page.js,
-- app/tools/past-questions/PastQuestionsClient.js) but was never created
-- by a migration -- it only ever existed (if at all) as something set up
-- by hand in the Supabase dashboard. That's the root cause of "no schema
-- found" on past-questions upload. This migration creates it with the
-- exact column shape every one of those call sites already assumes.
--
-- Design intent (per lib/syncQuizToPastQuestions.js): this is meant to be
-- a permanent, growing question bank feeding boss battles, daily
-- challenges, and eventually a CBT exam feature -- so rows are never
-- deleted by normal publish/unpublish flows, only inserted or updated.

create table if not exists public.past_questions (
  id uuid primary key default gen_random_uuid(),
  subject text,
  topic text,
  year integer,
  exam_type text,
  question text not null,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text not null check (correct_answer in ('a', 'b', 'c', 'd')),
  explanation text,
  difficulty integer,
  source_type text,
  source_id uuid,
  question_hash text,
  created_at timestamptz not null default now()
);

-- syncQuizToPastQuestions.js dedups on question_hash before deciding
-- insert vs update -- this index is what makes that lookup fast and
-- also what keeps the same question from being duplicated on re-sync.
create unique index if not exists past_questions_question_hash_idx
  on public.past_questions (question_hash)
  where question_hash is not null;

-- Both sync helpers look up/delete by (source_type, source_id) when a
-- quiz or boss-battle draft is republished.
create index if not exists past_questions_source_idx
  on public.past_questions (source_type, source_id);

-- PastQuestionsClient.js filters/searches by these on every query.
create index if not exists past_questions_subject_idx on public.past_questions (subject);
create index if not exists past_questions_exam_type_idx on public.past_questions (exam_type);
create index if not exists past_questions_year_idx on public.past_questions (year);

-- Full-text search index backing PastQuestionsClient.js's
-- .textSearch('question', ...) call.
create index if not exists past_questions_question_fts_idx
  on public.past_questions using gin (to_tsvector('english', question));

alter table public.past_questions enable row level security;

-- Students browse/search past questions directly from the client
-- (app/tools/past-questions/PastQuestionsClient.js, app/boss/page.js,
-- app/challenge/page.js all select('*') as the logged-in user) -- so
-- reads need to be open to any authenticated user, same as other
-- student-facing content tables in this project.
drop policy if exists "Authenticated users can read past questions" on public.past_questions;
create policy "Authenticated users can read past questions"
  on public.past_questions for select
  to authenticated
  using (true);

-- Writes only ever happen from admin pages and server-side sync helpers
-- (using the service role client), never directly from a student-facing
-- page -- same restricted-write pattern as the social engine and video
-- scripts migrations.
drop policy if exists "service role full access" on public.past_questions;
create policy "service role full access"
  on public.past_questions for all
  to service_role
  using (true)
  with check (true);
