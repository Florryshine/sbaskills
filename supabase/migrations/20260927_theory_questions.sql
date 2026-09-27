create table if not exists public.theory_questions (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  subject text not null,
  topic text not null,
  exam_type text[] not null default '{}',
  question text not null,
  marking_points jsonb not null default '[]'::jsonb,
  model_answer text,
  explanation text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint theory_questions_status_check check (status in ('draft','published'))
);

create index if not exists idx_theory_questions_asset on public.theory_questions(knowledge_asset_id);
create index if not exists idx_theory_questions_subject_topic on public.theory_questions(subject, topic);
create index if not exists idx_theory_questions_exam_type on public.theory_questions using gin(exam_type);
create index if not exists idx_theory_questions_status on public.theory_questions(status);

alter table public.theory_questions enable row level security;

drop policy if exists "Students can view published theory questions" on public.theory_questions;
create policy "Students can view published theory questions"
  on public.theory_questions
  for select
  using (status = 'published');

drop policy if exists "Authenticated admins can manage theory questions" on public.theory_questions;
create policy "Authenticated admins can manage theory questions"
  on public.theory_questions
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

comment on table public.theory_questions is 'WAEC/NECO theory practice. One question can apply to both exams; marking points are revealed after submission.';
