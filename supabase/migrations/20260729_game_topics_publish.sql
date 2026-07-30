-- Student-facing "published" projection of a knowledge_asset. Students never
-- read knowledge_assets directly (it's the admin authoring table, and every
-- other student-facing content type — quizzes, flashcards, boss battles —
-- already follows this same publish-a-copy pattern rather than reading the
-- authoring table live). This gives games the same treatment.

create table if not exists public.game_topics (
  id uuid primary key default gen_random_uuid(),
  knowledge_asset_id uuid not null references public.knowledge_assets(id) on delete cascade,
  title text not null,
  subject text,
  definitions jsonb default '[]'::jsonb,
  prerequisite_game_topic_ids uuid[] default '{}',  -- remapped at publish time to OTHER game_topics.id values, never knowledge_asset ids
  order_index integer,
  published_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (knowledge_asset_id)
);

create index if not exists idx_game_topics_knowledge_asset_id
  on public.game_topics (knowledge_asset_id);

alter table public.game_topics enable row level security;

drop policy if exists "Anyone authenticated can read game topics" on public.game_topics;
create policy "Anyone authenticated can read game topics" on public.game_topics
  for select to authenticated using (true);

drop policy if exists "Admin can manage game topics" on public.game_topics;
create policy "Admin can manage game topics" on public.game_topics
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

drop trigger if exists update_game_topics_timestamp on public.game_topics;
create trigger update_game_topics_timestamp
  before update on public.game_topics
  for each row execute function public.update_sequence_and_progress_timestamp();
  -- reuses the standalone trigger function created in
  -- 20260728_sequence_and_topic_progress_v2.sql

-- Published copy of sequence_steps, keyed to game_topics instead of
-- knowledge_assets. The original sequence_steps table stays exactly as-is
-- and remains the admin-authoring copy.

create table if not exists public.game_sequence_steps (
  id uuid primary key default gen_random_uuid(),
  game_topic_id uuid not null references public.game_topics(id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  label text not null,
  detail text,
  unique (game_topic_id, step_order)
);

create index if not exists idx_game_sequence_steps_game_topic_id
  on public.game_sequence_steps (game_topic_id);

alter table public.game_sequence_steps enable row level security;

drop policy if exists "Anyone authenticated can read game sequence steps" on public.game_sequence_steps;
create policy "Anyone authenticated can read game sequence steps" on public.game_sequence_steps
  for select to authenticated using (true);

drop policy if exists "Admin can manage game sequence steps" on public.game_sequence_steps;
create policy "Admin can manage game sequence steps" on public.game_sequence_steps
  for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
