-- JAMB Practice Engine
-- Stores scored practice sessions without replacing the existing quiz system.

create table if not exists public.jamb_practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'mixed',
  subject text,
  topic text,
  question_ids uuid[] not null default '{}',
  answers jsonb not null default '{}'::jsonb,
  score integer not null default 0,
  total_questions integer not null default 0,
  weak_topics text[] not null default '{}',
  completed_at timestamptz not null default now()
);

create index if not exists idx_jamb_practice_attempts_user
  on public.jamb_practice_attempts(user_id, completed_at desc);

alter table public.jamb_practice_attempts enable row level security;

drop policy if exists "Students can view own JAMB practice attempts" on public.jamb_practice_attempts;
create policy "Students can view own JAMB practice attempts"
  on public.jamb_practice_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Students can create own JAMB practice attempts" on public.jamb_practice_attempts;
create policy "Students can create own JAMB practice attempts"
  on public.jamb_practice_attempts
  for insert
  with check (auth.uid() = user_id);
