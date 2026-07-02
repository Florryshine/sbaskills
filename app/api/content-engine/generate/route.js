import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import {
  fetchStockImage,
  createBrandedThumbnail,
  createFallbackThumbnail,
  IMAGE_PRESETS,
} from '@/lib/image-engine';

// ── Keys ──────────────────────────────────────────────────────────────────
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

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

const knowledgeBase = { /* ... same as before ... */ };

// ─── Upload helper ──────────────────────────────────────────────────────
async function uploadImage(supabase, buffer, ext = 'jpg', folder = 'blog-images') {
  const fileName = `hero-${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const { data, error } = await supabase.storage
    .from('blog-images')
    .upload(path, buffer, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(path);
  return urlData.publicUrl;
}

// ─── MAIN API ────────────────────────────────────────────────────────────
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

    // 2. Check existing draft
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

    // 3. Mark generating
    await supabase.from('content_queue').update({ status: 'generating' }).eq('id', queueItemId);

    // 4. Build prompt (with image_search)
    const prompt = `... (same as before with image_search field) ...`;

    // ── 5. Text generation (Groq → Gemini fallback) ──────────────────
    let result = null;
    let usedProvider = '';
    const errors = [];

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
        }
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
      }
    }

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
              usedProvider = `Gemini (${modelName})`;
            }
          } catch (e) {
            errors.push(`Gemini ${modelName}: ${e.message}`);
          }
        }
      }
    }

    if (!result) {
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json({ error: `All providers failed: ${errors.join('; ')}` }, { status: 500 });
    }

    // ── 6. Slug & save draft ──────────────────────────────────────────
    const slug = result.slug || result.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
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
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    // ── 7. Generate image ──────────────────────────────────────────────
    let coverImageUrl = null;
    let imageMeta = {};
    try {
      const searchPhrase = result.image_search || result.title; // fallback to title if missing
      const stock = await fetchStockImage(searchPhrase);
      let brandedBuffer;
      let isFallback = false;

      if (stock) {
        brandedBuffer = await createBrandedThumbnail(stock.buffer, result.title, item.category, IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'stock',
          image_provider: stock.provider,
          image_photographer: stock.photographer,
          image_search_query: searchPhrase,
        };
      } else {
        // No stock image found → use branded fallback
        brandedBuffer = await createFallbackThumbnail(result.title, item.category, IMAGE_PRESETS.hero);
        isFallback = true;
        imageMeta = {
          image_source: 'fallback',
          image_provider: 'SBA Brand',
          image_photographer: 'Shiney Brain Academy',
          image_search_query: searchPhrase,
        };
      }

      coverImageUrl = await uploadImage(supabase, brandedBuffer, 'jpg', 'blog-images');
    } catch (imgErr) {
      console.warn('Image generation failed:', imgErr);
      // Continue without image – the post still saves
    }

    // ── 8. Update draft with image metadata ────────────────────────────
    if (coverImageUrl) {
      await supabase
        .from('content_drafts')
        .update({
          cover_image: coverImageUrl,
          image_source: imageMeta.image_source || null,
          image_provider: imageMeta.image_provider || null,
          image_photographer: imageMeta.image_photographer || null,
          image_search_query: imageMeta.image_search_query || null,
          width: IMAGE_PRESETS.hero.width,
          height: IMAGE_PRESETS.hero.height,
        })
        .eq('id', draft.id);
    }

    // ── 9. Update queue ────────────────────────────────────────────────
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