// app/api/engines/visual-blueprint/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';

// Fixed vocabulary — the images route uses this to decide WHICH sources to
// even query, so the LLM must only ever return one of these.
const VALID_TYPES = [
  'educational_diagram', // labeled diagrams, charts, structures — Wikimedia only
  'process',              // labeled step/stage diagrams — Wikimedia only
  'comparison',           // labeled X-vs-Y diagrams/charts — Wikimedia only
  'real_world_example',   // an actual photo of the real thing/place/object — Pexels/Pixabay
  'classroom_photo',      // students/teachers/classroom setting — Pexels/Pixabay
];

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

  return `You are an image-retrieval specialist, not a content writer. Your ONLY job is to write search queries that a stock-photo/diagram search engine can match literally — you are NOT describing the lesson, you are naming exactly what should visually appear in the image.

Topic: "${keyword}"
Subject: ${subject}
Summary: ${summary}
Key concepts / sub-topics: ${keyConcepts}
Key terms: ${definitions}

Plan 4-6 images. For each one, pick ONE visual_type from this EXACT list (no other values allowed):
- "educational_diagram" — a labeled diagram, chart, or structure (periodic table, anatomy, cell structure, graph)
- "process" — a labeled sequence of steps/stages (mitosis stages, water cycle stages)
- "comparison" — a labeled side-by-side chart (mitosis vs meiosis, mean vs median)
- "real_world_example" — an actual photograph of a real object/place/phenomenon that exists (a real periodic table poster, a real microscope, a real heart, a real classroom)
- "classroom_photo" — students or teachers actively studying/writing/in a classroom

CRITICAL RULES for search_query:
1. Write a LITERAL, CONCRETE noun phrase — describe the exact visible object, never the lesson concept or teaching purpose. Never write abstract/emotional phrases like "students amazed by" or "why objects refuse to move" — a search engine cannot match feelings, only things it can see.
2. For "educational_diagram", "process", and "comparison": the query MUST include the word "diagram", "chart", or "labeled" plus the specific named parts/stages/axes involved. Example: NOT "periodic table layout" — INSTEAD "periodic table elements symbols atomic numbers labeled diagram".
3. For "real_world_example" and "classroom_photo": describe a photo that plausibly exists and could be taken with a camera. Example: NOT "students amazed by cell division" — INSTEAD "student looking through microscope in biology lab".
4. Never invent a query about an abstract idea, statistic, or emotional hook — every query must be something a photographer or diagram-maker could literally have created.
5. 3-8 words per query, no filler words like "comprehensive" or "modern" or "professional".

Return ONLY a JSON array, no markdown fences, no extra text:
[
  {
    "section_title": "the specific sub-topic this image supports",
    "visual_type": "one of the 5 exact values above",
    "purpose": "one short sentence on why a student needs this image",
    "search_query": "a literal, concrete, 3-8 word noun phrase"
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

    await supabase.from('visual_requests').delete().eq('knowledge_asset_id', knowledgeAssetId);

    const rows = plan.map((item) => ({
      knowledge_asset_id: knowledgeAssetId,
      section_title: item.section_title,
      // Normalize/validate — fall back to a safe default if the model drifts off-vocabulary
      image_type: VALID_TYPES.includes(item.visual_type) ? item.visual_type : 'real_world_example',
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