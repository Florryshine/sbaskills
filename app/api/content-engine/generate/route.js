import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── Load multiple API keys from environment variables ────────────────────
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY,
].filter(Boolean);

const GROQ_KEYS = [
  process.env.GROQ_API_KEY_1,
  process.env.GROQ_API_KEY_2,
  process.env.GROQ_API_KEY,
].filter(Boolean);

// ── Gemini models ────────────────────────────────────────────────────────
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

// ── Brand knowledge base ──────────────────────────────────────────────────
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

// ─── Helper: Generate an image from a prompt ─────────────────────────────
async function generateImage(prompt) {
  // Option 1: Try Gemini image generation (experimental, free)
  for (const geminiKey of GEMINI_KEYS) {
    try {
      const client = new GoogleGenerativeAI(geminiKey);
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['image'],
        },
      });
      const imagePart = result.response.candidates[0]?.content?.parts[0]?.inlineData;
      if (imagePart) {
        // Base64 image data
        const imageData = imagePart.data;
        const mimeType = imagePart.mimeType || 'image/png';
        const ext = mimeType.split('/')[1];
        const buffer = Buffer.from(imageData, 'base64');
        return { buffer, ext, mimeType };
      }
    } catch (e) {
      console.warn('Gemini image generation failed:', e.message);
      // Continue to fallback
    }
  }

  // Option 2: Fallback to Pollinations.ai (completely free, no key)
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=400&nologo=true`;
  const response = await fetch(fallbackUrl);
  if (!response.ok) {
    throw new Error(`Pollinations.ai failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, ext: 'png', mimeType: 'image/png' };
}

// ─── Helper: Upload image to Supabase Storage ────────────────────────────
async function uploadImage(supabase, buffer, ext, folder = 'blog-images') {
  const fileName = `hero-${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('blog-images')
    .upload(path, buffer, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data: urlData } = supabase.storage
    .from('blog-images')
    .getPublicUrl(path);
  return urlData.publicUrl;
}

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

    // ── 5. Try all providers (with key rotation) ──────────────────────────
    let result = null;
    let usedProvider = '';
    const errors = [];

    // ── 5a. Try each Groq key ─────────────────────────────────────────────
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
          usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
        } else {
          errors.push(`Groq key ${GROQ_KEYS.indexOf(groqKey) + 1}: Could not extract JSON`);
        }
      } catch (e) {
        errors.push(`Groq key ${GROQ_KEYS.indexOf(groqKey) + 1}: ${e.message}`);
      }
    }

    // ── 5b. Fallback – try each Gemini key × each model ──────────────────
    if (!result) {
      for (const geminiKey of GEMINI_KEYS) {
        if (result) break;
        const client = new GoogleGenerativeAI(geminiKey);
        for (const modelName of GEMINI_MODELS) {
          if (result) break;
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
              usedProvider = `Gemini (${modelName}) – key ${GEMINI_KEYS.indexOf(geminiKey) + 1}`;
            } else {
              errors.push(`Gemini ${modelName} (key ${GEMINI_KEYS.indexOf(geminiKey) + 1}): Could not extract JSON`);
            }
          } catch (e) {
            errors.push(`Gemini ${modelName} (key ${GEMINI_KEYS.indexOf(geminiKey) + 1}): ${e.message}`);
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

    // ── 8. Save draft to Supabase (without cover_image yet) ──────────────
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
        // cover_image will be set after image generation
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

    // ── 9. Generate and upload hero image ──────────────────────────────────
    let coverImageUrl = null;
    const heroPrompt = result.images?.find(img => img.type === 'hero')?.description;
    if (heroPrompt) {
      try {
        // Enhance prompt with brand style
        const imagePrompt = `Shiney Brain Academy style: ${heroPrompt}. Bright blue (#1a73e8) and gold (#FFCC00) colors, modern, clean, Nigerian student-focused.`;
        const { buffer, ext, mimeType } = await generateImage(imagePrompt);
        coverImageUrl = await uploadImage(supabase, buffer, ext, 'blog-images');
        // Update the draft with the cover image URL
        await supabase
          .from('content_drafts')
          .update({ cover_image: coverImageUrl })
          .eq('id', draft.id);
      } catch (imgError) {
        console.warn('Image generation failed, but article was saved:', imgError.message);
        // Continue – the post will still exist without an image
      }
    }

    // ── 10. Update queue item status ──────────────────────────────────────
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
      coverImage: coverImageUrl,
    });

  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}