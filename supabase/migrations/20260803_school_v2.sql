-- 20260803_school_v2.sql
-- School MVP round 2, based on direct feedback from Principal (School 1):
--   1. CA1/CA2/Exam scores with auto total + auto grade (no more manual grade typing)
--   2. Daily teacher observation log (present/absent/sick/improving/etc, not just attendance)
--   3. Teacher check-in / check-out (arrival + closing monitoring)
--   4. Parent role + parent-student links, so a parent can log in and see/download
--      their child's report card and track improvement over time
--   5. Admin can promote a user to 'principal'; a principal can add teachers;
--      a teacher can add students -- all scoped to one school via school_id,
--      reusing the existing is_school_staff()/current_school_id() helpers.
--
-- Additive only: new tables + nullable columns. Safe to run against the live DB.

-- ---------------------------------------------------------------
-- 1. Roles: add 'parent' to the allowed set.
-- ---------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'admin', 'teacher', 'principal', 'tutor', 'parent'));

-- ---------------------------------------------------------------
-- 2. Parent <-> student links (many-to-many: a parent can have more than
--    one child at the school, and in principle a student could have more
--    than one linked parent/guardian).
-- ---------------------------------------------------------------
create table if not exists public.parent_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (parent_id, student_id)
);

create index if not exists idx_parent_links_parent on public.parent_links(parent_id);
create index if not exists idx_parent_links_student on public.parent_links(student_id);
create index if not exists idx_parent_links_school on public.parent_links(school_id);

alter table public.parent_links enable row level security;

drop policy if exists "parent_links_staff_all" on public.parent_links;
create policy "parent_links_staff_all"
  on public.parent_links
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "parent_links_parent_read_own" on public.parent_links;
create policy "parent_links_parent_read_own"
  on public.parent_links
  for select
  using (parent_id = auth.uid());

-- Helper: is the current user a parent of this student?
create or replace function public.is_parent_of(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.parent_links
    where parent_id = auth.uid() and student_id = p_student_id
  );
$$;

-- Let a parent read their child's report cards.
drop policy if exists "report_cards_parent_read" on public.report_cards;
create policy "report_cards_parent_read"
  on public.report_cards
  for select
  using (public.is_parent_of(student_id));

-- Let a parent read their child's attendance and daily observations.
drop policy if exists "attendance_parent_read" on public.attendance_records;
create policy "attendance_parent_read"
  on public.attendance_records
  for select
  using (public.is_parent_of(student_id));

-- ---------------------------------------------------------------
-- 3. Report cards: switch subject_scores entries to carry CA1/CA2/Exam so
--    the total and grade are always computed, never hand-typed. Existing
--    jsonb column is reused as-is (still jsonb array) -- no column change
--    needed, just a new shape going forward:
--    [{ subject, ca1, ca2, exam, total, grade, remark }, ...]
--    Old rows with { subject, score, grade, remark } keep working; the UI
--    treats missing ca1/ca2/exam as 0 and falls back to `score` if present.
--
--    Also add principal_comment exposure is already in schema (existing
--    column), and a grading_scale per school so a school can tune grade
--    boundaries later without a code change.
-- ---------------------------------------------------------------
create table if not exists public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  min_score int not null,
  max_score int not null,
  grade text not null,
  remark text,
  sort_order int not null default 0,
  unique (school_id, grade)
);

create index if not exists idx_grading_scales_school on public.grading_scales(school_id);

alter table public.grading_scales enable row level security;

drop policy if exists "grading_scales_read" on public.grading_scales;
create policy "grading_scales_read"
  on public.grading_scales
  for select
  using (true);

drop policy if exists "grading_scales_staff_write" on public.grading_scales;
create policy "grading_scales_staff_write"
  on public.grading_scales
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

-- Seed a standard Nigerian secondary-school grading scale for every school
-- that doesn't have one yet, so report cards can auto-grade immediately.
insert into public.grading_scales (school_id, min_score, max_score, grade, remark, sort_order)
select s.id, v.min_score, v.max_score, v.grade, v.remark, v.sort_order
from public.schools s
cross join (values
  (70, 100, 'A1', 'Excellent', 1),
  (65, 69, 'B2', 'Very Good', 2),
  (60, 64, 'B3', 'Good', 3),
  (55, 59, 'C4', 'Credit', 4),
  (50, 54, 'C5', 'Credit', 5),
  (45, 49, 'C6', 'Credit', 6),
  (40, 44, 'D7', 'Pass', 7),
  (0, 39, 'F9', 'Fail', 8)
) as v(min_score, max_score, grade, remark, sort_order)
on conflict (school_id, grade) do nothing;

