// lib/llmFallbackChain.js
//
// Shared multi-provider text generation used by content-engine/generate
// (the deep-research step that produces knowledge_assets), engines/blog,
// engines/visual-blueprint, and content-engine/podcast/generate.
//
// This used to be a hardcoded stub that always returned a fake Facebook
// sample post — every caller silently got nonsense back and failed
// validation. This is the real implementation, ported from the working
// provider chain already proven in engines/social, engines/quiz, etc.,
// so every engine now shares one tested fallback path instead of each
// reimplementing (or never implementing) its own.
//
// Order: Gemini (multiple keys x multiple models) → Groq (multiple keys)
// → OpenRouter → HuggingFace. First provider to return a non-empty
// response wins; callers are responsible for validating/parsing the
// content (see lib/robustJsonParse.js for JSON-shaped responses).

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

// Kept in sync with engines/social's model list (the known-good chain).
// gemini-2.0-flash and gemini-3.5-pro were dropped here on purpose:
// 2.0-flash was shut down by Google on 2026-06-01 and 3.5-pro was not
// reliably available — both burned a fallback attempt on every call.
const GEMINI_MODELS = [
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function tryGemini(prompt, { maxTokens, temperature }) {
  for (const key of GEMINI_KEYS) {
    const client = new GoogleGenerativeAI(key);
    for (const modelName of GEMINI_MODELS) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        });
        const text = result.response.text();
        if (text && text.trim()) return { text, provider: `Gemini (${modelName})` };
      } catch (e) {
        // try next model / key
      }
    }
  }
  return null;
}

async function tryGroq(prompt, { maxTokens, temperature }) {
  for (const key of GROQ_KEYS) {
    try {
      const groq = new Groq({ apiKey: key });
      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        max_tokens: maxTokens,
        temperature,
      });
      const text = response.choices?.[0]?.message?.content?.trim();
      if (text) return { text, provider: `Groq (${GROQ_MODEL})` };
    } catch (e) {
      // try next key
    }
  }
  return null;
}

async function tryOpenRouter(prompt, { maxTokens, temperature }) {
  if (!OPENROUTER_API_KEY) return null;
  try {
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
        temperature,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (text) return { text, provider: 'OpenRouter' };
  } catch (e) {
    // fall through
  }
  return null;
}

async function tryHuggingFace(prompt, { maxTokens, temperature }) {
  if (!HUGGINGFACE_API_KEY) return null;
  try {
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
          parameters: { max_new_tokens: maxTokens, temperature, return_full_text: false },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.[0]?.generated_text?.trim();
    if (text) return { text, provider: 'HuggingFace' };
  } catch (e) {
    // fall through
  }
  return null;
}

/**
 * Generates text/structured data from the first provider in the fallback
 * chain that returns a response the caller considers valid.
 *
 * Supports two call signatures, both used across the codebase:
 *
 *   1. generateWithFallback(prompt, parseFn, validateFn, maxTokens)
 *      → { result, usedProvider, errors }
 *      Used by engines/blog, engines/visual-blueprint,
 *      content-engine/podcast/generate, content-engine/generate. Tries
 *      each provider in order; for each response, calls parseFn(text) then
 *      validateFn(parsed), and only stops at the first provider whose
 *      output passes validation (not just the first that responds at all —
 *      this is what actually gives the "fallback" behavior its value,
 *      since a provider can respond with malformed/incomplete JSON).
 *
 *   2. generateWithFallback(prompt, { maxTokens, temperature })
 *      → raw text string
 *      Used by lib/content-factory/generators/_shared.js. Returns the
 *      first non-empty response as-is; caller parses/validates itself.
 *      Throws if every provider fails, so the caller can surface a real
 *      error instead of silently proceeding with bad data.
 */
export async function generateWithFallback(prompt, arg2, validateFn, maxTokens) {
  const attempts = [tryGemini, tryGroq, tryOpenRouter, tryHuggingFace];
  const errors = [];

  // Signature 1: (prompt, parseFn, validateFn, maxTokens)
  if (typeof arg2 === 'function') {
    const parseFn = arg2;
    const opts = { maxTokens: maxTokens || 4096, temperature: 0.7 };

    for (const attempt of attempts) {
      let response;
      try {
        response = await attempt(prompt, opts);
      } catch (e) {
        errors.push(e.message);
        continue;
      }
      if (!response) continue;

      try {
        const parsed = parseFn(response.text);
        if (parsed && (!validateFn || validateFn(parsed))) {
          return { result: parsed, usedProvider: response.provider, errors };
        }
        errors.push(`${response.provider}: response failed validation`);
      } catch (e) {
        errors.push(`${response.provider}: ${e.message}`);
      }
    }

    return { result: null, usedProvider: null, errors };
  }

  // Signature 2: (prompt, { maxTokens, temperature }) → raw text
  const options = arg2 || {};
  const opts = {
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature ?? 0.7,
  };

  for (const attempt of attempts) {
    try {
      const response = await attempt(prompt, opts);
      if (response) return response.text;
    } catch (e) {
      errors.push(e.message);
    }
  }

  throw new Error(
    `All LLM providers failed or returned empty output.${errors.length ? ' Errors: ' + errors.join('; ') : ''}`
  );
}
