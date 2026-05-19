create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  phone text,
  role text not null default 'student' check (role in ('student', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  thumbnail_url text,
  price integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null,
  video_url text,
  duration text,
  order_index integer not null default 1,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  payment_reference text,
  amount_paid integer not null default 0,
  enrolled_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  unique (student_id, lesson_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'student')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    phone = excluded.phone;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles
  for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles
  for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_insert" on public.profiles;
create policy "profiles_admin_insert"
  on public.profiles
  for insert
  with check (public.is_admin() or auth.uid() = id);

drop policy if exists "courses_public_read" on public.courses;
create policy "courses_public_read"
  on public.courses
  for select
  using (is_published = true or public.is_admin());

drop policy if exists "courses_admin_write" on public.courses;
create policy "courses_admin_write"
  on public.courses
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "lessons_public_read" on public.lessons;
create policy "lessons_public_read"
  on public.lessons
  for select
  using (
    public.is_admin()
    or (
      is_published = true
      and exists (
        select 1 from public.courses where courses.id = lessons.course_id and courses.is_published = true
      )
    )
  );

drop policy if exists "lessons_admin_write" on public.lessons;
create policy "lessons_admin_write"
  on public.lessons
  for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "enrollments_student_read" on public.enrollments;
create policy "enrollments_student_read"
  on public.enrollments
  for select
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments_student_insert" on public.enrollments;
create policy "enrollments_student_insert"
  on public.enrollments
  for insert
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists "enrollments_admin_update" on public.enrollments;
create policy "enrollments_admin_update"
  on public.enrollments
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "lesson_progress_student_read" on public.lesson_progress;
create policy "lesson_progress_student_read"
  on public.lesson_progress
  for select
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists "lesson_progress_student_insert" on public.lesson_progress;
create policy "lesson_progress_student_insert"
  on public.lesson_progress
  for insert
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists "lesson_progress_student_update" on public.lesson_progress;
create policy "lesson_progress_student_update"
  on public.lesson_progress
  for update
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

create index if not exists idx_courses_published on public.courses(is_published);
create index if not exists idx_lessons_course_id on public.lessons(course_id);
create index if not exists idx_enrollments_student_id on public.enrollments(student_id);
create index if not exists idx_enrollments_course_id on public.enrollments(course_id);
create index if not exists idx_lesson_progress_student_id on public.lesson_progress(student_id);
create index if not exists idx_lesson_progress_lesson_id on public.lesson_progress(lesson_id);
