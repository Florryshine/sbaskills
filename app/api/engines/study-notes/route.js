import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ... (keys, helpers, sanitizeJsonString, tryOpenRouter, tryHuggingFace – same as flashcards)

function buildStudyNotesPrompt(asset) {
  const keyword = asset.keyword || '';
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).map(k => `- ${k}`).join('\n');
  const definitions = (asset.definitions || [])
    .map(d => `- **${d.term}**: ${d.definition}`)
    .join('\n');
  const examples = (asset.examples || []).map(ex => `- ${ex}`).join('\n');
  const facts = (asset.facts || []).map(f => `- ${f}`).join('\n');
  const commonMistakes = (asset.common_mistakes || []).map(m => `- ${m}`).join('\n');

  return `You are an expert study note writer for Shiney Brain Academy. Create concise, well‑structured revision notes on the topic: "${keyword}".

The notes should be in **Markdown** and suitable for printing as a PDF. Use headings, bullet points, bold for key terms.

Include sections: Overview, Key Concepts, Important Definitions, Examples, Key Facts, Common Mistakes, Exam Tips, Quick Summary Table, Review Questions.

Return ONLY a JSON object with { "title": "...", "content": "full markdown content" }. No markdown fences around the JSON.`;
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

    const prompt = buildStudyNotesPrompt(asset);

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.error('❌ Study notes prompt is empty:', { prompt });
      return NextResponse.json({ error: 'Prompt generation failed' }, { status: 500 });
    }

    console.log(`📝 Study notes prompt length: ${prompt.length}`);
    console.log(`📝 First 200 chars: ${prompt.substring(0, 200)}...`);

    let result = null;
    let usedProvider = '';
    const errors = [];

    // (same generation loop as flashcards – check parsed.content, not cards)

    // After generation, insert:
    const { data: draft, error: draftError } = await supabase
      .from('study_note_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        title: result.title || `${asset.keyword} - Revision Notes`,
        content: result.content,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('❌ Study Notes insert error:', draftError);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      studyNoteDraftId: draft.id,
      title: result.title,
      contentLength: result.content.length,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Study Notes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}