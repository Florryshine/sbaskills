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

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

// ── Real tools that exist on the platform ───────────────────────────────
const AVAILABLE_TOOLS = [
  'JAMB Aggregate Calculator',
  'Cut-off Mark Checker',
  'Past Question Search',
  'Subject Combination Checker',
  'Admission Chance Checker',
  'WAEC Grade Calculator',
  'Study Timetable Generator',
  'Daily Mentor',
  'Shine AI',
];

// ─── Prompt builder (unchanged) ─────────────────────────────────────
function buildPrompt(item, availableTools = [], availableBlogTitles = []) {
  // ... (same as you already have)
  // I'm omitting the full prompt here for brevity – keep your existing one.
  // Make sure it still includes "image_search" field.
}

// ─── Provider callers (unchanged) ───────────────────────────────────
function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

function isValidResult(r) {
  return (
    r &&
    typeof r.content === 'string' &&
    r.content.trim().length > 0 &&
    typeof r.title === 'string' &&
    r.title.trim().length > 0 &&
    typeof r.topic_type === 'string'
  );
}

function sanitizeInternalLinks(links, availableTools, availableBlogTitles) {
  if (!Array.isArray(links)) return [];
  const validSet = new Set([...availableTools, ...availableBlogTitles]);
  return links.filter((link) => typeof link === 'string' && validSet.has(link));
}

async function tryOpenRouter(prompt) {
  if (!OPENROUTER_API_KEY) return null;
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8000,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function tryHuggingFace(prompt) {
  if (!HUGGINGFACE_API_KEY) return null;
  const res = await fetch(
    'https://api-inference.huggingface.co/models/meta-llama/Llama-3.1-8B-Instruct',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { max_new_tokens: 8000, temperature: 0.7, return_full_text: false },
      }),
    }
  );
  if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.[0]?.generated_text?.trim() || null;
}

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

    // 4. Fetch existing blog titles
    const { data: existingPosts, error: existingPostsError } = await supabase
      .from('content_drafts')
      .select('title')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(150);

    if (existingPostsError) {
      console.warn('Could not fetch existing posts for internal links:', existingPostsError);
    }
    const availableBlogTitles = (existingPosts || [])
      .map((p) => p.title)
      .filter(Boolean);

    // 5. Build prompt
    const prompt = buildPrompt(item, AVAILABLE_TOOLS, availableBlogTitles);

    // ── 6. Text generation ──────────────────────────────────────────────
    let result = null;
    let usedProvider = '';
    const errors = [];

    // Gemini first, then Groq, OpenRouter, HuggingFace (same as before)
    // (I'm omitting the full generation loop for brevity – keep your existing one)
    // Ensure it sets `result` and `usedProvider` correctly.

    // After generation, ensure `result` is valid.

    // ── 7. Sanitize links ──────────────────────────────────────────────
    const cleanInternalLinks = sanitizeInternalLinks(
      result.internal_links,
      AVAILABLE_TOOLS,
      availableBlogTitles
    );

    // ── 8. Save knowledge asset (if exists) ─────────────────────────────
    // ... (keep your existing code)

    // ── 9. Save draft ──────────────────────────────────────────────────
    // ... (keep your existing code)

    // ── 10. GENERATE IMAGE (with detailed logging) ─────────────────────
    let coverImageUrl = null;
    let imageMeta = {};
    let imageError = null;
    try {
      console.log('🖼️ Starting image generation...');
      const searchPhrase = result.image_search || result.title;
      console.log(`🔍 Search phrase: "${searchPhrase}"`);
      console.log(`📦 PEXELS_API_KEY exists? ${!!process.env.PEXELS_API_KEY}`);
      console.log(`📦 PIXABAY_API_KEY exists? ${!!process.env.PIXABAY_API_KEY}`);

      const stock = await fetchStockImage(searchPhrase);
      console.log(`📷 Stock result: ${stock ? 'found' : 'none'}`);
      let brandedBuffer;

      if (stock) {
        console.log('🖌️ Creating branded thumbnail from stock...');
        brandedBuffer = await createBrandedThumbnail(stock.buffer, result.title, item.category, IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'stock',
          image_provider: stock.provider,
          image_photographer: stock.photographer,
          image_search_query: searchPhrase,
        };
      } else {
        console.log('⚠️ No stock found, using fallback thumbnail...');
        brandedBuffer = await createFallbackThumbnail(result.title, item.category, IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'fallback',
          image_provider: 'SBA Brand',
          image_photographer: 'Shiney Brain Academy',
          image_search_query: searchPhrase,
        };
      }

      console.log('📤 Uploading image to Supabase Storage...');
      coverImageUrl = await uploadImage(supabase, brandedBuffer, 'jpg', 'blog-images');
      console.log(`✅ Image uploaded successfully: ${coverImageUrl}`);
    } catch (imgErr) {
      console.error('❌ Image generation failed:', imgErr);
      imageError = imgErr.message;
    }

    // ── 11. Update draft with image metadata ────────────────────────────
    if (coverImageUrl) {
      console.log('💾 Updating draft with cover_image...');
      const { error: updateError } = await supabase
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
      if (updateError) {
        console.error('❌ Failed to update draft with image:', updateError);
      } else {
        console.log('✅ Draft updated with image metadata.');
      }
    } else {
      console.warn('⚠️ No cover image URL to save – image generation likely failed.');
    }

    // ── 12. Update queue ────────────────────────────────────────────────
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
      knowledgeAssetId: asset?.id || null,
      title: result.title,
      usedProvider,
      coverImage: coverImageUrl,
      imageError,
      internalLinksUsed: cleanInternalLinks,
    });
  } catch (error) {
    console.error('❌ Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}