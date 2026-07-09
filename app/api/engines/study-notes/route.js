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
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function sanitizeJsonString(str) {
  if (!str) return '';
  // Remove raw control characters (except newline and tab)
  let cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Remove Unicode control characters
  cleaned = cleaned.replace(/[\u200B-\u200F\u2028-\u202F]/g, '');
  // Escape raw newlines inside JSON strings (this is the key fix)
  // We'll use a simple approach: replace raw newlines with \n
  // but only after we've identified the JSON structure
  return cleaned;
}

function extractTitleFromContent(content) {
  const match = content.match(/^#{1,3}\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function buildStudyNotesPrompt(asset) {
  const keyword = asset.keyword || 'this topic';
  const summary = asset.summary || 'No summary available.';
  const keyConcepts = (asset.key_concepts || []).map(k => `- ${k}`).join('\n') || '- No key concepts.';
  const definitions = (asset.definitions || []).map(d => `- **${d.term}**: ${d.definition}`).join('\n') || '- No definitions.';
  const examples = (asset.examples || []).map(ex => `- ${ex}`).join('\n') || '- No examples.';
  const facts = (asset.facts || []).map(f => `- ${f}`).join('\n') || '- No facts.';
  const commonMistakes = (asset.common_mistakes || []).map(m => `- ${m}`).join('\n') || '- No common mistakes.';

  return `You are an expert study note writer for Shiney Brain Academy. Create concise, well‑structured revision notes on the topic: "${keyword}".

The notes should be in **Markdown** and suitable for printing as a PDF.

Sections:
## Overview
${summary}

## Key Concepts
${keyConcepts}

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
- Use this mnemonic: [suggest one]

## Quick Summary Table
| Concept | Key Point |
|---------|-----------|
| ...     | ...       |

## Review Questions
- Q1: ... → A1: ...

Return ONLY a JSON object:
{
  "title": "A suitable title",
  "content": "Full Markdown content"
}
No markdown fences.`;
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

    const prompt = buildStudyNotesPrompt(asset);
    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt generation failed' }, { status: 500 });
    }

    let result = null;
    let usedProvider = '';
    const errors = [];

    // ── GEMINI FIRST (same as podcast, with delay) ────────────────────
    for (const geminiKey of GEMINI_KEYS) {
      if (result) break;
      const client = new GoogleGenerativeAI(geminiKey);
      for (const modelName of GEMINI_MODELS) {
        if (result) break;
        try {
          const model = client.getGenerativeModel({ model: modelName });
          const genResult = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
          });
          const text = genResult.response.text();
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && typeof parsed.content === 'string' && parsed.content.length > 100) {
            if (!parsed.title) {
              parsed.title = extractTitleFromContent(parsed.content) || `${asset.keyword} - Notes`;
            }
            result = parsed;
            usedProvider = `Gemini (${modelName})`;
          } else {
            errors.push(`Gemini ${modelName}: invalid content`);
          }
        } catch (e) {
          errors.push(`Gemini ${modelName}: ${e.message}`);
        }
        // Delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    // ── GROQ FALLBACK ──────────────────────────────────────────────────
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
          const cleaned = sanitizeJsonString(text);
          const parsed = parseJsonFromText(cleaned);
          if (parsed && typeof parsed.content === 'string' && parsed.content.length > 100) {
            if (!parsed.title) {
              parsed.title = extractTitleFromContent(parsed.content) || `${asset.keyword} - Notes`;
            }
            result = parsed;
            usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
          } else {
            errors.push('Groq: invalid content');
          }
        } catch (e) {
          const raw = e.response?.data || e.message || '';
          errors.push(`Groq: ${e.message} (raw: ${raw.substring(0, 100)})`);
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
          if (parsed && typeof parsed.content === 'string' && parsed.content.length > 100) {
            if (!parsed.title) {
              parsed.title = extractTitleFromContent(parsed.content) || `${asset.keyword} - Notes`;
            }
            result = parsed;
            usedProvider = 'OpenRouter';
          } else {
            errors.push('OpenRouter: invalid content');
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
          if (parsed && typeof parsed.content === 'string' && parsed.content.length > 100) {
            if (!parsed.title) {
              parsed.title = extractTitleFromContent(parsed.content) || `${asset.keyword} - Notes`;
            }
            result = parsed;
            usedProvider = 'HuggingFace';
          } else {
            errors.push('HuggingFace: invalid content');
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

    const title = result.title || `${asset.keyword} - Revision Notes`;
    const content = result.content || '';

    if (!content || content.trim().length < 50) {
      return NextResponse.json({ error: 'Generated content is too short' }, { status: 500 });
    }

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
      console.error('Insert error:', draftError);
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
    console.error('Study notes error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
    }
