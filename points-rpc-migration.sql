-- Run in Supabase SQL editor. Safe to run even if some pieces already exist.

create table if not exists user_points (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_points integer not null default 0,
  streak_days integer not null default 0,
  last_activity_date date,
  updated_at timestamptz default now()
);

create table if not exists points_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  points integer not null,
  reason text,
  action_type text,
  reference_id uuid,
  created_at timestamptz default now()
);

alter table user_points enable row level security;
alter table points_log enable row level security;

drop policy if exists "Users can read own points" on user_points;
create policy "Users can read own points" on user_points for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can read own points log" on points_log;
create policy "Users can read own points log" on points_log for select to authenticated using (auth.uid() = user_id);

create or replace function add_points(
  p_user_id uuid,
  p_points integer,
  p_reason text,
  p_action_type text,
  p_reference_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_points (user_id, total_points)
  values (p_user_id, p_points)
  on conflict (user_id) do update
    set total_points = user_points.total_points + p_points,
        updated_at = now();

  insert into points_log (user_id, points, reason, action_type, reference_id)
  values (p_user_id, p_points, p_reason, p_action_type, p_reference_id);
end;
$$;

create or replace function update_streak(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last_date date;
begin
  select last_activity_date into v_last_date from user_points where user_id = p_user_id;

  insert into user_points (user_id, streak_days, last_activity_date)
  values (p_user_id, 1, current_date)
  on conflict (user_id) do update
    set streak_days = case
          when user_points.last_activity_date = current_date then user_points.streak_days
          when user_points.last_activity_date = current_date - 1 then user_points.streak_days + 1
          else 1
        end,
        last_activity_date = current_date,
        updated_at = now();
end;
$$;

grant execute on function add_points(uuid, integer, text, text, uuid) to authenticated;
grant execute on function update_streak(uuid) to authenticated;
