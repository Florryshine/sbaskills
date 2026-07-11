import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText as robustParseJsonFromText } from '@/lib/robustJsonParse';

// ─── This route now does ONE job: exhaustive research → knowledge_assets. ───
// It no longer writes a blog article. Blog generation moved to
// /api/engines/blog, which TRANSFORMS an existing knowledge asset into a
// blog post — same pattern as quiz/flashcards/study-notes already use.
// This means every downstream content type (blog included) now inherits
// genuinely deep research instead of a 2-3 sentence side-effect of blog-writing.

function parseJsonFromText(text) {
  return robustParseJsonFromText(text, 'object');
}

function isValidKnowledge(r) {
  return (
    r &&
    typeof r.summary === 'string' &&
    r.summary.trim().length > 0 &&
    Array.isArray(r.key_concepts) &&
    r.key_concepts.length > 0
  );
}

function buildDeepResearchPrompt(item) {
  return `You are an expert educational researcher for Shiney Brain Academy, going deep on ONE exam topic. Every other content type (study notes, quiz, flashcards, blog, images) will be built later from your research alone — you will not see this topic again, so extract everything relevant now.

Topic: "${item.keyword}"
Category: ${item.category || 'General'}

Do NOT write in blog/article voice. Do NOT write an introduction, hook, or narrative. This is a structured research extraction, not prose for a reader.

Be exhaustive:
- Cover every sub-topic, sub-concept, and angle a student would need for JAMB/WAEC/NECO/Post-UTME on this topic — do not stop at a surface-level summary.
- List every important term with a precise, exam-ready definition.
- Include real, concrete examples and facts — not generic filler.
- List common mistakes/misconceptions students actually make on this exact topic.
- If the topic is broad enough to have distinct sub-topics, break it into those sub-topics with a short explanation each.
- Do not artificially limit list lengths — include as many genuinely distinct items as apply.

Return ONLY this JSON object — no markdown fences, no extra text:
{
  "topic_type": "learning|advice|news",
  "subject": "Biology|Chemistry|Physics|Mathematics|... or General",
  "summary": "A thorough overview, 100-200 words, covering what the topic is and why it matters for the exam — plain research language, not a blog hook",
  "sub_topics": [{"title": "sub-topic name", "explanation": "2-4 sentence explanation of this sub-topic"}],
  "key_concepts": ["as many distinct concepts as genuinely apply"],
  "definitions": [{"term": "term", "definition": "precise, exam-ready definition"}],
  "examples": ["concrete real examples, including exam-style scenarios where relevant"],
  "facts": ["specific, non-obvious facts a student should know"],
  "common_mistakes": ["actual mistakes/misconceptions students make on this exact topic"],
  "difficulty": 1-5,
  "tags": ["tag1", "tag2", ...]
}`;
}

export async function POST(request) {
  try {
    const { queueItemId } = await request.json();
    const supabase = createRouteHandlerClient();

    // 1. Fetch queue item
    const { data: item, error: itemError } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();
    if (itemError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    // 2. Skip if a knowledge asset already exists for this keyword
    const { data: existingAsset } = await supabase
      .from('knowledge_assets')
      .select('id')
      .eq('keyword', item.keyword)
      .maybeSingle();

    if (existingAsset) {
      await supabase
        .from('content_queue')
        .update({
          status: 'completed',
          knowledge_asset_id: existingAsset.id,
          generated_at: new Date().toISOString(),
        })
        .eq('id', queueItemId);

      return NextResponse.json({
        success: true,
        knowledgeAssetId: existingAsset.id,
        message: 'A knowledge asset already existed for this keyword',
      });
    }

    // 3. Mark generating
    await supabase.from('content_queue').update({ status: 'generating' }).eq('id', queueItemId);

    // 4. Research (exhaustive, no blog voice)
    const prompt = buildDeepResearchPrompt(item);
    const { result, usedProvider, errors } = await generateWithFallback(
      prompt,
      parseJsonFromText,
      isValidKnowledge,
      8192
    );

    if (!result) {
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // 5. Create Knowledge Asset
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .insert({
        keyword: item.keyword,
        topic_type: result.topic_type || 'learning',
        subject: result.subject || null,
        summary: result.summary,
        sub_topics: result.sub_topics || [],
        key_concepts: result.key_concepts || [],
        definitions: result.definitions || [],
        examples: result.examples || [],
        facts: result.facts || [],
        common_mistakes: result.common_mistakes || [],
        difficulty: result.difficulty || 3,
        tags: result.tags || [],
        source: 'ai_generated',
        status: 'approved',
      })
      .select()
      .single();

    if (assetError) {
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json({ error: assetError.message }, { status: 500 });
    }

    // 6. Update queue — done. Blog/notes/quiz/etc are now separate, on-demand steps.
    await supabase
      .from('content_queue')
      .update({
        status: 'completed',
        knowledge_asset_id: asset.id,
        generated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);

    return NextResponse.json({
      success: true,
      knowledgeAssetId: asset.id,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Knowledge asset generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}