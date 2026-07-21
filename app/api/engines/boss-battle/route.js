import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

// NOTE: this used to carry its own duplicated Gemini/Groq/OpenRouter/
// HuggingFace loop with a hardcoded model list that still included
// gemini-3.5-pro (never available for generateContent -> 404) and
// gemini-2.0-flash (shut down by Google on 2026-06-01 -> permanent 429).
// Every boss-battle generation burned two guaranteed-dead attempts before
// ever reaching a model that could work, then still had no shared-tuned
// max token budget. Now uses the same tested provider chain as blog/
// study-notes/visual-blueprint (lib/llmFallbackChain.js), which already
// has the corrected model list and is the single place to update if
// Google changes availability again.

function parseQuestions(text) {
  return parseJsonFromText(text, 'object');
}

function hasEnoughQuestions(parsed) {
  return Boolean(parsed && Array.isArray(parsed.questions) && parsed.questions.length >= 8);
}

function buildBossBattlePrompt(asset) {
  const keyword = asset.keyword;
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).join(', ');
  const definitions = (asset.definitions || [])
    .map(d => `${d.term}: ${d.definition}`)
    .join('\n');
  const examples = (asset.examples || []).join('\n');
  const facts = (asset.facts || []).join('\n');
  const commonMistakes = (asset.common_mistakes || []).join('\n');

  return `You are an expert exam question designer specialising in "Boss Battle" challenges for Shiney Brain Academy.

Topic: "${keyword}"
Summary: ${summary}
Key Concepts: ${keyConcepts}
Definitions:
${definitions}
Examples:
${examples}
Facts:
${facts}
Common Mistakes:
${commonMistakes}

Generate 10 extremely difficult, challenging multiple‑choice questions that test deep understanding and problem‑solving. Each question must have:
- "question": the question text
- "options": an array of exactly 4 strings (A, B, C, D)
- "correct_answer": the correct option
- "explanation": a clear, thorough explanation
- "difficulty": 4 or 5

Return ONLY a JSON object with a "questions" array of 10 objects. No markdown, no extra text.`;
}

export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const prompt = buildBossBattlePrompt(asset);

    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseQuestions,
      hasEnoughQuestions,
      4096
    );

    if (!result) {
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    const questions = result.questions.slice(0, 10);
    const avgDifficulty = questions.reduce((sum, q) => sum + (q.difficulty || 3), 0) / questions.length;
    const xpReward = Math.round(100 + (avgDifficulty - 1) * 25);

    const { data: draft, error: draftError } = await supabase
      .from('boss_battle_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        name: asset.keyword,
        subject: asset.subject || '',
        topic: '',
        difficulty: Math.round(avgDifficulty),
        health: 100,
        required_level: 1,
        required_xp: 0,
        xp_reward: xpReward,
        reward_coins: 50,
        questions: questions,
        boss_level: 1,
        time_limit_seconds: 600,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('❌ Boss Battle insert error:', draftError);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      bossBattleDraftId: draft.id,
      questionCount: questions.length,
      xpReward,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Boss Battle error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}