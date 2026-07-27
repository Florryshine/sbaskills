-- 20260727_schools.sql
-- Adds multi-school support so Shiney Brain can be pitched and demoed to
-- individual schools as "shineybrainacademy.com/school/<slug>".
--
-- This does NOT touch existing tables' data, only adds a new table and
-- new nullable columns. Existing students/admins with school_id = null
-- keep working exactly as before (they just aren't attached to a school).
--
-- NOTE: this file was originally run directly against Supabase without
-- being committed, and contained a role_check + policy bug that broke
-- admin access and the tutor account in production. Both are already
-- fixed live; this committed version matches the corrected live state
-- so the repo and the database agree.

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  about text,
  contact_phone text,
  contact_email text,
  address text,
  principal_name text,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_schools_slug on public.schools(slug);

alter table public.profiles
  add column if not exists school_id uuid references public.schools(id) on delete set null;

-- Lightweight version of "global role vs school responsibility": rather
-- than a full separate roles/permissions table (overkill for a handful
-- of pilot schools), a principal or teacher can also be flagged as
-- actively teaching. Extend this if/when a school actually needs finer
-- grained permissions (e.g. an ICT-coordinator teacher role).
alter table public.profiles
  add column if not exists is_teaching boolean not null default false;

-- Lets an admin "deactivate" a user (e.g. a student who left the school)
-- without deleting their account/history. Deactivated users are not
-- blocked from logging in by this column alone -- if login-blocking is
-- needed later, check this flag in middleware.js too.
alter table public.profiles
  add column if not exists is_active boolean not null default true;

create index if not exists idx_profiles_school_id on public.profiles(school_id);

-- Widen the role check constraint to allow 'teacher' and 'principal'
-- alongside the existing 'student' / 'admin' / 'tutor'. Postgres requires
-- dropping and recreating a check constraint to change it.
-- FIX: the original version of this migration dropped 'tutor' from the
-- allowed set (it predated this migration and wasn't tracked anywhere),
-- which silently broke every existing tutor account the moment their
-- profile row was next updated. 'tutor' is included below to match what's
-- actually live now.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'admin', 'teacher', 'principal', 'tutor'));

alter table public.schools enable row level security;

-- School profile pages are public marketing pages (like a school's own
-- website), so anyone can read a published school.
drop policy if exists "schools_public_read" on public.schools;
create policy "schools_public_read"
  on public.schools
  for select
  using (is_published = true or public.is_admin());

drop policy if exists "schools_admin_write" on public.schools;
create policy "schools_admin_write"
  on public.schools
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- Helper functions so the profiles policy below never queries profiles
-- from inside a policy defined on profiles itself.
-- FIX: the original version of this migration used inline subqueries
-- like `(select p.school_id from public.profiles p where p.id = auth.uid())`
-- directly in the USING clause. Because that subquery reads the very
-- table the policy protects, Postgres has to re-evaluate this same
-- policy to answer it, which caused
-- "infinite recursion detected in policy for relation profiles" on
-- every read of profiles -- including the app's own admin-role check,
-- which is what broke admin access production-wide. is_admin() already
-- avoided this by being security definer; these two functions follow
-- the same pattern.
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select role in ('teacher', 'principal')
  from public.profiles
  where id = auth.uid();
$$;

-- Principals/teachers need to see students in their own school (not
-- other schools' students). This mirrors the "profiles_self_read" policy
-- already on profiles, just extended with the school-scoped case.
drop policy if exists "profiles_school_staff_read" on public.profiles;
create policy "profiles_school_staff_read"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or public.is_admin()
    or (
      school_id is not null
      and school_id = public.current_school_id()
      and public.is_school_staff()
    )
  );

-- Seed one demo school so there's something real to click through
-- immediately, before the first real school signs up.
insert into public.schools (slug, name, about, is_published)
values (
  'demo-school',
  'Demo Secondary School',
  'A demo school profile used to show principals what their own Shiney Brain school page will look like.',
  true
)
on conflict (slug) do nothing;
