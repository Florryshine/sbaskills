-- Phase C: curriculum hierarchy + official IBASS source metadata

alter table public.curriculum_source_documents
  add column if not exists source_url text,
  add column if not exists source_subject text,
  add column if not exists extracted_chars integer;

create index if not exists idx_curriculum_source_documents_source_url
  on public.curriculum_source_documents(source_url);

alter table public.curriculum_topics
  add column if not exists parent_id uuid references public.curriculum_topics(id) on delete cascade,
  add column if not exists node_type text not null default 'topic',
  add column if not exists code text,
  add column if not exists description text;

alter table public.curriculum_topics
  drop constraint if exists curriculum_topics_node_type_check;

alter table public.curriculum_topics
  add constraint curriculum_topics_node_type_check
  check (node_type in ('section','topic','subtopic'));

create index if not exists idx_curriculum_topics_parent
  on public.curriculum_topics(parent_id);

create table if not exists public.curriculum_objectives (
  id uuid primary key default gen_random_uuid(),
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete cascade,
  objective_text text not null,
  order_index integer,
  source text,
  created_at timestamptz not null default now(),
  unique (curriculum_topic_id, objective_text)
);

create index if not exists idx_curriculum_objectives_topic
  on public.curriculum_objectives(curriculum_topic_id);

alter table public.curriculum_objectives enable row level security;

drop policy if exists "Authenticated users can read curriculum objectives" on public.curriculum_objectives;
create policy "Authenticated users can read curriculum objectives"
  on public.curriculum_objectives for select to authenticated using (true);

drop policy if exists "Admins manage curriculum objectives" on public.curriculum_objectives;
create policy "Admins manage curriculum objectives"
  on public.curriculum_objectives for all to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

-- IBASS source metadata is intentionally staged; publishing/parsing comes next.