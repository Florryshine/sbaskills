import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import sharp from 'sharp';

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

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// ── Gemini models (text generation only — no image model used) ──────────
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];

// ── Brand config ───────────────────────────────────────────────────────
const BRAND = {
  name: 'Shiney Brain Academy',
  blue: '#1a73e8',
  gold: '#FFCC00',
  navy: '#0B1220',
};

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 675; // 16:9

// ── Brand knowledge base (for article generation) ────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// STOCK IMAGE SEARCH — Pexels first, Pixabay fallback
// ─────────────────────────────────────────────────────────────────────────

// Fallback query builder — only used if the AI didn't return an
// `image_search` phrase (e.g. older cached prompts, parsing edge cases).
// The AI-generated phrase is preferred because the model already
// understands the article's subject better than keyword-stripping can.
function buildFallbackQuery(keyword, category) {
  const jargon = /\b(JAMB|WAEC|NECO|UTME|Post-?UTME|CBT|SBA)\b/gi;
  const stopwords = new Set([
    'the', 'a', 'an', 'to', 'for', 'of', 'and', 'in', 'on', 'your', 'you',
    'is', 'are', 'how', 'what', 'why', 'best', 'complete', 'ultimate',
    'guide', 'step', 'steps', 'score', 'pass', 'exam', 'test', 'study',
    'prepare', 'admission', 'result', 'results',
  ]);

  const source = keyword || category || 'education';
  const cleaned = source
    .replace(jargon, '')
    .replace(/\b(19|20)\d{2}\b/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))
    .slice(0, 4)
    .join(' ');

  return `${cleaned} african student studying`.trim();
}

async function searchPexels(query) {
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const data = await res.json();
    if (!data.photos?.length) return null;
    const pick = data.photos[Math.floor(Math.random() * Math.min(5, data.photos.length))];
    return {
      url: pick.src.large2x || pick.src.large || pick.src.original,
      provider: 'pexels',
      photographer: pick.photographer || null,
      sourceUrl: pick.url || null,
    };
  } catch (e) {
    console.warn('Pexels search failed:', e.message);
    return null;
  }
}

async function searchPixabay(query) {
  if (!PIXABAY_API_KEY) return null;
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=10`
    );
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const data = await res.json();
    if (!data.hits?.length) return null;
    const pick = data.hits[Math.floor(Math.random() * Math.min(5, data.hits.length))];
    return {
      url: pick.largeImageURL || pick.fullHDURL || pick.webformatURL,
      provider: 'pixabay',
      photographer: pick.user || null,
      sourceUrl: pick.pageURL || null,
    };
  } catch (e) {
    console.warn('Pixabay search failed:', e.message);
    return null;
  }
}

// Tries Pexels then Pixabay. Returns the raw image buffer plus metadata
// (provider, photographer, source query) so it can be stored alongside
// the draft for attribution/debugging/future provider swaps.
async function fetchStockImage(query) {
  let hit = await searchPexels(query);
  if (!hit) hit = await searchPixabay(query);
  if (!hit) return null;

  const imgRes = await fetch(hit.url);
  if (!imgRes.ok) return null;
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  return { buffer, ...hit };
}

// ─────────────────────────────────────────────────────────────────────────
// TEXT OVERLAY — Sharp + SVG (no native canvas dependency, deploys cleanly
// on Vercel serverless since sharp ships with Next.js already)
// ─────────────────────────────────────────────────────────────────────────

function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Greedy word-wrap by character count, capped at 3 lines so long titles
// never overflow the canvas.
function wrapText(text, maxCharsPerLine, maxLines = 3) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines) {
    const joinedSoFar = lines.join(' ');
    if (joinedSoFar.length < text.length) {
      lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*$/, '') + '…';
    }
  }
  return lines;
}

function buildOverlaySvg({ title, category }) {
  const titleLines = wrapText(title.toUpperCase(), 24, 3);
  const lineHeight = 60;
  const startY = CANVAS_HEIGHT - 70 - (titleLines.length - 1) * lineHeight;

  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="50" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `
<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND.navy}" stop-opacity="0"/>
      <stop offset="50%" stop-color="${BRAND.navy}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${BRAND.navy}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#fade)"/>

  <rect x="24" y="24" width="230" height="46" rx="8" fill="${BRAND.blue}"/>
  <text x="40" y="54" font-family="Arial, Helvetica, sans-serif" font-size="19" font-weight="700" fill="#FFFFFF">
    ${escapeXml(BRAND.name)}
  </text>

  ${
    category
      ? `<rect x="${CANVAS_WIDTH - 176}" y="24" width="152" height="42" rx="20" fill="${BRAND.gold}"/>
         <text x="${CANVAS_WIDTH - 100}" y="51" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="${BRAND.navy}" text-anchor="middle">
           ${escapeXml(category.toUpperCase())}
         </text>`
      : ''
  }

  <text y="${startY}" font-family="Arial, Helvetica, sans-serif" font-size="50" font-weight="800" fill="#FFFFFF" style="letter-spacing:0.4px">
    ${titleTspans}
  </text>

  <text x="50" y="${CANVAS_HEIGHT - 24}" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="rgba(255,255,255,0.7)">
    shineybrainacademy.com
  </text>
