create or replace function public.link_curriculum_topics_to_assets(
  p_curriculum_id uuid,
  p_subject text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_assets int := 0;
  v_games int := 0;
  v_objectives int := 0;
  v_missing int := 0;
begin
  with matches as (
    select distinct on (ct.id) ct.id as topic_id, ka.id as asset_id
    from public.curriculum_topics ct
    join public.knowledge_assets ka
      on lower(btrim(ka.keyword)) = lower(btrim(ct.title))
     and (ka.subject is null or lower(btrim(ka.subject)) = lower(btrim(ct.subject)))
    where ct.curriculum_id = p_curriculum_id
      and ct.knowledge_asset_id is null
      and (p_subject is null or lower(btrim(ct.subject)) = lower(btrim(p_subject)))
    order by ct.id, ka.created_at desc
  )
  update public.curriculum_topics ct
  set knowledge_asset_id = m.asset_id, updated_at = now()
  from matches m where ct.id = m.topic_id;
  get diagnostics v_assets = row_count;

  update public.curriculum_topics ct
  set game_topic_id = gt.id, updated_at = now()
  from public.game_topics gt
  where gt.knowledge_asset_id = ct.knowledge_asset_id
    and ct.curriculum_id = p_curriculum_id
    and ct.game_topic_id is null
    and (p_subject is null or lower(btrim(ct.subject)) = lower(btrim(p_subject)));
  get diagnostics v_games = row_count;

  update public.knowledge_assets ka
  set learning_objectives = o.objs
  from (
    select ct.knowledge_asset_id as asset_id,
           jsonb_agg(co.objective_text order by co.order_index nulls last, co.created_at) as objs
    from public.curriculum_topics ct
    join public.curriculum_objectives co on co.curriculum_topic_id = ct.id
    where ct.curriculum_id = p_curriculum_id
      and ct.knowledge_asset_id is not null
      and (p_subject is null or lower(btrim(ct.subject)) = lower(btrim(p_subject)))
    group by ct.knowledge_asset_id
  ) o
  where ka.id = o.asset_id
    and (ka.learning_objectives is null or ka.learning_objectives = '[]'::jsonb);
  get diagnostics v_objectives = row_count;

  select count(*) into v_missing
  from public.curriculum_topics ct
  where ct.curriculum_id = p_curriculum_id
    and ct.node_type = 'topic'
    and ct.knowledge_asset_id is null
    and (p_subject is null or lower(btrim(ct.subject)) = lower(btrim(p_subject)));

  return jsonb_build_object('assets_linked', v_assets, 'game_topics_linked', v_games,
    'assets_given_objectives', v_objectives, 'topics_without_asset', v_missing);
end;
$$;

revoke all on function public.link_curriculum_topics_to_assets(uuid, text) from public, anon, authenticated;
grant execute on function public.link_curriculum_topics_to_assets(uuid, text) to service_role;
