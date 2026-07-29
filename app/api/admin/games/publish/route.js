import { createServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

// Publishes (or re-publishes) a knowledge_asset's game content into the
// student-readable game_topics / game_sequence_steps tables. Republishing
// overwrites: definitions/steps/order are fully replaced with the current
// state of the knowledge_asset, so editing an asset and re-publishing is
// how you push updates live.
export async function POST(request) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  const { knowledgeAssetId } = await request.json();
  if (!knowledgeAssetId) {
    return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
  }

  const { data: asset, error: assetError } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, subject, definitions, prerequisite_ids, order_index')
    .eq('id', knowledgeAssetId)
    .maybeSingle();

  if (assetError || !asset) {
    return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
  }

  // Remap prerequisites: a knowledge_asset's prerequisite_ids point to other
  // knowledge_assets, but game_topics.prerequisite_game_topic_ids must point
  // to other game_topics rows. A prerequisite that hasn't been published yet
  // is silently skipped — publish prerequisites first so unlocking works.
  const prereqKnowledgeIds = asset.prerequisite_ids || [];
  let prerequisiteGameTopicIds = [];
  if (prereqKnowledgeIds.length > 0) {
    const { data: prereqTopics } = await supabase
      .from('game_topics')
      .select('id, knowledge_asset_id')
      .in('knowledge_asset_id', prereqKnowledgeIds);
    prerequisiteGameTopicIds = (prereqTopics || []).map((t) => t.id);
  }

  const { data: gameTopic, error: upsertError } = await supabase
    .from('game_topics')
    .upsert(
      {
        knowledge_asset_id: asset.id,
        title: asset.keyword,
        subject: asset.subject,
        definitions: asset.definitions || [],
        prerequisite_game_topic_ids: prerequisiteGameTopicIds,
        order_index: asset.order_index,
        published_at: new Date().toISOString(),
      },
      { onConflict: 'knowledge_asset_id' }
    )
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Republish steps: wipe and reinsert so edits/removals in the source
  // sequence_steps are reflected exactly, not just appended.
  await supabase.from('game_sequence_steps').delete().eq('game_topic_id', gameTopic.id);

  const { data: sourceSteps } = await supabase
    .from('sequence_steps')
    .select('step_order, label, detail')
    .eq('knowledge_asset_id', asset.id)
    .order('step_order', { ascending: true });

  let stepsPublished = 0;
  if (sourceSteps && sourceSteps.length > 0) {
    const { data: inserted, error: stepsError } = await supabase
      .from('game_sequence_steps')
      .insert(
        sourceSteps.map((s) => ({
          game_topic_id: gameTopic.id,
          step_order: s.step_order,
          label: s.label,
          detail: s.detail,
        }))
      )
      .select();

    if (stepsError) {
      console.error('⚠️ Publishing sequence steps failed (non-fatal):', stepsError.message);
    } else {
      stepsPublished = inserted?.length || 0;
    }
  }

  return NextResponse.json({
    success: true,
    gameTopicId: gameTopic.id,
    stepsPublished,
  });
}
