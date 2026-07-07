import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── Keys ──────────────────────────────────────────────────────────────
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
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

// ── Helpers ──────────────────────────────────────────────────────────
function parseJsonFromText(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return JSON.parse(match[0]);
}

function sanitizeJsonString(str) {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
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
      max_tokens: 4096,
      temperature: 0.8,
    }),
  });
  if (!res.ok) return null;
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
        parameters: { max_new_tokens: 4096, temperature: 0.8, return_full_text: false },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0]?.generated_text?.trim() || null;
}

// ── Social Posts prompt ─────────────────────────────────────────────
function buildSocialPrompt(asset) {
  const keyword = asset.keyword || 'this topic';
  const summary = asset.summary || 'No summary available.';
  const keyConcepts = (asset.key_concepts && asset.key_concepts.length > 0)
    ? asset.key_concepts.slice(0, 3).join(', ')
    : 'key concepts not provided';
  const examples = (asset.examples && asset.examples.length > 0)
    ? asset.examples.slice(0, 2).join('; ')
    : 'No examples provided.';

  return `You are a social media marketer for Shiney Brain Academy. Create engaging social media posts to promote the topic: "${keyword}".

Summary: ${summary}
Key Concepts: ${keyConcepts}
Examples: ${examples}

Create posts for the following platforms:

1. **Facebook** (longer, educational, community‑oriented)
2. **WhatsApp** (short, conversational, for groups)
3. **Instagram** (short, visual, with emojis and hashtags)
4. **X (Twitter)** (very short, under 280 chars, attention‑grabbing)
5. **Telegram** (educational, engaging, with emojis)

Each post should:
- Be engaging and encourage clicks/engagement.
- Include relevant emojis.
- End with a call‑to‑action (e.g., "📚 Read the full article at Shiney Brain Academy" or "🧠 Test yourself with our quiz!").
- Mention Shiney Brain Academy naturally.

Return ONLY a JSON object with a "posts" array containing 5 objects, each with:
- "platform": one of ["facebook", "whatsapp", "instagram", "x", "telegram"]
- "caption": the post text

No markdown, no extra text.`;
}

// ── Main POST ──────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const prompt = buildSocialPrompt(asset);

    // Validate prompt
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.error('❌ Social posts prompt is empty or invalid:', { prompt });
      return NextResponse.json({ error: 'Failed to generate prompt from asset' }, { status: 500 });
    }

    console.log(`📝 Social posts prompt length: ${prompt.length}`);
    console.log(`📝 First 200 chars: ${prompt.substring(0, 200)}...`);

    let result = null;
    let usedProvider = '';
    const errors = [];

    // ── Gemini ──────────────────────────────────────────────────────
    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.8 },
          });
          const text = genResult.response.text();
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.posts) && parsed.posts.length >= 4) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: insufficient posts`);
          }
        } catch (e) {
          errors.push(`Gemini ${modelName}: ${e.message}`);
        }
      }
    }

    // ── Groq ────────────────────────────────────────────────────────
    if (!result) {
      for (const groqKey of GROQ_KEYS) {
        if (result) break;
        try {
          const groq = new Groq({ apiKey: groqKey });
          const groqResponse = await groq.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'llama-3.3-70b-versatile',
            max_tokens: 4096,
            temperature: 0.8,
          });
          const text = groqResponse.choices[0].message.content.trim();
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.posts) && parsed.posts.length >= 4) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: insufficient posts');
          }
        } catch (e) {
          errors.push(`Groq: ${e.message}`);
        }
      }
    }

    // ── OpenRouter ─────────────────────────────────────────────────
    if (!result) {
      try {
        const text = await tryOpenRouter(prompt);
        if (text) {
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.posts) && parsed.posts.length >= 4) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: insufficient posts');
          }
        }
      } catch (e) {
        errors.push(`OpenRouter: ${e.message}`);
      }
    }

    // ── HuggingFace ────────────────────────────────────────────────
    if (!result) {
      try {
        const text = await tryHuggingFace(prompt);
        if (text) {
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && Array.isArray(parsed.posts) && parsed.posts.length >= 4) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: insufficient posts');
          }
        }
      } catch (e) {
        errors.push(`HuggingFace: ${e.message}`);
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: `All providers failed: ${errors.join('; ')}` },
        { status: 500 }
      );
    }

    // ── Insert each post as a separate row ─────────────────────────
    const posts = result.posts.slice(0, 5);
    const inserted = [];

    for (const post of posts) {
      const { data: draft, error: draftError } = await supabase
        .from('social_post_drafts')
        .insert({
          knowledge_asset_id: asset.id,
          keyword: asset.keyword,
          platform: post.platform,
          caption: post.caption,
          status: 'draft',
          generated_from: 'knowledge_asset',
          version: 1,
        })
        .select()
        .single();

      if (draftError) {
        console.error(`Failed to insert ${post.platform}:`, draftError);
      } else {
        inserted.push(draft);
      }
    }

    if (inserted.length === 0) {
      return NextResponse.json({ error: 'Failed to save any posts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postCount: inserted.length,
      postIds: inserted.map(p => p.id),
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Social posts generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}