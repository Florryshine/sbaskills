-- Universal learning engine foundation
-- Reuses existing knowledge_assets, game_topics, past_questions and JAMB practice.
-- No exam-specific duplicate engine is introduced.

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  exam_type text not null,
  year integer,
  status text not null default 'active',
  exam_start_date date,
  exam_end_date date,
  date_status text not null default 'working',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curricula_status_check check (status in ('draft','active','archived')),
  constraint curricula_date_status_check check (date_status in ('official','working','proposed','unknown'))
);

create table if not exists public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  subject text not null,
  title text not null,
  order_index integer,
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  game_topic_id uuid references public.game_topics(id) on delete set null,
  syllabus_text text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (curriculum_id, subject, title)
);

create index if not exists idx_curriculum_topics_curriculum on public.curriculum_topics(curriculum_id);
create index if not exists idx_curriculum_topics_game_topic on public.curriculum_topics(game_topic_id);
create index if not exists idx_curriculum_topics_asset on public.curriculum_topics(knowledge_asset_id);

alter table public.curricula enable row level security;
alter table public.curriculum_topics enable row level security;

drop policy if exists "Authenticated users can read curricula" on public.curricula;
create policy "Authenticated users can read curricula" on public.curricula for select to authenticated using (true);

drop policy if exists "Admins manage curricula" on public.curricula;
create policy "Admins manage curricula" on public.curricula for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Authenticated users can read curriculum topics" on public.curriculum_topics;
create policy "Authenticated users can read curriculum topics" on public.curriculum_topics for select to authenticated using (true);

drop policy if exists "Admins manage curriculum topics" on public.curriculum_topics;
create policy "Admins manage curriculum topics" on public.curriculum_topics for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.curricula
  (code, name, exam_type, year, status, exam_start_date, exam_end_date, date_status, source)
values
  ('JAMB_UTME_2027', 'JAMB UTME 2027', 'JAMB', 2027, 'active',
   '2027-03-15', '2027-03-25', 'working',
   'Working date supplied for SBA planning; replace when JAMB officially confirms the 2027 UTME schedule.')
on conflict (code) do update set
  name = excluded.name,
  exam_type = excluded.exam_type,
  year = excluded.year,
  status = excluded.status,
  exam_start_date = excluded.exam_start_date,
  exam_end_date = excluded.exam_end_date,
  date_status = excluded.date_status,
  source = excluded.source,
  updated_at = now();

-- Connect the already-published SBA topic graph to the new curriculum layer.
-- This is deliberately NOT presented as the complete official JAMB syllabus.
insert into public.curriculum_topics
  (curriculum_id, subject, title, order_index, knowledge_asset_id, game_topic_id, source)
select
  c.id,
  coalesce(gt.subject, ka.subject, 'General'),
  gt.title,
  gt.order_index,
  gt.knowledge_asset_id,
  gt.id,
  'Existing SBA published topic graph'
from public.game_topics gt
join public.knowledge_assets ka on ka.id = gt.knowledge_asset_id
cross join public.curricula c
where c.code = 'JAMB_UTME_2027'
  and (
    ka.exam_type @> array['JAMB']::text[]
    or ka.exam_type @> array['JAMB UTME']::text[]
    or lower(coalesce(gt.subject,'')) <> ''
  )
on conflict (curriculum_id, subject, title) do update set
  order_index = excluded.order_index,
  knowledge_asset_id = excluded.knowledge_asset_id,
  game_topic_id = excluded.game_topic_id,
  updated_at = now();

create table if not exists public.student_daily_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  mission_date date not null,
  title text not null default 'Today''s Mission',
  status text not null default 'ready',
  target_minutes integer not null default 20,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, curriculum_id, mission_date),
  constraint student_daily_missions_status_check check (status in ('ready','in_progress','completed','expired'))
);

create index if not exists idx_student_daily_missions_user_date
  on public.student_daily_missions(user_id, mission_date desc);

create table if not exists public.student_daily_mission_items (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.student_daily_missions(id) on delete cascade,
  item_order integer not null,
  activity_type text not null,
  subject text,
  topic text,
  question_ids uuid[] not null default '{}',
  knowledge_asset_id uuid references public.knowledge_assets(id) on delete set null,
  game_topic_id uuid references public.game_topics(id) on delete set null,
  target_count integer not null default 10,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (mission_id, item_order)
);

create index if not exists idx_daily_mission_items_mission on public.student_daily_mission_items(mission_id);

alter table public.student_daily_missions enable row level security;
alter table public.student_daily_mission_items enable row level security;

drop policy if exists "Students read own daily missions" on public.student_daily_missions;
create policy "Students read own daily missions" on public.student_daily_missions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Students update own daily missions" on public.student_daily_missions;
create policy "Students update own daily missions" on public.student_daily_missions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Students read own daily mission items" on public.student_daily_mission_items;
create policy "Students read own daily mission items" on public.student_daily_mission_items for select to authenticated
using (exists (select 1 from public.student_daily_missions m where m.id = mission_id and m.user_id = auth.uid()));

create table if not exists public.student_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_student_notifications_user_created
  on public.student_notifications(user_id, created_at desc);

alter table public.student_notifications enable row level security;

drop policy if exists "Students read own notifications" on public.student_notifications;
create policy "Students read own notifications" on public.student_notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Students update own notifications" on public.student_notifications;
create policy "Students update own notifications" on public.student_notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin/service-role writes are intentionally left to the service role used by
-- the scheduled worker; students cannot manufacture notifications or missions.

create or replace function public.set_universal_learning_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_curricula_updated_at on public.curricula;
create trigger trg_curricula_updated_at before update on public.curricula
for each row execute function public.set_universal_learning_updated_at();

drop trigger if exists trg_curriculum_topics_updated_at on public.curriculum_topics;
create trigger trg_curriculum_topics_updated_at before update on public.curriculum_topics
for each row execute function public.set_universal_learning_updated_at();


-- Admin upload staging: syllabus files can be uploaded as TXT/CSV/XLSX/DOCX/PDF
-- and parsed later. No syllabus content is required now.
create table if not exists public.curriculum_source_documents (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  storage_path text,
  extracted_text text,
  status text not null default 'uploaded',
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_source_documents_status_check check (status in ('uploaded','processing','parsed','failed','archived'))
);
create index if not exists idx_curriculum_source_documents_curriculum on public.curriculum_source_documents(curriculum_id);
alter table public.curriculum_source_documents enable row level security;
drop policy if exists "Admins manage curriculum source documents" on public.curriculum_source_documents;
create policy "Admins manage curriculum source documents" on public.curriculum_source_documents for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
