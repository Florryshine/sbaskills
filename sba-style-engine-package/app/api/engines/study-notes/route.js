import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText as robustParseJsonFromText } from '@/lib/robustJsonParse';
import { getStudyNoteStyle, DEFAULT_STUDY_NOTE_STYLE } from '@/lib/studyNoteStyles';

// ── Helpers ──────────────────────────────────────────────────────────
function parseJson(text) {
  try {
    return robustParseJsonFromText(text, 'object');
  } catch {
    return null;
  }
}

function extractTitleFromContent(content) {
  const match = content.match(/^#{1,3}\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function isValidNotes(parsed) {
  return !!(parsed && typeof parsed.content === 'string' && parsed.content.length > 100);
}

export async function POST(request) {
  try {
    const { knowledgeAssetId, style } = await request.json();
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

    const resolvedStyle = style || asset.default_study_note_style || DEFAULT_STUDY_NOTE_STYLE;
    const styleConfig = getStudyNoteStyle(resolvedStyle);
    const prompt = styleConfig.buildPrompt(asset);
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt generation failed' }, { status: 500 });
    }

    // Same Gemini → Groq → OpenRouter → HuggingFace chain the podcast
    // engine uses (lib/llmFallbackChain.js), instead of the old
    // hand-rolled copy that lived only in this route.
    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseJson,
      isValidNotes,
      4096
    );

    if (!result) {
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    const title = result.title || extractTitleFromContent(result.content) || `${asset.keyword} - Revision Notes`;
    const content = result.content || '';

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ error: 'Generated content is too short' }, { status: 500 });
    }

    const { data: draft, error: draftError } = await supabase
      .from('study_note_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        title,
        content,
        style: resolvedStyle,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      console.error('Insert error:', draftError);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      studyNoteDraftId: draft.id,
      title,
      style: resolvedStyle,
      contentLength: content.length,
      usedProvider,
    });
  } catch (error) {
    console.error('Study notes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
