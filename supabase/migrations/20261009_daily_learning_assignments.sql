-- Daily learning assignments: teacher-authored reading, quiz, boss battle and practice tasks.
-- Run this migration in Supabase SQL Editor if migrations are not automatically applied.

create table if not exists public.daily_learning_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  activity_type text not null default 'reading' check (activity_type in ('reading','quiz','boss_battle','practice','custom')),
  action_url text,
  target_id uuid,
  assignment_date date not null default (now() at time zone 'Africa/Lagos')::date,
  due_date date,
  points_reward integer not null default 10 check (points_reward between 0 and 1000),
  is_published boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists daily_learning_assignments_date_idx on public.daily_learning_assignments (is_published, assignment_date, due_date);

create table if not exists public.daily_learning_assignment_completions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.daily_learning_assignments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null default now(),
  points_awarded integer not null default 0,
  unique (assignment_id, student_id)
);
create index if not exists daily_learning_assignment_completions_student_idx on public.daily_learning_assignment_completions (student_id, completed_at desc);

alter table public.daily_learning_assignments enable row level security;
alter table public.daily_learning_assignment_completions enable row level security;
drop policy if exists "Students read published daily assignments" on public.daily_learning_assignments;
create policy "Students read published daily assignments" on public.daily_learning_assignments for select to authenticated using (is_published = true);
drop policy if exists "Admins manage daily assignments" on public.daily_learning_assignments;
create policy "Admins manage daily assignments" on public.daily_learning_assignments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists "Students read own assignment completions" on public.daily_learning_assignment_completions;
create policy "Students read own assignment completions" on public.daily_learning_assignment_completions for select to authenticated using (auth.uid() = student_id);

create or replace function public.complete_daily_learning_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_assignment public.daily_learning_assignments%rowtype;
  v_completion_id uuid;
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if v_user_id is null then return jsonb_build_object('success', false, 'message', 'Please sign in first.'); end if;
  select * into v_assignment from public.daily_learning_assignments
   where id = p_assignment_id and is_published = true and assignment_date <= v_today
     and (due_date is null or due_date >= v_today)
   for update;
  if not found then return jsonb_build_object('success', false, 'message', 'This assignment is not currently available.'); end if;

  if v_assignment.activity_type = 'quiz' then
    if v_assignment.target_id is null or not exists (
      select 1 from public.quiz_attempts qa where qa.student_id = v_user_id and qa.quiz_id = v_assignment.target_id
    ) then return jsonb_build_object('success', false, 'message', 'Complete the assigned quiz first, then return here.'); end if;
  elsif v_assignment.activity_type = 'boss_battle' then
    if v_assignment.target_id is null or not exists (
      select 1 from public.boss_attempts ba where ba.user_id = v_user_id and ba.boss_id = v_assignment.target_id and ba.completed = true
    ) then return jsonb_build_object('success', false, 'message', 'Defeat the assigned boss first, then return here.'); end if;
  elsif v_assignment.activity_type = 'practice' then
    if not exists (select 1 from public.jamb_practice_attempts pa where pa.user_id = v_user_id and pa.completed_at::date >= v_assignment.assignment_date) then
      return jsonb_build_object('success', false, 'message', 'Complete a practice session first, then return here.');
    end if;
  end if;

  insert into public.daily_learning_assignment_completions (assignment_id, student_id, points_awarded)
  values (v_assignment.id, v_user_id, v_assignment.points_reward)
  on conflict (assignment_id, student_id) do nothing
  returning id into v_completion_id;
  if v_completion_id is null then return jsonb_build_object('success', false, 'already_completed', true, 'message', 'You have already earned points for this assignment.'); end if;

  insert into public.user_points (user_id, total_points) values (v_user_id, v_assignment.points_reward)
  on conflict (user_id) do update set total_points = public.user_points.total_points + excluded.total_points, updated_at = now();
  insert into public.points_log (user_id, points, reason, action_type, reference_id)
  values (v_user_id, v_assignment.points_reward, 'Completed assignment: ' || v_assignment.title, 'daily_assignment', v_assignment.id);
  return jsonb_build_object('success', true, 'points', v_assignment.points_reward, 'message', 'Assignment completed. Points added!');
end;
$$;
revoke all on function public.complete_daily_learning_assignment(uuid) from public;
grant execute on function public.complete_daily_learning_assignment(uuid) to authenticated;