-- Daily mission completion bridge
-- Run this SQL in Supabase SQL Editor.

create or replace function public.complete_daily_mission_item(
  p_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mission_id uuid;
  v_user_id uuid;
  v_completed integer;
  v_total integer;
  v_status text;
begin
  select m.id, m.user_id
  into v_mission_id, v_user_id
  from public.student_daily_mission_items i
  join public.student_daily_missions m on m.id = i.mission_id
  where i.id = p_item_id;

  if v_mission_id is null then
    raise exception 'Daily mission item not found';
  end if;

  if v_user_id <> auth.uid() then
    raise exception 'Not allowed';
  end if;

  update public.student_daily_mission_items
  set completed = true,
      completed_at = coalesce(completed_at, now())
  where id = p_item_id;

  select
    count(*) filter (where completed),
    count(*)
  into v_completed, v_total
  from public.student_daily_mission_items
  where mission_id = v_mission_id;

  if v_total > 0 and v_completed = v_total then
    v_status := 'completed';

    update public.student_daily_missions
    set status = 'completed',
        completed_at = coalesce(completed_at, now())
    where id = v_mission_id;
  else
    v_status := 'in_progress';

    update public.student_daily_missions
    set status = case when status = 'ready' then 'in_progress' else status end
    where id = v_mission_id;
  end if;

  return jsonb_build_object(
    'mission_id', v_mission_id,
    'item_id', p_item_id,
    'completed_items', v_completed,
    'total_items', v_total,
    'mission_status', v_status
  );
end;
$$;

revoke all on function public.complete_daily_mission_item(uuid) from public;
grant execute on function public.complete_daily_mission_item(uuid) to authenticated;
