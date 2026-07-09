// app/api/engines/visual-blueprint/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';

function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildBlueprintPrompt(asset) {
  const keyword = asset.keyword;
  const subject = asset.subject || 'General';
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).join(', ') || 'none listed';
  const definitions = (asset.definitions || []).map((d) => d.term).join(', ') || 'none listed';

  return `You are an educational visual planner for Shiney Brain Academy, a Nigerian exam-prep platform (JAMB/WAEC/NECO).

Topic: "${keyword}"
Subject: ${subject}
Summary: ${summary}
Key concepts / sub-topics: ${keyConcepts}
Key terms: ${definitions}

Plan 4-6 SPECIFIC images a student would need to actually understand this topic — not generic or decorative images.
For each image, pick ONE of these types: "diagram" (labeled anatomy/structure), "concept" (introduces the idea), "process" (steps/stages), "comparison" (X vs Y), "attention" (a scroll-stopping hook image for social media, only include ONE of these).

Each "search_query" must be specific enough to avoid irrelevant results. For a medical/biology topic like "Heart", NEVER just search the bare word — always specify e.g. "labeled human heart anatomy diagram" not "heart". Avoid words that could return non-educational results (e.g. avoid bare emotional/decorative words).

Return ONLY a JSON array, no markdown fences, no extra text:
[
  {
    "section_title": "the specific sub-topic this image supports, e.g. 'Chambers of the Heart'",
    "image_type": "diagram",
    "purpose": "one short sentence on why a student needs this image",
    "search_query": "a specific, unambiguous search phrase, 3-7 words"
  }
]`;
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

    const prompt = buildBlueprintPrompt(asset);

    const { result: plan, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseJsonFromText,
      (parsed) => Array.isArray(parsed) && parsed.length > 0 && parsed.every((p) => p.search_query && p.section_title),
      2048
    );

    if (!plan) {
      return NextResponse.json({ error: `All providers failed: ${errors.join('; ')}` }, { status: 500 });
    }

    // Clear any previous plan for this asset so re-running doesn't duplicate
    await supabase.from('visual_requests').delete().eq('knowledge_asset_id', knowledgeAssetId);

    const rows = plan.map((item) => ({
      knowledge_asset_id: knowledgeAssetId,
      section_title: item.section_title,
      image_type: item.image_type || 'concept',
      purpose: item.purpose || '',
      search_query: item.search_query,
      status: 'pending',
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('visual_requests')
      .insert(rows)
      .select();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan: inserted, usedProvider });
  } catch (error) {
    console.error('❌ Visual blueprint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
