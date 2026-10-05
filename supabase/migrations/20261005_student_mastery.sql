create table if not exists public.student_topic_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_topic_id uuid not null references public.curriculum_topics(id) on delete cascade,
  questions_attempted integer not null default 0,
  questions_correct integer not null default 0,
  accuracy numeric(5,2) not null default 0,
  mastery_score integer not null default 0,
  status text not null default 'not_started',
  last_practiced_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(user_id, curriculum_topic_id),
  constraint student_topic_mastery_status_check check (status in ('not_started','weak','learning','mastered'))
);

create index if not exists idx_student_topic_mastery_user on public.student_topic_mastery(user_id);
create index if not exists idx_student_topic_mastery_topic on public.student_topic_mastery(curriculum_topic_id);
alter table public.student_topic_mastery enable row level security;
drop policy if exists "Students read own topic mastery" on public.student_topic_mastery;
create policy "Students read own topic mastery" on public.student_topic_mastery for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Students update own topic mastery" on public.student_topic_mastery;
create policy "Students update own topic mastery" on public.student_topic_mastery for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.student_subject_mastery (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  subject text not null,
  topics_total integer not null default 0,
  topics_started integer not null default 0,
  topics_mastered integer not null default 0,
  mastery_percent integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, curriculum_id, subject)
);
alter table public.student_subject_mastery enable row level security;
drop policy if exists "Students read own subject mastery" on public.student_subject_mastery;
create policy "Students read own subject mastery" on public.student_subject_mastery for select to authenticated using (auth.uid() = user_id);

create table if not exists public.student_progress_summary (
  user_id uuid not null references auth.users(id) on delete cascade,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  topics_total integer not null default 0,
  topics_started integer not null default 0,
  topics_mastered integer not null default 0,
  mastery_percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key(user_id, curriculum_id)
);
alter table public.student_progress_summary enable row level security;
drop policy if exists "Students read own progress summary" on public.student_progress_summary;
create policy "Students read own progress summary" on public.student_progress_summary for select to authenticated using (auth.uid() = user_id);

create or replace function public.refresh_student_curriculum_mastery(p_user_id uuid, p_curriculum_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into student_topic_mastery (user_id, curriculum_topic_id)
  select p_user_id, ct.id
  from curriculum_topics ct
  where ct.curriculum_id = p_curriculum_id
  on conflict (user_id, curriculum_topic_id) do nothing;

  update student_topic_mastery stm
  set status = case
      when stm.mastery_score >= 80 then 'mastered'
      when stm.mastery_score >= 60 then 'learning'
      when stm.questions_attempted > 0 then 'weak'
      else 'not_started'
    end,
    updated_at = now()
  from curriculum_topics ct
  where stm.curriculum_topic_id = ct.id
    and stm.user_id = p_user_id
    and ct.curriculum_id = p_curriculum_id;

  insert into student_subject_mastery
    (user_id, curriculum_id, subject, topics_total, topics_started, topics_mastered, mastery_percent)
  select
    p_user_id, p_curriculum_id, ct.subject,
    count(*)::int,
    count(*) filter (where stm.status <> 'not_started')::int,
    count(*) filter (where stm.status = 'mastered')::int,
    coalesce(round(avg(stm.mastery_score))::int, 0)
  from curriculum_topics ct
  left join student_topic_mastery stm
    on stm.curriculum_topic_id = ct.id and stm.user_id = p_user_id
  where ct.curriculum_id = p_curriculum_id
  group by ct.subject
  on conflict (user_id, curriculum_id, subject) do update set
    topics_total = excluded.topics_total,
    topics_started = excluded.topics_started,
    topics_mastered = excluded.topics_mastered,
    mastery_percent = excluded.mastery_percent,
    updated_at = now();

  insert into student_progress_summary
    (user_id, curriculum_id, topics_total, topics_started, topics_mastered, mastery_percent)
  select
    p_user_id, p_curriculum_id,
    count(*)::int,
    count(*) filter (where stm.status <> 'not_started')::int,
    count(*) filter (where stm.status = 'mastered')::int,
    coalesce(round(avg(stm.mastery_score))::int, 0)
  from curriculum_topics ct
  left join student_topic_mastery stm
    on stm.curriculum_topic_id = ct.id and stm.user_id = p_user_id
  where ct.curriculum_id = p_curriculum_id
  on conflict (user_id, curriculum_id) do update set
    topics_total = excluded.topics_total,
    topics_started = excluded.topics_started,
    topics_mastered = excluded.topics_mastered,
    mastery_percent = excluded.mastery_percent,
    updated_at = now();
end;
$$;