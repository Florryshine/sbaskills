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

// ── Gemini models ────────────────────────────────────────────────────────
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
  navy: '#0B1220', // used for gradient/overlay
};

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

// Turns "UNIBEN Cut-off Mark 2026: Your Ultimate Guide" into a clean search
// query like "university students studying nigeria" — strips numbers/years,
// stopwords, and brand-specific jargon that stock libraries won't match.
function buildSearchQuery(keyword, category) {
  const stopwords = new Set([
    'the', 'a', 'an', 'to', 'for', 'of', 'and', 'in', 'on', 'your',
    'ultimate', 'guide', 'complete', 'how', 'what', 'why', 'best',
    '2025', '2026', '2027', 'jamb', 'waec', 'neco', 'utme', 'cbt',
  ]);

  const cleaned = (keyword || category || 'education')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w))
    .slice(0, 4)
    .join(' ');

  // Always anchor the search in something stock libraries will actually have
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
    // Pick from top few results for variety across articles
    const pick = data.photos[Math.floor(Math.random() * Math.min(5, data.photos.length))];
    return { url: pick.src.large2x || pick.src.large, source: 'pexels' };
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
    return { url: pick.largeImageURL, source: 'pixabay' };
  } catch (e) {
    console.warn('Pixabay search failed:', e.message);
    return null;
  }
}

async function fetchStockImage(query) {
  let hit = await searchPexels(query);
  if (!hit) hit = await searchPixabay(query);
  if (!hit) throw new Error(`No stock image found for query: "${query}"`);

  const imgRes = await fetch(hit.url);
  if (!imgRes.ok) throw new Error(`Failed to download image from ${hit.source}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  return { buffer, source: hit.source };
}

// ─────────────────────────────────────────────────────────────────────────
// TEXT OVERLAY — Sharp + SVG (no native canvas dependency, deploys cleanly)
// ─────────────────────────────────────────────────────────────────────────

// Escapes text for safe embedding inside SVG <text> nodes.
function escapeXml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Simple greedy word-wrap so long titles don't overflow the canvas.
function wrapText(text, maxCharsPerLine) {
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
  }
  if (current) lines.push(current);
  return lines;
}

const WIDTH = 1200;
const HEIGHT = 675; // 16:9

function buildOverlaySvg({ title, category }) {
  const titleLines = wrapText(title.toUpperCase(), 22).slice(0, 3);
  const lineHeight = 64;
  const startY = HEIGHT - 60 - (titleLines.length - 1) * lineHeight;

  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="60" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join('');

  return `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BRAND.navy}" stop-opacity="0"/>
      <stop offset="55%" stop-color="${BRAND.navy}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${BRAND.navy}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>

  <!-- darken bottom two-thirds so white text stays readable over any photo -->
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="url(#fade)"/>

  <!-- top-left brand chip -->
  <rect x="30" y="30" width="230" height="46" rx="8" fill="${BRAND.navy}" fill-opacity="0.85"/>
  <text x="48" y="60" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="${BRAND.gold}">
    ${escapeXml(BRAND.name)}
  </text>

  ${
    category
      ? `<rect x="${WIDTH - 170}" y="30" width="140" height="42" rx="8" fill="${BRAND.gold}"/>
         <text x="${WIDTH - 100}" y="58" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${BRAND.navy}" text-anchor="middle">
           ${escapeXml(category.toUpperCase())}
         </text>`
      : ''
  }

  <!-- title -->
  <text y="${startY}" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="800" fill="#FFFFFF" style="letter-spacing:0.5px">
    ${titleTspans}
  </text>
</svg>`;
}

async function createBrandedThumbnail(imageBuffer, { title, category }) {
  // Normalize the stock photo to our fixed 16:9 canvas first
  const base = await sharp(imageBuffer)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
    .toBuffer();

  const overlaySvg = Buffer.from(buildOverlaySvg({ title, category }));

  const final = await sharp(base)
    .composite([{ input: overlaySvg, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();

  return { buffer: final, ext: 'jpg', mimeType: 'image/jpeg' };
}

// Full pipeline: search stock photo -> brand it -> return buffer.
// Falls back to Pollinations (text-free prompt) only if BOTH stock
// libraries come up empty — keeps output looking clean either way.
async function generateCoverImage({ keyword, category, title }) {
  const query = buildSearchQuery(keyword, category);

  try {
    const { buffer } = await fetchStockImage(query);
    return await createBrandedThumbnail(buffer, { title, category });
  } catch (e) {
    console.warn('Stock image pipeline failed, falling back to Pollinations:', e.message);
    const fallbackPrompt = `Clean modern flat-design illustration related to: ${query}. No text, no words, no letters, no logos. Simple, high-contrast, vibrant colors.`;
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fallbackPrompt)}?width=${WIDTH}&height=${HEIGHT}&nologo=true`;
    const res = await fetch(fallbackUrl);
    if (!res.ok) throw new Error(`Pollinations fallback failed: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    return await createBrandedThumbnail(buffer, { title, category });
  }
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

Return the response as a valid JSON object with this exact structure:
{
  "title": "...",
  "slug": "...",
  "meta_description": "...",
  "tags": ["tag1", "tag2"],
  "content": "...",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": ["tool1", "tool2"],
  "cta": "..."
}`;

    // ── 5. Try all providers (with key rotation) ──────────────────────────
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
        } else {
          errors.push(`Groq key ${GROQ_KEYS.indexOf(groqKey) + 1}: Could not extract JSON`);
        }
      } catch (e) {
        errors.push(`Groq key ${GROQ_KEYS.indexOf(groqKey) + 1}: ${e.message}`);
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

    if (!result) {
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json(
        { error: `All AI providers failed. Details: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // ── 6. Ensure slug exists ──────────────────────────────────────────────
    const slug =
      result.slug ||
      result.title
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') ||
      'untitled';

    // ── 7. Save draft to Supabase (without cover_image yet) ──────────────
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

    // ── 8. Generate branded cover image (stock photo + text overlay) ─────
    let coverImageUrl = null;
    try {
      const { buffer, ext } = await generateCoverImage({
        keyword: item.keyword,
        category: item.category,
        title: result.title,
      });
      coverImageUrl = await uploadImage(supabase, buffer, ext, 'blog-images');
      await supabase.from('content_drafts').update({ cover_image: coverImageUrl }).eq('id', draft.id);
    } catch (imgError) {
      console.warn('Cover image generation failed, article still saved:', imgError.message);
    }

    // ── 9. Update queue item status ────────────────────────────────────────
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