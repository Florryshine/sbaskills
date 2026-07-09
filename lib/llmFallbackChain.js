// ─── Shared LLM fallback chain ──────────────────────────────────────────
// Same provider order as app/api/content-engine/generate/route.js:
//   Gemini -> Groq -> OpenRouter -> HuggingFace
// Extracted here so new engines (podcast, quiz, etc.) can reuse it without
// copy-pasting the whole chain into every route file.
//
// This does NOT modify or replace the existing blog generate route —
// that route keeps working exactly as-is. New features can adopt this
// helper when convenient.

import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

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

async function tryOpenRouter(prompt, maxTokens) {
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
      max_tokens: maxTokens,
      temperature: 0.8,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function tryHuggingFace(prompt, maxTokens) {
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
        parameters: { max_new_tokens: maxTokens, temperature: 0.8, return_full_text: false },
      }),
    }
  );
  if (!res.ok) throw new Error(`HuggingFace ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.[0]?.generated_text?.trim() || null;
}

/**
 * Run a prompt through the fallback chain until one provider returns text
 * that passes `validate(parsed)`.
 *
 * @param {string} prompt
 * @param {(text: string) => any} parse - turns raw text into your structure (e.g. JSON.parse)
 * @param {(parsed: any) => boolean} validate - returns true if the parsed result is usable
 * @param {number} maxTokens
 * @returns {Promise<{ result: any, usedProvider: string, errors: string[] }>}
 */
export async function generateWithFallback(prompt, parse, validate, maxTokens = 8192) {
  const errors = [];
  let result = null;
  let usedProvider = '';

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
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
        });
        const text = genResult.response.text();
        const parsed = parse(text);
        if (validate(parsed)) {
          result = parsed;
          usedProvider = `Gemini (${modelName})`;
        } else if (parsed) {
          errors.push(`Gemini ${modelName}: parsed but failed validation`);
        }
      } catch (e) {
        errors.push(`Gemini ${modelName}: ${e.message}`);
      }
    }
  }

  // Groq
  if (!result) {
    for (const groqKey of GROQ_KEYS) {
      if (result) break;
      try {
        const groq = new Groq({ apiKey: groqKey });
        const groqResponse = await groq.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: 'llama-3.3-70b-versatile',
          max_tokens: maxTokens,
          temperature: 0.8,
        });
        const text = groqResponse.choices[0].message.content.trim();
        const parsed = parse(text);
        if (validate(parsed)) {
          result = parsed;
          usedProvider = `Groq (${GROQ_KEYS.indexOf(groqKey) + 1})`;
        } else if (parsed) {
          errors.push('Groq: parsed but failed validation');
        }
      } catch (e) {
        errors.push(`Groq: ${e.message}`);
      }
    }
  }

  // OpenRouter
  if (!result) {
    try {
      const text = await tryOpenRouter(prompt, maxTokens);
      if (text) {
        const parsed = parse(text);
        if (validate(parsed)) {
          result = parsed;
          usedProvider = 'OpenRouter';
        } else if (parsed) {
          errors.push('OpenRouter: parsed but failed validation');
        }
      }
    } catch (e) {
      errors.push(`OpenRouter: ${e.message}`);
    }
  }

  // HuggingFace
  if (!result) {
    try {
      const text = await tryHuggingFace(prompt, maxTokens);
      if (text) {
        const parsed = parse(text);
        if (validate(parsed)) {
          result = parsed;
          usedProvider = 'HuggingFace';
        } else if (parsed) {
          errors.push('HuggingFace: parsed but failed validation');
        }
      }
    } catch (e) {
      errors.push(`HuggingFace: ${e.message}`);
    }
  }

  return { result, usedProvider, errors };
}
