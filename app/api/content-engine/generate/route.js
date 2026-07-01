import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── YOUR NEW API KEYS (hardcoded for testing) ──────────────────────────
const GROQ_KEYS = [
  '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',
];

const GEMINI_KEYS = [
  'AQ.Ab8RN6KWHKpcsIv29h475pkAp-f1aASp-rBTFtTBrGt0V4Knsw',
];

// ── Gemini models – latest stable ──────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

// ── Brand knowledge base (unchanged) ────────────────────────────────────
const knowledgeBase = {
  brand: `Shiney Brain Academy – bright blue (#1a73e8), gold (#FFCC00), white. Bold, Africa-proud, modern.`,
  tone: `Conversational, Nigerian student-friendly, mentor-like. Use "you", be encouraging, practical.`,
  tools: [
    'JAMB Aggregate Calculator',
    'WAEC Grade Calculator',
    'Subject Combination Checker',
    'Admission Chance Checker',
    'Cut-off Mark Checker',
    'Past Question Search',
    'Study Timetable Generator',
    'Daily Mentor',
    'Shine AI (AI Tutor)',
    'Daily Challenge',
    'Boss Battles',
    'Achievements',
    'Library (Books)',
    'Video Lessons',
    'Certificates',
  ],
};

export async function POST(request) {
  try {
    const { queueItemId } = await request.json();
    const supabase = createRouteHandlerClient();

    // ── 1. Get queue item ─────────────────────────────────────────────────
    const { data: item, error: itemError } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    // ── 2. Check if draft already exists ─────────────────────────────────
    if (item.draft_id) {
      const { data: existing } = await supabase
        .from('content_drafts')
        .select('id')
        .eq('id', item.draft_id)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Draft already exists' }, { status: 409 });
      }
    }

    // ── 3. Mark as generating ─────────────────────────────────────────────
    await supabase
      .from('content_queue')
      .update({ status: 'generating' })
      .eq('id', queueItemId);

    // ── 4. Build prompt ───────────────────────────────────────────────────
    const prompt = `You are an expert content writer for Shiney Brain Academy (SBA), Nigeria's leading exam prep and skills platform.

Write a complete, SEO-optimized blog article on the topic: "${item.keyword}"

Category: ${item.category || 'General'}
Priority: ${item.priority || 'Medium'}

Knowledge Base:
- Brand: ${knowledgeBase.brand}
- Tone: ${knowledgeBase.tone}
- Available Tools: ${knowledgeBase.tools.join(', ')}

Requirements:
1. Title: Engaging, keyword-rich (max 60 chars)
2. Meta Description: Compelling, includes keyword (max 160 chars)
3. Slug: URL-friendly version of the title
4. Tags: 3-5 relevant tags
5. Content: 1500-2500 words, well-structured with H2, H3 headings
6. Internal Links: Reference at least 3 SBA tools naturally
7. FAQ Section: 3-5 questions with answers
8. CTA: End with a "Before You Leave" section linking to relevant SBA tools
9. Image Suggestions: 3 image descriptions (hero, infographic, social card)

Return the response as a valid JSON object with this exact structure:
{
  "title": "...",
  "slug": "...",
  "meta_description": "...",
  "tags": ["tag1", "tag2"],
  "content": "...",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": ["tool1", "tool2"],
  "images": [
    {"type": "hero", "description": "..."},
    {"type": "infographic", "description": "..."},
    {"type": "social", "description": "..."}
  ],
  "cta": "..."
}`;

    // ── 5. Try all providers ──────────────────────────────────────────────
    let result = null;
    let usedProvider = '';
    const errors = [];

    // ── 5a. Groq ──────────────────────────────────────────────────────────
    for (const groqKey of GROQ_KEYS) {
      if (result) break;
      try {
        const groq = new Groq({ apiKey: groqKey });
        const groqResponse = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          max_tokens: 4096,
          temperature: 0.7,
        });
        const text = groqResponse.choices[0].message.content.trim();
        const cleaned = text.replace(/```json|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          result = JSON.parse(match[0]);
          usedProvider = 'Groq (llama-3.3-70b)';
        } else {
          errors.push('Groq: Could not extract JSON');
        }
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
      }
    }

    // ── 5b. Gemini (fallback) ────────────────────────────────────────────
    if (!result) {
      for (const geminiKey of GEMINI_KEYS) {
        if (result) break;
        for (const modelName of GEMINI_MODELS) {
          if (result) break;
          try {
            const client = new GoogleGenerativeAI(geminiKey);
            const model = client.getGenerativeModel({ model: modelName });
            const genResult = await model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });
            const text = genResult.response.text();
            const cleaned = text.replace(/```json|```/g, '').trim();
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) {
              result = JSON.parse(match[0]);
              usedProvider = `Gemini (${modelName})`;
            } else {
              errors.push(`Gemini ${modelName}: Could not extract JSON`);
            }
          } catch (e) {
            errors.push(`Gemini ${modelName}: ${e.message}`);
          }
        }
      }
    }

    // ── 6. All providers failed ───────────────────────────────────────────
    if (!result) {
      await supabase
        .from('content_queue')
        .update({ status: 'failed' })
        .eq('id', queueItemId);
      return NextResponse.json(
        { error: `All AI providers failed. Details: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // ── 7. Always ensure slug exists ──────────────────────────────────────
    const slug =
      result.slug ||
      result.title
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      'untitled';

    // ── 8. Save draft to Supabase ─────────────────────────────────────────
    const wordCount = result.content?.split(/\s+/).length || 0;

    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .insert({
        queue_id: queueItemId,
        keyword: item.keyword,
        title: result.title,
        url_slug: slug,
        meta_description: result.meta_description,
        tags: result.tags || [],
        content: result.content,
        schemas: JSON.stringify(result.faq || []),
        internal_links: result.internal_links || [],
        image_prompts: JSON.stringify(result.images || []),
        cta: result.cta || '',
        word_count: wordCount,
        category: item.category,
        status: 'draft',
        content_score: 85,
        readability_score: 80,
      })
      .select()
      .single();

    if (draftError) {
      await supabase
        .from('content_queue')
        .update({ status: 'failed' })
        .eq('id', queueItemId);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    // ── 9. Update queue item status ───────────────────────────────────────
    await supabase
      .from('content_queue')
      .update({
        status: 'draft',
        draft_id: draft.id,
        generated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      title: result.title,
      usedProvider,
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}