</svg>`;
}

async function createBrandedThumbnail(imageBuffer, { title, category }) {
  const base = await sharp(imageBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: 'cover', position: 'attention' })
    .toBuffer();

  const overlaySvg = Buffer.from(buildOverlaySvg({ title, category }));

  const final = await sharp(base)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return { buffer: final, ext: 'jpg', mimeType: 'image/jpeg' };
}

// Full cover-image pipeline. Prefers the AI-generated `image_search`
// phrase (the model already understands the article's subject); falls
// back to keyword-stripping only if the AI didn't return one. If both
// stock libraries come back empty, falls back to Pollinations with a
// strict no-text prompt — never Gemini's image model, which is the exact
// source of the garbled-text problem this pipeline replaces.
// Returns the branded buffer plus metadata for storage on the draft.
async function generateCoverImage({ keyword, category, title, aiSearchPhrase }) {
  const query = aiSearchPhrase?.trim() || buildFallbackQuery(keyword, category);

  const stock = await fetchStockImage(query);
  if (stock) {
    const branded = await createBrandedThumbnail(stock.buffer, { title, category });
    return {
      ...branded,
      meta: {
        image_source: 'stock',
        image_provider: stock.provider,
        image_photographer: stock.photographer,
        image_search_query: query,
      },
    };
  }

  console.warn(`No stock image found for "${query}", using text-free illustration fallback`);
  const fallbackPrompt = `Clean modern flat-design illustration related to: ${query}. No text, no words, no letters, no logos, no signage. Simple, high-contrast, vibrant colors, plenty of empty space.`;
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
    fallbackPrompt
  )}?width=${CANVAS_WIDTH}&height=${CANVAS_HEIGHT}&nologo=true`;

  const res = await fetch(fallbackUrl);
  if (!res.ok) throw new Error(`Pollinations fallback failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const branded = await createBrandedThumbnail(buffer, { title, category });

  return {
    ...branded,
    meta: {
      image_source: 'ai_fallback',
      image_provider: 'pollinations',
      image_photographer: null,
      image_search_query: query,
    },
  };
}

// ─── Helper: Upload image to Supabase Storage ────────────────────────────
async function uploadImage(supabase, buffer, ext, folder = 'blog-images') {
  const fileName = `hero-${Date.now()}.${ext}`;
  const path = `${folder}/${fileName}`;
  const { error } = await supabase.storage
    .from('blog-images')
    .upload(path, buffer, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('blog-images').getPublicUrl(path);
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
    await supabase.from('content_queue').update({ status: 'generating' }).eq('id', queueItemId);

    // ── 4. Build prompt ───────────────────────────────────────────────────
    // NOTE: now asks the model for an `image_search` phrase — the model
    // already understands the article's subject, so it can produce a
    // better stock-photo search phrase than post-hoc keyword stripping.
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
9. Image Search Phrase: A short (3-6 word) generic stock-photo search phrase that captures the VISUAL scene of this article — e.g. "african students studying library" or "graduation ceremony nigeria". Do NOT include exam acronyms (JAMB, WAEC, NECO), years, or brand names — stock photo libraries don't have those tagged. Just describe what a relevant, real photo would show.

Return the response as a valid JSON object with this exact structure:
{
  "title": "...",
  "slug": "...",
  "meta_description": "...",
  "tags": ["tag1", "tag2"],
  "content": "...",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": ["tool1", "tool2"],
  "image_search": "...",
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

    // ── 5b. Fallback – try each Gemini key × each model (TEXT ONLY) ──────
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
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
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

    // ── 9. Generate branded cover image (stock photo first, safe fallback) ─
    let coverImageUrl = null;
    try {
      const { buffer, ext, meta } = await generateCoverImage({
        keyword: item.keyword,
        category: item.category,
        title: result.title,
        aiSearchPhrase: result.image_search,
      });
      coverImageUrl = await uploadImage(supabase, buffer, ext, 'blog-images');
      await supabase
        .from('content_drafts')
        .update({
          cover_image: coverImageUrl,
          image_source: meta.image_source,
          image_provider: meta.image_provider,
          image_photographer: meta.image_photographer,
          image_search_query: meta.image_search_query,
        })
        .eq('id', draft.id);
    } catch (imgError) {
      console.warn('Cover image generation failed, article still saved:', imgError.message);
    }

    // ── 10. Update queue item status ────────────────────────────────────────
    await supabase
      .from('content_queue')
      .update({ status: 'draft', draft_id: draft.id, generated_at: new Date().toISOString() })
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