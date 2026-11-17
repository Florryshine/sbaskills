/**
 * Resilient Gemini text client for the Musical Learning Studio.
 *
 * Discovers models the configured key can call, classifies failures, retries
 * transient errors with bounded exponential backoff, and never exposes keys.
 */
export type GeminiErrorCategory =
  | 'overload' | 'rate_limit' | 'quota' | 'invalid_model' | 'permission'
  | 'bad_request' | 'timeout' | 'network' | 'empty' | 'truncated';

export interface GeminiAttempt {
  model: string;
  category: GeminiErrorCategory | 'ok';
  status?: number;
  ms: number;
}

export interface GeminiResult {
  text: string | null;
  model?: string;
  attempts: GeminiAttempt[];
  userMessage?: string;
  category?: GeminiErrorCategory;
  modelListSource: 'api' | 'configured-default';
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];
const MODEL_CACHE_MS = 10 * 60 * 1000;
const modelCache = new Map<string, { at: number; models: string[] }>();

function redact(value: string): string {
  return value.replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[redacted-key]').slice(0, 300);
}

function getKeys(): string[] {
  return Array.from(new Set([
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter((v): v is string => Boolean(v && v.trim())).map((v) => v.trim()))).slice(0, 3);
}

export function classify(status: number, message: string): GeminiErrorCategory {
  const m = message.toLowerCase();
  if (status === 401 || status === 403) return 'permission';
  if (status === 404) return 'invalid_model';
  if (status === 429) return /quota|exhausted|billing|per day/.test(m) ? 'quota' : 'rate_limit';
  if (status === 400) return /model|not found|not supported/.test(m) ? 'invalid_model' : 'bad_request';
  if (status === 500 || status === 502 || status === 503 || status === 504) return 'overload';
  return 'bad_request';
}

const TRANSIENT = new Set<GeminiErrorCategory>(['overload', 'rate_limit', 'timeout', 'network']);

function rankModels(names: string[]): string[] {
  const supported = names.filter((name) => /^gemini-\d+(\.\d+)?-(flash|flash-lite)$/.test(name));
  const version = (name: string) => parseFloat(name.match(/^gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  return supported.sort((a, b) => version(b) - version(a) || (a.endsWith('lite') ? 1 : -1));
}

async function listModels(key: string): Promise<string[] | null> {
  // Use a short hash-like suffix only as an in-process cache partition, never as a credential.
  const cacheKey = key.slice(-8);
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.at < MODEL_CACHE_MS) return cached.models;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(`${BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': key },
      signal: controller.signal,
      cache: 'no-store',
    }).finally(() => clearTimeout(timer));
    if (!response.ok) return null;
    const json = await response.json() as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
    };
    const names = (json.models ?? [])
      .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model) => (model.name ?? '').replace(/^models\//, ''))
      .filter(Boolean);
    modelCache.set(cacheKey, { at: Date.now(), models: names });
    return names;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateJsonText(
  system: string,
  user: string,
  options: { totalMs?: number; maxAttemptsPerModel?: number } = {},
): Promise<GeminiResult> {
  const attempts: GeminiAttempt[] = [];
  const keys = getKeys();
  const deadline = Date.now() + (options.totalMs ?? 50000);
  const maxAttempts = options.maxAttemptsPerModel ?? 3;

  if (!keys.length) {
    return {
      text: null,
      attempts,
      modelListSource: 'configured-default',
      category: 'permission',
      userMessage: 'No Gemini API key is configured on the server. Add GEMINI_API_KEY_1 (or GEMINI_API_KEY) in Vercel and redeploy.',
    };
  }

  let keyIndex = 0;
  const preferred = [
    process.env.GEMINI_MODEL?.trim(),
    ...(process.env.GEMINI_MODELS ?? '').split(',').map((value) => value.trim()),
  ].filter((value): value is string => Boolean(value));

  const available = await listModels(keys[0]);
  const modelListSource = available ? 'api' : 'configured-default';
  const ranked = available ? rankModels(available) : [];
  const configured = available ? preferred.filter((model) => available.includes(model)) : preferred;
  let models = Array.from(new Set([...configured, ...(available ? ranked : DEFAULT_MODELS)])).slice(0, 3);
  if (!models.length) models = DEFAULT_MODELS;

  let last: { category: GeminiErrorCategory; message: string } = {
    category: 'empty',
    message: 'Gemini returned no text.',
  };
  let useThinking = true;

  for (const model of models) {
    let maxTokens = 4096;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 2000) return finish();
      const started = Date.now();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(25000, remaining - 500));
      let category: GeminiErrorCategory | 'ok' = 'ok';
      let status: number | undefined;
      let retryAfterMs = 0;

      try {
        const response = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': keys[keyIndex] },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              maxOutputTokens: maxTokens,
              temperature: 1,
              ...(useThinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
            },
          }),
          signal: controller.signal,
          cache: 'no-store',
        });
        status = response.status;
        const json = await response.json().catch(() => null) as {
          error?: { message?: string };
          candidates?: Array<{
            finishReason?: string;
            content?: { parts?: Array<{ text?: string }> };
          }>;
        } | null;

        if (!response.ok) {
          const message = redact(json?.error?.message || `HTTP ${response.status}`);
          category = classify(response.status, message);
          last = { category, message };
          const retryAfter = Number(response.headers.get('retry-after'));
          if (Number.isFinite(retryAfter) && retryAfter > 0) retryAfterMs = Math.min(retryAfter * 1000, 8000);
          if (category === 'bad_request' && /thinking/i.test(message) && useThinking) {
            useThinking = false;
            attempts.push({ model, category, status, ms: Date.now() - started });
            attempt--;
            continue;
          }
        } else {
          const candidate = json?.candidates?.[0];
          const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
          if (candidate?.finishReason === 'MAX_TOKENS') {
            category = 'truncated';
            last = { category, message: 'Gemini output was cut off by the token limit.' };
            maxTokens = Math.min(maxTokens * 2, 8192);
          } else if (!text) {
            category = 'empty';
            last = { category, message: `Gemini returned no text (finishReason ${candidate?.finishReason ?? 'none'}).` };
          } else {
            attempts.push({ model, category: 'ok', status, ms: Date.now() - started });
            console.info('[music-studio] gemini ok', { model, attempts: attempts.length });
            return { text, model, attempts, modelListSource };
          }
        }
      } catch (error) {
        category = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network';
        last = {
          category,
          message: category === 'timeout' ? 'Gemini request timed out.' : redact(error instanceof Error ? error.message : 'Network error'),
        };
      } finally {
        clearTimeout(timer);
      }

      attempts.push({ model, category, status, ms: Date.now() - started });
      console.warn('[music-studio] gemini attempt failed', { model, category, status, attempt: attempt + 1 });

      if (category === 'bad_request') return finish();
      if (category === 'permission') {
        if (keyIndex + 1 < keys.length) {
          keyIndex++;
          attempt--;
          continue;
        }
        return finish();
      }
      if (category === 'quota') {
        if (keyIndex + 1 < keys.length) {
          keyIndex++;
          attempt--;
          continue;
        }
        break;
      }
      if (category === 'invalid_model' || category === 'empty') break;
      if (category === 'truncated') continue;
      if (TRANSIENT.has(category as GeminiErrorCategory) && attempt + 1 < maxAttempts) {
        const exponential = Math.min(8000, 1000 * 2 ** attempt);
        const wait = Math.max(retryAfterMs, Math.random() * exponential);
        if (Date.now() + wait > deadline - 2000) return finish();
        await sleep(wait);
      }
    }
  }
  return finish();

  function finish(): GeminiResult {
    return {
      text: null,
      attempts,
      modelListSource,
      category: last.category,
      userMessage: describe(last.category, models, attempts),
    };
  }
}

function describe(category: GeminiErrorCategory, models: string[], attempts: GeminiAttempt[]): string {
  const tried = Array.from(new Set(attempts.map((attempt) => attempt.model))).join(', ') || models.join(', ');
  switch (category) {
    case 'overload':
      return `Google's Gemini service is overloaded right now (tried ${tried}, retried with backoff). Wait a minute and press Regenerate.`;
    case 'rate_limit':
      return `Gemini rate limit reached (tried ${tried}). Wait a moment and press Regenerate.`;
    case 'quota':
      return 'The Gemini API quota for the configured key(s) is exhausted. Check usage and billing in Google AI Studio.';
    case 'invalid_model':
      return `None of the tried models (${tried}) is available to this API key. Set GEMINI_MODEL to a model your key can use.`;
    case 'permission':
      return 'The Gemini API key was rejected (invalid, restricted or disabled). Check the server-side Gemini key configuration.';
    case 'bad_request':
      return 'Gemini rejected the request as malformed. Check the server logs for details.';
    case 'timeout':
      return 'Gemini did not answer in time. Press Regenerate.';
    case 'network':
      return 'The server could not reach Gemini. Press Regenerate.';
    case 'truncated':
      return 'Gemini cut the song off before finishing. Try a shorter duration, then Regenerate.';
    default:
      return 'Gemini returned no usable lyrics. Press Regenerate.';
  }
}
