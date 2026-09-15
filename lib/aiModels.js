// lib/aiModels.js
//
// Single source of truth for every LLM model ID used in this app.
// Model IDs are the thing that rots fastest, so nothing else should
// hardcode them — import from here and override via env when a provider
// deprecates something, instead of hunting through ten route files.
//
// Last verified: September 2026
//   Gemini  — 2.0-flash shut down 2026-06-01; 2.5-flash / 2.5-pro shut
//             down October 2026. "gemini-3.5-flash" was never a valid
//             generateContent model (3.5 is the Transcribe line), which
//             is why it returned a 0-quota 429.
//   Groq    — llama-3.3-70b-versatile deprecated 2026-06-17, decommissioned
//             2026-08-16 on free/developer tiers. Google's recommended
//             replacement is openai/gpt-oss-120b.

const fromEnvList = (v, fallback) =>
  v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback;

// Ordered best → cheapest. The chain walks this list on failure.
export const GEMINI_MODELS = fromEnvList(process.env.GEMINI_MODELS, [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
]);

export const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
export const GROQ_MODEL_FAST = process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b';

export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
