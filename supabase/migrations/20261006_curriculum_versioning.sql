-- Curriculum versions are reusable across exam years.
-- Keep exam year separate from the curriculum's effective period.

alter table public.curricula
  add column if not exists version text,
  add column if not exists effective_from_year integer,
  add column if not exists effective_to_year integer;

create index if not exists idx_curricula_exam_type_effective_year
  on public.curricula(exam_type, effective_from_year, effective_to_year);

update public.curricula
set
  code = 'JAMB_UTME_2026_2029',
  name = 'JAMB UTME Curriculum 2026–2029',
  version = '2026–2029',
  effective_from_year = 2026,
  effective_to_year = 2029,
  year = null,
  updated_at = now()
where code = 'JAMB_UTME_2027';

insert into public.curricula (
  code, name, exam_type, year, status,
  exam_start_date, exam_end_date, date_status, source,
  version, effective_from_year, effective_to_year
)
select
  'JAMB_UTME_2026_2029',
  'JAMB UTME Curriculum 2026–2029',
  'JAMB',
  null,
  'active',
  '2027-03-15',
  '2027-03-25',
  'working',
  'Working date supplied for SBA planning; replace when JAMB officially confirms the 2027 UTME schedule.',
  '2026–2029',
  2026,
  2029
where not exists (
  select 1 from public.curricula where code = 'JAMB_UTME_2026_2029'
);

create or replace function public.get_curriculum_for_exam_year(
  p_exam_type text,
  p_exam_year integer
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.curricula
  where upper(exam_type) = upper(p_exam_type)
    and status = 'active'
    and effective_from_year is not null
    and effective_to_year is not null
    and p_exam_year between effective_from_year and effective_to_year
  order by effective_from_year desc
  limit 1;
$$;

revoke all on function public.get_curriculum_for_exam_year(text, integer) from public;
grant execute on function public.get_curriculum_for_exam_year(text, integer) to authenticated;

create table if not exists public.student_exam_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_type text not null,
  exam_year integer not null,
  curriculum_id uuid references public.curricula(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_exam_targets_status_check
    check (status in ('active', 'completed', 'cancelled')),
  unique (user_id, exam_type, exam_year)
);

create index if not exists idx_student_exam_targets_user
  on public.student_exam_targets(user_id);

create index if not exists idx_student_exam_targets_exam
  on public.student_exam_targets(exam_type, exam_year);

create index if not exists idx_student_exam_targets_curriculum
  on public.student_exam_targets(curriculum_id);

alter table public.student_exam_targets enable row level security;

drop policy if exists "Students read own exam targets"
on public.student_exam_targets;
create policy "Students read own exam targets"
on public.student_exam_targets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Students insert own exam targets"
on public.student_exam_targets;
create policy "Students insert own exam targets"
on public.student_exam_targets
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Students update own exam targets"
on public.student_exam_targets;
create policy "Students update own exam targets"
on public.student_exam_targets
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Students delete own exam targets"
on public.student_exam_targets;
create policy "Students delete own exam targets"
on public.student_exam_targets
for delete to authenticated
using (auth.uid() = user_id);

create or replace function public.set_student_exam_curriculum()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select c.id
  into new.curriculum_id
  from public.curricula c
  where upper(c.exam_type) = upper(new.exam_type)
    and c.status = 'active'
    and c.effective_from_year is not null
    and c.effective_to_year is not null
    and new.exam_year between c.effective_from_year and c.effective_to_year
  order by c.effective_from_year desc
  limit 1;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_student_exam_curriculum
on public.student_exam_targets;

create trigger trg_set_student_exam_curriculum
before insert or update of exam_type, exam_year
on public.student_exam_targets
for each row
execute function public.set_student_exam_curriculum();
