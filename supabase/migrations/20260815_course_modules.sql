-- Lightweight course modules/topics. Existing lessons remain valid with a
-- nullable module_id so legacy flat courses continue to render unchanged.
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  description text,
  icon text,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_modules_order_index_check check (order_index >= 0)
);

alter table public.lessons
  add column if not exists module_id uuid references public.course_modules(id) on delete set null;

create index if not exists idx_course_modules_course_order
  on public.course_modules(course_id, order_index);

create index if not exists idx_lessons_module_id
  on public.lessons(module_id);

alter table public.course_modules enable row level security;

drop policy if exists "course_modules_public_read" on public.course_modules;
create policy "course_modules_public_read"
  on public.course_modules
  for select
  using (
    public.is_admin()
    or (
      is_published = true
      and exists (
        select 1 from public.courses
        where courses.id = course_modules.course_id
          and courses.is_published = true
      )
    )
  );

drop policy if exists "course_modules_admin_write" on public.course_modules;
create policy "course_modules_admin_write"
  on public.course_modules
  for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.course_modules is
  'Optional ordered modules/topics for courses. A null lessons.module_id preserves legacy flat-course behavior.';
