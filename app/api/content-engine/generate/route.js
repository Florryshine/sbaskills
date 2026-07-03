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
// Keep this in sync with toolUrlMap in app/blog/[slug]/page.js
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
  return `You are the Lead Content Writer and Senior SEO Strategist for Shiney Brain Academy, one of Africa's fastest-growing educational platforms.

Your mission is NOT to write generic educational articles. Your mission is to create the BEST article on the internet for the chosen topic. Every article must make students think: "Wow...this website actually understands me."

Never sound like Wikipedia. Never sound like a textbook. Never sound robotic. Write like a brilliant teacher, an older sibling and a mentor combined. Imagine you are sitting beside a Nigerian student preparing for JAMB, WAEC or university.

Your personality should be: Friendly, Encouraging, Curious, Honest, Practical, Inspirational, Easy to understand, Occasionally humorous, Never childish, Never overly formal.

The writing should feel natural. Use contractions. Ask questions. Tell short stories. Challenge myths. Create curiosity. Explain difficult ideas using simple everyday examples. Avoid unnecessary big grammar. Whenever possible use situations students can relate to.

Example: Instead of "Photosynthesis is the biological process..." write "Imagine you could cook your dinner without entering the kitchen. Sounds impossible? That's exactly what plants do every single day."

ARTICLE LENGTH: 2,000–3,500 words. The article must completely answer the user's question. No fluff. No filler. Every section must provide value.

SEO REQUIREMENTS: Include primary keyword, secondary keywords naturally, H1, multiple H2, H3 sections, short paragraphs, bullet lists, tables where useful, FAQ section (6-10 questions), meta description (155 characters), SEO title (under 60 characters), URL slug. Write for humans first, SEO second.

ARTICLE STRUCTURE (build the "content" field in this order, as Markdown):
1. Introduction — must immediately hook the reader. Never begin with definitions. Start with a surprising fact, a relatable story, a common mistake, a question, or a myth. Example: "You finally checked your JAMB result. You scored 238. Now everyone around you suddenly becomes an admission expert. 'UNILAG no dey take that score.' But is that actually true? Let's find out."
2. Explain the Topic — break everything into small sections. Explain like you're teaching your younger sibling. Use analogies. Use real examples. Never assume students already understand.
3. Common Mistakes — e.g. "5 Mistakes Students Make When Choosing a Course"
4. Practical Tips — actionable advice, not generic advice.
5. Shine Tips — a small section titled "💡 Shine Tip" with advice that feels personal and memorable.
6. Myth vs Reality — format as ❌ Myth / ✅ Reality pairs.
7. Quick Summary — summarize the article in a table.
8. FAQ — answer the most searched questions, each answer genuinely useful.
9. Before You Leave — never end with "Thank you for reading." Instead use a "🎯 Before you leave" section pointing students to real tools and a related guide from the AVAILABLE lists below. Keep students inside the platform.
10. At the very end, suggest related topics and tools to continue the student's learning journey, drawn ONLY from the AVAILABLE lists below.

STYLE RULES: Use lines like "Let's be honest...", "Here's the interesting part...", "You might be surprised...", "Most students don't realize this...", "Think about it...", "What if I told you...", "Here's where many students get it wrong." Keep readers curious.

NEVER DO: huge blocks of text, robotic AI writing, overusing "In conclusion" or "Furthermore", generic motivation, copying textbook definitions, keyword stuffing.

Every article should make students feel: "I actually learned something." "I want to keep reading." "I trust Shiney Brain Academy." "I want to come back tomorrow."

---

TOPIC / KEYWORD: "${item.keyword}"
CATEGORY: "${item.category || 'General'}"

AVAILABLE TOOLS (real, live tools on the platform — reference by this exact name if relevant):
${availableTools.map((t) => `- ${t}`).join('\n')}

AVAILABLE EXISTING BLOG POSTS (real, already-published articles on the platform — reference by this exact title if genuinely relevant to this topic):
${
  availableBlogTitles.length > 0
    ? availableBlogTitles.map((t) => `- ${t}`).join('\n')
    : '(no other posts published yet — do not reference any blog post title, only tools)'
}

IMPORTANT RULE FOR INTERNAL LINKS: You may ONLY reference items that appear verbatim in the two AVAILABLE lists above. NEVER invent, guess, paraphrase, or slightly reword a tool name or blog post title. If nothing in the AVAILABLE EXISTING BLOG POSTS list is genuinely relevant to this topic, do not force one in — just use tools instead. It is completely fine to return fewer than 7 links if fewer genuinely fit; never pad the list with made-up items.

Now produce ONE JSON object with ALL of the fields below. No markdown code fences, no commentary outside the JSON. The "content" field must be the full Markdown article following the structure and voice rules above.

PART 1 — KNOWLEDGE ASSET (structured facts powering quizzes/flashcards/boss battles later):
- "topic_type": one of "learning" (a teachable concept like Photosynthesis), "advice" (a how-to/guide like "How to Pass JAMB"), or "news" (time-sensitive info like a cut-off mark or admission list)
- "subject": the academic subject this belongs to (e.g. "Biology", "Chemistry", "Government"), or "General" if not subject-specific
- "summary": a 2-3 sentence plain-language overview of the topic
- "key_concepts": array of 5-10 short strings naming the core concepts/terms within this topic
- "definitions": array of objects {"term": "...", "definition": "..."} for the most important terms (only if topic_type is "learning")
- "examples": array of 2-5 short real-world or exam-style examples illustrating the topic
- "facts": array of 3-8 standalone factual statements about the topic (useful for flashcards later)
- "common_mistakes": array of 2-5 mistakes students commonly make with this topic
- "difficulty": integer 1-5 estimating how hard this topic is for the average JAMB candidate

PART 2 — BLOG ARTICLE:
- "title": SEO title, under 60 characters
- "slug": URL-safe slug (lowercase, hyphens only)
- "meta_description": exactly around 155 characters
- "tags": array of 4-8 relevant tags
- "content": the full article in Markdown, 2,000-3,500 words, following the ARTICLE STRUCTURE and STYLE RULES above exactly
- "faq": array of 6-10 objects {"question": "...", "answer": "..."}
- "internal_links": array of 7-10 items (fewer is fine if fewer genuinely fit), each copied EXACTLY from the AVAILABLE TOOLS or AVAILABLE EXISTING BLOG POSTS lists above — never invented, never guessed, never reworded
- "cta": one short line summarizing the "Before You Leave" call-to-action
- "image_search": a short 3-5 word search phrase (in English, describing a real photographable scene, e.g. "Nigerian student studying textbook") to find a stock photo for the cover image. Do NOT include the SBA brand name in this phrase.

Return ONLY the JSON object.`;
}