-- ---------------------------------------------------------------
-- 4. Daily teacher observation log ("teacher comment") -- separate from
--    attendance_records because a school wants BOTH present/absent AND a
--    richer daily note (sick / improving / excellent / needs attention /
--    misbehaving / other), possibly several times a day, from any teacher
--    who sees that student -- not one attendance mark per day.
-- ---------------------------------------------------------------
create table if not exists public.student_observations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  observed_by uuid references public.profiles(id) on delete set null,
  date date not null default current_date,
  status text not null check (status in ('present', 'absent', 'sick', 'improving', 'excellent', 'needs_attention', 'misbehaving', 'other')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_observations_school_date on public.student_observations(school_id, date);
create index if not exists idx_observations_student on public.student_observations(student_id, date desc);

alter table public.student_observations enable row level security;

drop policy if exists "observations_staff_all" on public.student_observations;
create policy "observations_staff_all"
  on public.student_observations
  for all
  using (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()))
  with check (public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "observations_student_read_own" on public.student_observations;
create policy "observations_student_read_own"
  on public.student_observations
  for select
  using (student_id = auth.uid());

drop policy if exists "observations_parent_read" on public.student_observations;
create policy "observations_parent_read"
  on public.student_observations
  for select
  using (public.is_parent_of(student_id));

-- ---------------------------------------------------------------
-- 5. Teacher check-in / check-out (arrival + closing monitoring).
--    One row per teacher per day; check-in creates it, check-out fills it in.
-- ---------------------------------------------------------------
create table if not exists public.teacher_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  date date not null default current_date,
  check_in_at timestamptz,
  check_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (teacher_id, date)
);

create index if not exists idx_teacher_attendance_school_date on public.teacher_attendance(school_id, date);
create index if not exists idx_teacher_attendance_teacher on public.teacher_attendance(teacher_id);

alter table public.teacher_attendance enable row level security;

-- A teacher can check themself in/out; principals/admins can see/manage everyone's.
drop policy if exists "teacher_attendance_self_write" on public.teacher_attendance;
create policy "teacher_attendance_self_write"
  on public.teacher_attendance
  for insert
  with check (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "teacher_attendance_self_update" on public.teacher_attendance;
create policy "teacher_attendance_self_update"
  on public.teacher_attendance
  for update
  using (teacher_id = auth.uid() or public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

drop policy if exists "teacher_attendance_staff_read" on public.teacher_attendance;
create policy "teacher_attendance_staff_read"
  on public.teacher_attendance
  for select
  using (teacher_id = auth.uid() or public.is_admin() or (school_id = public.current_school_id() and public.is_school_staff()));

-- ---------------------------------------------------------------
-- 6. Role management: allow admin to promote anyone to principal, and
--    allow a principal to create teacher accounts, and a teacher to
--    create student accounts -- all enforced in the API layer (service
--    role) rather than RLS, since account creation goes through
--    supabase.auth.admin, which already bypasses RLS. The policies below
--    just make sure ordinary reads/writes of profiles stay scoped
--    correctly once those accounts exist.
-- ---------------------------------------------------------------

-- Principals need to update their own school's teacher/student profiles
-- (e.g. assigning classes) -- already covered by "profiles_school_staff_read"
-- for read; add the write-side equivalent.
drop policy if exists "profiles_school_staff_write" on public.profiles;
create policy "profiles_school_staff_write"
  on public.profiles
  for update
  using (
    auth.uid() = id
    or public.is_admin()
    or (
      school_id is not null
      and school_id = public.current_school_id()
      and public.is_school_staff()
    )
  );

-- Parents need to read the profile rows of their linked children (name,
-- level etc.), not just report cards/attendance.
drop policy if exists "profiles_parent_read_children" on public.profiles;
create policy "profiles_parent_read_children"
  on public.profiles
  for select
  using (public.is_parent_of(id));
