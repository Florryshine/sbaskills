// z-ai SDK helpers: LLM JSON generation with repair (mirrors sbaskills
// generateWithFallback + robustJsonParse philosophy), and TTS synthesis.
import fs from "fs";
import path from "path";
import os from "os";
import ZAI from "z-ai-web-dev-sdk";

let _zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let _zaiConfigMtime = 0;

function configFilePath(): string | null {
  // Same resolution order as the SDK: project dir, home dir, /etc.
  const candidates = [
    path.join(process.cwd(), ".z-ai-config"),
    path.join(os.homedir(), ".z-ai-config"),
    "/etc/.z-ai-config",
  ];
  for (const p of candidates) {
    try { fs.accessSync(p); return p; } catch { /* try next */ }
  }
  return null;
}

export async function getZai() {
  // The sandbox gateway rotates the token inside the config file. A dev
  // server is long-lived, so a client cached forever would keep sending a
  // stale token -> intermittent 401 "missing X-Token header". Recreate the
  // client whenever the config file changes (a stat() per call is cheap).
  let mtime = 0;
  const cfg = configFilePath();
  if (cfg) { try { mtime = fs.statSync(cfg).mtimeMs; } catch { /* ignore */ } }
  if (!_zai || mtime !== _zaiConfigMtime) {
    _zai = await ZAI.create();
    _zaiConfigMtime = mtime;
  }
  return _zai;
}

/** Drop the cached client (e.g. after an auth error) so the next call
 * re-reads the (possibly rotated) config. */
export function resetZai() { _zai = null; }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Gateway auth failures are transient (token rotation) — recoverable by
 * refreshing the client and retrying; distinct from real usage errors. */
function isAuthError(msg: string): boolean {
  return /401|missing x-token|unauthorized/i.test(msg);
}

/** Repair common LLM JSON breakage: unescaped inner quotes, raw newlines
 * inside strings, trailing commas, smart quotes. */
function repairJson(body: string): string {
  let out = "";
  let inStr = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (!inStr) {
      if (ch === '"') inStr = true;
      out += ch;
      continue;
    }
    // inside a string
    if (ch === "\\") {
      out += ch;
      if (i + 1 < body.length) { out += body[i + 1]; i++; }
      continue;
    }
    if (ch === '"') {
      // lookahead: a real closing quote is followed (after optional space) by , } ] or :
      let j = i + 1;
      while (j < body.length && /\s/.test(body[j])) j++;
      const nxt = body[j];
      if (nxt === "," || nxt === "}" || nxt === "]" || nxt === ":" || j >= body.length) {
        inStr = false;
        out += ch;
      } else {
        out += '\\"'; // unescaped inner quote -> escape it
      }
      continue;
    }
    if (ch === "\n") { out += "\\n"; continue; }
    if (ch === "\t") { out += "\\t"; continue; }
    out += ch;
  }
  return out;
}

/** Extract the first balanced JSON object/array from arbitrary LLM text. */
export function parseJsonFromText(text: string): unknown {
  if (!text) throw new Error("empty response");
  let t = text.trim();
  // strip code fences
  t = t.replace(/```(?:json)?/gi, "```");
  const fenceParts = t.split("```");
  if (fenceParts.length > 1) {
    for (const part of fenceParts) {
      const p = part.trim();
      if (p.startsWith("{") || p.startsWith("[")) { t = p; break; }
    }
  }
  const start = t.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in response");
  const open = t[start];
  const close = open === "{" ? "}" : "]";
  // find balanced end (string-aware)
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  let body = end !== -1 ? t.slice(start, end) : t.slice(start);
  body = body.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const cleanup = (s: string) => s.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(cleanup(body));
  } catch {
    // tolerant repair for unescaped quotes / raw newlines inside strings
    let repaired = cleanup(repairJson(body));
    try {
      return JSON.parse(repaired);
    } catch {
      // last-ditch: rebuild broken hashtag arrays (half-quoted "#tag" tokens)
      repaired = repaired.replace(
        /"hashtags"\s*:\s*\[([^\]]*)\]/g,
        (_m, inner: string) => {
          const tags = (inner.match(/[A-Za-z0-9_]+/g) || []).slice(0, 6);
          return `"hashtags": [${tags.map((t: string) => `"${t}"`).join(", ")}]`;
        }
      );
      try {
        return JSON.parse(cleanup(repaired));
      } catch {
        // final fallback: strip line comments and quote bare #tokens
        repaired = repaired
          .replace(/^\s*\/\/.*$/gm, "")
          .replace(/([\[,\s])#([A-Za-z0-9_]+)/g, '$1"$2"');
        return JSON.parse(cleanup(repaired));
      }
    }
  }
}

/** Ask the LLM for JSON; retries with a repair prompt on parse/validate failure. */
export async function generateJson<T>(opts: {
  prompt: string;
  system?: string;
  validate: (v: unknown) => T; // throws on invalid
  maxTokens?: number;
  attempts?: number;
}): Promise<T> {
  const zai0 = await getZai(); // fail fast if config is missing entirely
  void zai0;
  const attempts = opts.attempts ?? 3;
  const errors: string[] = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const zai = await getZai();
      const res = await zai.chat.completions.create({
        messages: [
          ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
          { role: "user" as const, content: i === 0 ? opts.prompt : `${opts.prompt}\n\nIMPORTANT: Your previous reply could not be used (${errors[errors.length - 1]}). Reply again with ONLY the raw JSON, no commentary, no markdown fences.` },
        ],
        thinking: { type: "disabled" },
      });
      const text = res.choices?.[0]?.message?.content ?? "";
      const parsed = parseJsonFromText(text);
      return opts.validate(parsed);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 160));
      if (isAuthError(msg)) {
        resetZai(); // token likely rotated — pick up the fresh config
        await sleep(800 * (i + 1));
      }
    }
  }
  throw new Error(`LLM JSON generation failed after ${attempts} attempts: ${errors.join(" | ")}`);
}

/** TTS: returns WAV buffer (24kHz). z-ai voices are limited; voice names map to speed/pitch feel.
 * Retries on 429 rate limits with exponential backoff. */
export async function synthesizeSpeech(text: string, voice = "tongtong", speed = 1.0): Promise<Buffer> {
  await getZai(); // fail fast if config is missing entirely
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const zai = await getZai();
      const res = await zai.audio.tts.create({
        input: text.slice(0, 1000),
        voice,
        speed,
        response_format: "wav",
        stream: false,
      });
      return Buffer.from(new Uint8Array(await res.arrayBuffer()));
    } catch (e: unknown) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isAuthError(msg)) {
        resetZai(); // token likely rotated — pick up the fresh config
        await sleep(1500 * (attempt + 1));
        continue;
      }
      if (msg.includes("429") || msg.toLowerCase().includes("too many requests")) {
        await sleep(3000 * (attempt + 1) * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
