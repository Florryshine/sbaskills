// app/api/boss-battles/[draftId]/publish/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { syncBossBattleDraftToPastQuestions } from '@/lib/syncBossBattleDraftToPastQuestions';

export async function POST(request, { params }) {
  const { draftId } = params;

  try {
    const supabase = createAdminClient();

    const { data: draft, error: draftError } = await supabase
      .from('boss_battle_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError || !draft) {
      return NextResponse.json({ error: 'Boss battle draft not found' }, { status: 404 });
    }

    // The draft's `questions` column holds full AI-generated question
    // objects (question/options/correct_answer/explanation) — but
    // boss_battles.questions (read by app/boss/page.js) expects an array
    // of past_questions IDs. Sync the generated questions into
    // past_questions first, then use the IDs it returns.
    const questionIds = await syncBossBattleDraftToPastQuestions(supabase, draftId, draft);

    if (questionIds.length === 0) {
      return NextResponse.json(
        { error: 'None of the generated questions could be synced to past_questions — nothing to publish.' },
        { status: 500 }
      );
    }

    // Column names differ slightly between the draft and the live table
    // (draft uses xp_reward, live boss/page.js reads reward_xp).
    const liveData = {
      name: draft.name,
      subject: draft.subject,
      topic: draft.topic,
      difficulty: draft.difficulty,
      health: draft.health,
      questions: questionIds,
      required_xp: draft.required_xp,
      reward_xp: draft.xp_reward,
      reward_coins: draft.reward_coins,
    };

    let liveBossId = draft.boss_battle_id || null;

    if (liveBossId) {
      const { error: updateError } = await supabase
        .from('boss_battles')
        .update(liveData)
        .eq('id', liveBossId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    } else {
      const { data: newBoss, error: insertError } = await supabase
        .from('boss_battles')
        .insert(liveData)
        .select()
        .single();
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
      liveBossId = newBoss.id;
    }

    await supabase
      .from('boss_battle_drafts')
      .update({ status: 'published', boss_battle_id: liveBossId })
      .eq('id', draftId);

    return NextResponse.json({ success: true, bossBattleId: liveBossId, questionCount: questionIds.length });
  } catch (error) {
    console.error('❌ Boss battle publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}