import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ── Keys and providers ──────────────────────────────────────────────
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
      temperature: 0.7,
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
        parameters: { max_new_tokens: 4096, temperature: 0.7, return_full_text: false },
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0]?.generated_text?.trim() || null;
}

// ── Study Notes prompt ──────────────────────────────────────────────
function buildStudyNotesPrompt(asset) {
  const keyword = asset.keyword;
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).join('\n- ');
  const definitions = (asset.definitions || [])
    .map(d => `- **${d.term}**: ${d.definition}`)
    .join('\n');
  const examples = (asset.examples || []).map(ex => `- ${ex}`).join('\n');
  const facts = (asset.facts || []).map(f => `- ${f}`).join('\n');
  const commonMistakes = (asset.common_mistakes || []).map(m => `- ${m}`).join('\n');

  return `You are an expert study note writer for Shiney Brain Academy. Create concise, well‑structured revision notes on the topic: "${keyword}".

The notes should be in **Markdown** and suitable for printing as a PDF. Use headings (##, ###), bullet points, bold for key terms, and a clear hierarchy.

Include the following sections:

## Overview
A brief summary of the topic (2‑3 sentences).

## Key Concepts
- ${keyConcepts}

## Important Definitions
${definitions}

## Examples
${examples}

## Key Facts
${facts}

## Common Mistakes to Avoid
${commonMistakes}

## Exam Tips
- Look out for questions on [mention specific areas]
- Practice [specific skill]
- Use this mnemonic: [suggest one if relevant]

## Quick Summary Table (optional)
| Concept | Key Point |
|---------|-----------|
| ...     | ...       |

## Review Questions (5 short questions with answers)
- Q1: ... → A1: ...

Keep the language clear and student‑friendly. Aim for about 800–1200 words total.

Return ONLY a JSON object with:
{
  "title": "A suitable title for the notes (e.g., 'JAMB Biology: Photosynthesis Revision Notes')",
  "content": "The full Markdown content as described"
}
No markdown fences around the JSON, no extra text.`;
}

// ── Main POST ──────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // 1. Fetch asset
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    // 2. Build prompt
    const prompt = buildStudyNotesPrompt(asset);

    // 3. Generate notes
    let result = null;
    let usedProvider = '';
    const errors = [];

    // Gemini
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
              maxOutputTokens: 4096,
              temperature: 0.7,
            },
          });
          const text = genResult.response.text();
          const parsed = parseJsonFromText(text);
          if (parsed && typeof parsed.content === 'string' && parsed.content.trim().length > 200) {
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: insufficient content`);
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
            max_tokens: 4096,
            temperature: 0.7,
          });
          const text = groqResponse.choices[0].message.content.trim();
          const parsed = parseJsonFromText(text);
          if (parsed && typeof parsed.content === 'string' && parsed.content.trim().length > 200) {
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: insufficient content');
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
          if (parsed && typeof parsed.content === 'string' && parsed.content.trim().length > 200) {
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: insufficient content');
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
          if (parsed && typeof parsed.content === 'string' && parsed.content.trim().length > 200) {
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: insufficient content');
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

    // 4. Insert into study_note_drafts
    const title = result.title || `${asset.keyword} - Revision Notes`;
    const content = result.content;

    const { data: draft, error: draftError } = await supabase
      .from('study_note_drafts')
      .insert({
        knowledge_asset_id: asset.id,
        keyword: asset.keyword,
        title: title,
        content: content,
        status: 'draft',
        generated_from: 'knowledge_asset',
        version: 1,
      })
      .select()
      .single();

    if (draftError) {
      return NextResponse.json({ error: draftError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      studyNoteDraftId: draft.id,
      title: title,
      contentLength: content.length,
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Study Notes generation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}