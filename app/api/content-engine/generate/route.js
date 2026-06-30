import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';   // npm install groq-sdk if not installed

// ---- TEMPORARY: Hardcoded keys (remove after testing) ----
const GEMINI_API_KEY = 'AQ.Ab8RN6LzFsFswEndjLmXQQnnkoQ8Wn_rdNU1_jjX7o1RWGH_pw';
const GROQ_API_KEY = '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';
// ----------------------------------------------------------

// Knowledge base for the AI
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
    'Certificates'
  ]
};

// Gemini models (fallback list)
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.5-pro',
];

export async function POST(request) {
  try {
    const { queueItemId } = await request.json();
    const supabase = createRouteHandlerClient();

    // 1. Get queue item
    const { data: item } = await supabase
      .from('content_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (!item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 });
    }

    // 2. Check if draft already exists
    if (item.draft_id) {
      const { data: existing } = await supabase
        .from('content_drafts')
        .select('id')
        .eq('id', item.draft_id)
        .single();
      if (existing) {
        return NextResponse.json({ error: 'Draft already exists' }, { status: 409 });
      }
    }

    // 3. Update status to generating
    await supabase
      .from('content_queue')
      .update({ status: 'generating' })
      .eq('id', queueItemId);

    // 4. Build prompt
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

    // ----- GENERATION (Groq first, then Gemini fallback) -----
    let result = null;
    let usedProvider = '';
    const errors = [];

    // 1. Try Groq (primary)
    try {
      const groq = new Groq({ apiKey: GROQ_API_KEY });
      const groqResponse = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        max_tokens: 2048,
        temperature: 0.7,
      });
      const text = groqResponse.choices[0].message.content.trim();
      const cleaned = text.replace(/```json|```/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        result = JSON.parse(match[0]);
        usedProvider = 'Groq (llama-3.3-70b)';
      } else {
        errors.push('Groq: Could not extract JSON from response');
      }
    } catch (groqError) {
      errors.push(`Groq: ${groqError.message}`);
    }

    // 2. Fallback to Gemini (if Groq fails)
    if (!result) {
      const client = new GoogleGenerativeAI(GEMINI_API_KEY);
      for (const modelName of GEMINI_MODELS) {
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
          });
          const text = genResult.response.text();
          const cleaned = text.replace(/```json|```/g, '').trim();
          const match = cleaned.match(/\{[\s\S]*\}/);
          if (match) {
            result = JSON.parse(match[0]);
            usedProvider = `Gemini (${modelName}) – fallback`;
            break;
          }
        } catch (e) {
          errors.push(`Gemini ${modelName} (fallback): ${e.message}`);
        }
      }
    }

    // 3. If both failed, return error
    if (!result) {
      console.error('All generation attempts failed:', errors);
      await supabase
        .from('content_queue')
        .update({ status: 'failed' })
        .eq('id', queueItemId);
      return NextResponse.json(
        { error: `All AI providers failed. Details: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // 4. Save draft to database
    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .insert({
        queue_id: queueItemId,
        keyword: item.keyword,
        title: result.title,
        url_slug: result.slug,
        meta_description: result.meta_description,
        tags: result.tags || [],
        content: result.content,
        schemas: JSON.stringify(result.faq || []),
        internal_links: result.internal_links || [],
        image_prompts: result.images || [],
        cta: result.cta || '',
        word_count: result.content?.split(/\s+/).length || 0,
        category: item.category,
        status: 'draft',
        score_seo: 85,
        score_readability: 80,
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

    // 5. Update queue item
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