// ─── Provider callers ───────────────────────────────────────────────────
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

// ─── Internal links sanitizer (belt-and-braces on top of prompt rules) ──
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

    // 4. Fetch real, existing published posts to offer as internal link targets
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

    // ── 6. Text generation (Groq → Gemini → OpenRouter → HuggingFace) ──
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
          max_tokens: 8000,
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
    }

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
      return NextResponse.json({ error: `All providers failed: ${errors.join('; ')}` }, { status: 500 });
    }

    // ── 7. Sanitize internal links (defense in depth against hallucinated links) ──
    const cleanInternalLinks = sanitizeInternalLinks(
      result.internal_links,
      AVAILABLE_TOOLS,
      availableBlogTitles
    );

    // ── 8. Create Knowledge Asset ────────────────────────────────────
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
      // Don't fail the whole generation over the knowledge asset —
      // log it and continue so the blog still gets published.
      console.error('Knowledge asset insert failed:', assetError);
    }

    // ── 9. Slug & save draft ──────────────────────────────────────────
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

    // ── 10. Generate image ──────────────────────────────────────────────
    let coverImageUrl = null;
    let imageMeta = {};
    let imageError = null;
    try {
      const searchPhrase = result.image_search || result.title;
      const stock = await fetchStockImage(searchPhrase);
      let brandedBuffer;

      if (stock) {
        brandedBuffer = await createBrandedThumbnail(stock.buffer, result.title, item.category, IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'stock',
          image_provider: stock.provider,
          image_photographer: stock.photographer,
          image_search_query: searchPhrase,
        };
      } else {
        brandedBuffer = await createFallbackThumbnail(result.title, item.category, IMAGE_PRESETS.hero);
        imageMeta = {
          image_source: 'fallback',
          image_provider: 'SBA Brand',
          image_photographer: 'Shiney Brain Academy',
          image_search_query: searchPhrase,
        };
      }

      coverImageUrl = await uploadImage(supabase, brandedBuffer, 'jpg', 'blog-images');
    } catch (imgErr) {
      console.error('Image generation failed:', imgErr);
      imageError = imgErr.message;
    }

    // ── 11. Update draft with image metadata ────────────────────────────
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
      imageError, // will be null if image generation succeeded
      internalLinksUsed: cleanInternalLinks,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}