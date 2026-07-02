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

// ─── Helper: Build search query from keyword ─────────────────────────────
function buildSearchQuery(keyword) {
  // Remove common stopwords and exam jargon
  const clean = keyword
    .replace(/\b(JAMB|WAEC|NECO|UTME|Post-UTME|2026|2027|2028|2029|2030)\b/gi, '')
    .replace(/\b(how to|guide for|tips for|score|pass|exam|test|study|prepare|admission)\b/gi, '')
    .trim();
  // If clean is too short, fallback to original
  return clean.length > 2 ? clean : keyword;
}

// ─── Helper: Search Pexels ──────────────────────────────────────────────
async function searchPexels(query) {
  if (!PEXELS_API_KEY) return null;
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5`;
  const response = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.photos || data.photos.length === 0) return null;
  // Randomize selection from top 5
  const photo = data.photos[Math.floor(Math.random() * Math.min(data.photos.length, 5))];
  return photo.src.large2x || photo.src.large || photo.src.original;
}

// ─── Helper: Search Pixabay ──────────────────────────────────────────────
async function searchPixabay(query) {
  if (!PIXABAY_API_KEY) return null;
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  if (!data.hits || data.hits.length === 0) return null;
  const hit = data.hits[Math.floor(Math.random() * Math.min(data.hits.length, 5))];
  return hit.largeImageURL || hit.fullHDURL || hit.webformatURL;
}

// ─── Helper: Fetch stock image ───────────────────────────────────────────
async function fetchStockImage(keyword) {
  const query = buildSearchQuery(keyword);
  let url = await searchPexels(query);
  if (!url) url = await searchPixabay(query);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, ext: 'jpg', mimeType: 'image/jpeg', source: 'stock' };
}

// ─── Helper: Build overlay SVG ──────────────────────────────────────────
function buildOverlaySvg(title, category) {
  const lines = title.length > 50 ? title.split(' ', 8).join(' ') + '…' : title;
  const categoryBadge = category || 'General';
  const brandColor = '#1a73e8';
  const accentColor = '#FFCC00';

  return `
    <svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg">
      <!-- Dark gradient overlay at bottom -->
      <defs>
        <linearGradient id="fade" x1="0" y1="0.6" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0" />
          <stop offset="100%" stop-color="black" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <!-- Brand top-left -->
      <rect x="24" y="24" rx="8" width="220" height="48" fill="${brandColor}" />
      <text x="40" y="55" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="700" fill="white">Shiney Brain Academy</text>
      <!-- Category badge top-right -->
      <rect x="1056" y="24" rx="20" width="120" height="40" fill="${accentColor}" />
      <text x="1080" y="51" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700" fill="#1a1a1a" text-anchor="start">${categoryBadge}</text>
      <!-- Title bottom -->
      <rect x="0" y="540" width="1200" height="135" fill="url(#fade)" />
      <text x="40" y="610" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="800" fill="white" letter-spacing="-1">${lines}</text>
      <text x="40" y="650" font-family="Inter, Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.7)">shineybrainacademy.com</text>
    </svg>
  `;
}

// ─── Helper: Create branded thumbnail ──────────────────────────────────
async function createBrandedThumbnail(imageBuffer, title, category) {
  const svgBuffer = Buffer.from(buildOverlaySvg(title, category));
  return await sharp(imageBuffer)
    .resize(1200, 675, { fit: 'cover' })
    .composite([
      {
        input: svgBuffer,
        top: 0,
        left: 0,
      },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ─── Helper: Generate cover image (stock first, AI fallback) ────────────
async function generateCoverImage(keyword, title, category, heroPrompt) {
  // 1. Try stock photo
  const stockResult = await fetchStockImage(keyword);
  if (stockResult) {
    const brandedBuffer = await createBrandedThumbnail(stockResult.buffer, title, category);
    return { buffer: brandedBuffer, ext: 'jpg', mimeType: 'image/jpeg' };
  }

  // 2. Fallback: AI generation (Gemini first)
  for (const geminiKey of GEMINI_KEYS) {
    try {
      const client = new GoogleGenerativeAI(geminiKey);
      const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp-image-generation' });
      const prompt = heroPrompt || `${keyword} educational illustration, modern, clean, no text, no words, no letters`;
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['image'] },
      });
      const imagePart = result.response.candidates[0]?.content?.parts[0]?.inlineData;
      if (imagePart) {
        const buffer = Buffer.from(imagePart.data, 'base64');
        const brandedBuffer = await createBrandedThumbnail(buffer, title, category);
        return { buffer: brandedBuffer, ext: 'jpg', mimeType: 'image/jpeg' };
      }
    } catch (e) {
      console.warn('Gemini image generation failed:', e.message);
    }
  }

  // 3. Final fallback: Pollinations (no text)
  const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(keyword + ' educational illustration, no text, no words, no letters')}?width=1200&height=675&nologo=true`;
  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`Pollinations failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const brandedBuffer = await createBrandedThumbnail(buffer, title, category);
  return { buffer: brandedBuffer, ext: 'jpg', mimeType: 'image/jpeg' };
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

    // ── 9. Generate cover image ──────────────────────────────────────────
    let coverImageUrl = null;
    try {
      const heroPrompt = `Educational illustration for ${item.keyword}, African students, modern, clean, professional`;
      const { buffer, ext } = await generateCoverImage(item.keyword, result.title, item.category, heroPrompt);
      coverImageUrl = await uploadImage(supabase, buffer, ext, 'blog-images');
      await supabase
        .from('content_drafts')
        .update({ cover_image: coverImageUrl })
        .eq('id', draft.id);
    } catch (imgError) {
      console.warn('Image generation failed, but article was saved:', imgError.message);
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