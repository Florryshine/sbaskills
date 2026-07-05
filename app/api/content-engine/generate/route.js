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

// ── API Keys ─────────────────────────────────────────────────────────────
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

// ─── Prompt builder ─────────────────────────────────────────────────────
function buildPrompt(item, availableTools = [], availableBlogTitles = []) {
  return `You are an expert content writer for Shiney Brain Academy.

Write a complete, SEO-optimized blog article on the topic: "${item.keyword}".
Category: ${item.category || 'General'}

Write like a brilliant teacher – conversational, encouraging, practical. Use contractions, questions, short stories, and relatable examples. Avoid robotic/textbook language.

Requirements:
- Length: at least 1200 words (aim for 1500-2000 if possible).
- Include: H1, H2, H3 headings, bullet lists, a table (if useful), FAQ section (6-10 Q&As), meta description (~155 chars), SEO title (<60 chars), URL slug.
- Structure:
  1. Introduction (hook the reader – question, myth, surprising fact)
  2. Explain the topic (simple, step‑by‑step)
  3. Common mistakes
  4. Practical tips
  5. 💡 Shine Tip (personal advice)
  6. ❌ Myth vs ✅ Reality (pairs)
  7. Quick summary (table)
  8. FAQ
  9. 🎯 Before You Leave (CTA, link to tools)
- Internal links: reference up to 10 items from the AVAILABLE lists below. Only use exact matches; never invent.

AVAILABLE TOOLS (real platform tools):
${availableTools.map((t) => `- ${t}`).join('\n')}

AVAILABLE EXISTING BLOG POSTS (real published articles, if any):
${
  availableBlogTitles.length > 0
    ? availableBlogTitles.map((t) => `- ${t}`).join('\n')
    : '(none yet)'
}

Return ONLY this JSON object – no markdown fences, no extra text. The "content" field must be the full Markdown article.

{
  "topic_type": "learning|advice|news",
  "subject": "Biology|Chemistry|... or General",
  "summary": "2-3 sentence overview",
  "key_concepts": ["concept1", ...],
  "definitions": [{"term": "...", "definition": "..."}],
  "examples": ["example1", ...],
  "facts": ["fact1", ...],
  "common_mistakes": ["mistake1", ...],
  "difficulty": 1-5,
  "title": "SEO title <60 chars",
  "slug": "url-friendly-slug",
  "meta_description": "~155 chars",
  "tags": ["tag1", ...],
  "content": "Full Markdown article with all required sections",
  "faq": [{"question": "...", "answer": "..."}],
  "internal_links": ["exact tool or blog title", ...],
  "cta": "One-line call-to-action",
  "image_search": "3-5 word stock photo search phrase"
}`;
}

// ─── Helpers ───────────────────────────────────────────────────────────
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
      max_tokens: 8192,
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
        parameters: { max_new_tokens: 8192, temperature: 0.7, return_full_text: false },
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

    // Gemini first
    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 8192,
              temperature: 0.7,
            },
          });
          const text = genResult.response.text();
          const parsed = parseJsonFromText(text);
          if (isValidResult(parsed)) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else if (parsed) {
            errors.push(`Gemini ${modelName}: parsed but missing required fields`);
          }
        } catch (e) {
          errors.push(`Gemini ${modelName}: ${e.message}`);
        }
      }
    }

    // Groq fallback
    if (!result) {
      for (const groqKey of GROQ_KEYS) {
        if (result) break;
        try {
          const groq = new Groq({ apiKey: groqKey });
          const groqResponse = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 8192,
            temperature: 0.7,
          });
          const text = groqResponse.choices[0].message.content.trim();
          const parsed = parseJsonFromText(text);
          if (isValidResult(parsed)) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else if (parsed) {
            errors.push('Groq: parsed but missing required fields');
          }
        } catch (e) {
          errors.push(`Groq: ${e.message}`);
        }
      }
    }

    // OpenRouter fallback
    if (!result) {
      try {
        const text = await tryOpenRouter(prompt);
        if (text) {
          const parsed = parseJsonFromText(text);
          if (isValidResult(parsed)) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else if (parsed) {
            errors.push('OpenRouter: parsed but missing required fields');
          }
        }
      } catch (e) {
        errors.push(`OpenRouter: ${e.message}`);
      }
    }

    // HuggingFace fallback
    if (!result) {
      try {
        const text = await tryHuggingFace(prompt);
        if (text) {
          const parsed = parseJsonFromText(text);
          if (isValidResult(parsed)) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else if (parsed) {
            errors.push('HuggingFace: parsed but missing required fields');
          }
        }
      } catch (e) {
        errors.push(`HuggingFace: ${e.message}`);
      }
    }

    if (!result) {
      await supabase.from('content_queue').update({ status: 'failed' }).eq('id', queueItemId);
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // Ensure internal_links is an array
    if (!result.internal_links || !Array.isArray(result.internal_links)) {
      result.internal_links = [];
    }

    const cleanInternalLinks = sanitizeInternalLinks(
      result.internal_links,
      AVAILABLE_TOOLS,
      availableBlogTitles
    );

    // ── 7. Create Knowledge Asset ──────────────────────────────────────
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .insert({
        keyword: item.keyword,
        topic_type: result.topic_type || 'general',
        subject: result.subject || null,
        summary: result.summary || null,
        key_concepts: result.key_concepts || [],
        definitions: result.definitions || [],
        examples: result.examples || [],
        facts: result.facts || [],
        common_mistakes: result.common_mistakes || [],
        difficulty: result.difficulty || 1,
        tags: result.tags || [],
        source: 'ai_generated',
        status: 'approved',
      })
      .select()
      .single();

    if (assetError) {
      console.error('Knowledge asset insert failed:', assetError);
    }

    // ── 8. Save draft ──────────────────────────────────────────────────
    const slug = result.slug || result.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
    const wordCount = result.content?.split(/\s+/).length || 0;

    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .insert({
        queue_id: queueItemId,
        knowledge_asset_id: asset?.id || null,
        keyword: item.keyword,
        title: result.title,
        url_slug: slug,
        meta_description: result.meta_description,
        tags: result.tags || [],
        content: result.content,
        schemas: JSON.stringify(result.faq || []),
        internal_links: cleanInternalLinks,
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

    // ── 9. Generate image ──────────────────────────────────────────────
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

    // ── 10. Update draft with image metadata (direct service role PATCH) ──
    if (coverImageUrl) {
      console.log('💾 Updating draft with cover_image using service role...');
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set!');
      } else {
        const updateUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/content_drafts?id=eq.${draft.id}`;
        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            cover_image: coverImageUrl,
            image_source: imageMeta.image_source || null,
            image_provider: imageMeta.image_provider || null,
            image_photographer: imageMeta.image_photographer || null,
            image_search_query: imageMeta.image_search_query || null,
            width: IMAGE_PRESETS.hero.width,
            height: IMAGE_PRESETS.hero.height,
          }),
        });
        if (!response.ok) {
          console.error('❌ Direct PATCH failed:', await response.text());
        } else {
          console.log('✅ Draft updated with image metadata.');
        }
      }
    } else {
      console.warn('⚠️ No cover image URL to save – image generation likely failed.');
    }

    // ── 11. Update queue ────────────────────────────────────────────────
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