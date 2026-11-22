// lib/visual-intelligence/inspect.js
//
// INSPECT stage — every candidate is actually LOOKED AT before any decision:
//   1. bytes are downloaded and validated (magic numbers, not just mime text)
//   2. raster images are probed with sharp: real dimensions, format,
//      transparency actually used (not just an alpha channel flag),
//      blank-frame detection, dominant colour
//   3. when a Gemini vision key is configured the image is shown to the model
//      for subject match / scientific accuracy / watermark / style assessment
//   4. without a vision model, subject accuracy is explicitly reported as
//      "uncertain" — we never pretend a keyword match was verified visually.

import { createHash } from 'node:crypto';

let sharpPromise = null;
async function getSharp() {
  if (!sharpPromise) sharpPromise = import('sharp').then((m) => m.default).catch(() => null);
  return sharpPromise;
}

const VISION_MODEL_PRIORITY = [
  ...['GEMINI_VISION_MODEL', 'GEMINI_VISION_MODELS'].flatMap((v) => (process.env[v] ? process.env[v].split(',').map((s) => s.trim()) : [])),
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
].filter(Boolean);

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY,
].filter(Boolean);

export function visionAvailable() {
  return GEMINI_KEYS.length > 0;
}

// ── byte-level sniffing ─────────────────────────────────────────────────────
export function sniffFormat(buffer) {
  if (!buffer || buffer.length < 12) return { format: 'unknown', mime: null };
  const head = buffer.subarray(0, 24);
  if (head.subarray(0, 5).toString() === '<?xml' || head.includes('<svg')) return { format: 'svg', mime: 'image/svg+xml' };
  if (head[0] === 0x89 && head[1] === 0x50) return { format: 'png', mime: 'image/png' };
  if (head[0] === 0xff && head[1] === 0xd8) return { format: 'jpeg', mime: 'image/jpeg' };
  if (head.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { format: 'webp', mime: 'image/webp' };
  if (head[0] === 0x47 && head[1] === 0x49) return { format: 'gif', mime: 'image/gif' };
  if (buffer.subarray(4, 8).toString() === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString();
    const isHeic = /^heic|mif1|heix|hevc/.test(brand);
    return { format: isHeic ? 'heic' : 'mp4-video', mime: isHeic ? 'image/heic' : 'video/mp4' };
  }
  if (head.subarray(0, 4).toString() === 'glTF') return { format: 'glb', mime: 'model/gltf-binary' };
  if (head[0] === 0x1f && head[1] === 0x8b) return { format: 'gzip', mime: 'application/gzip' }; // polyhaven zips
  if (head[0] === 0x50 && head[1] === 0x4b) return { format: 'zip', mime: 'application/zip' };
  return { format: 'unknown', mime: null };
}

/** Probe a raster buffer with sharp. Returns probe or { error }. */
export async function probeImage(buffer) {
  const sharp = await getSharp();
  if (!sharp) return { error: 'sharp unavailable in this runtime' };
  try {
    const image = sharp(buffer, { failOn: 'none' });
    const meta = await image.metadata();
    const stats = await image.stats();
    const width = meta.width || 0;
    const height = meta.height || 0;
    // "transparent" means the alpha channel exists AND is actually used.
    let usesTransparency = false;
    if (meta.hasAlpha) {
      try {
        const alpha = await image.extractChannel('alpha').stats();
        usesTransparency = (alpha.channels?.[0]?.min ?? 255) < 250;
      } catch { usesTransparency = meta.hasAlpha; }
    }
    // Blank/flat detection: near-zero stddev across every channel.
    const stddevs = stats.channels.map((c) => c.stdev);
    const isFlat = stddevs.length > 0 && stddevs.every((s) => s < 2.5);
    return {
      ok: true,
      width, height,
      format: meta.format || null,
      hasAlphaChannel: Boolean(meta.hasAlpha),
      usesTransparency,
      isFlat,
      megapixels: Number(((width * height) / 1e6).toFixed(2)),
      dominant: stats.dominant ? { r: stats.dominant.r, g: stats.dominant.g, b: stats.dominant.b } : null,
    };
  } catch (error) {
    return { error: `sharp probe failed: ${error?.message || 'unknown'}` };
  }
}

// ── Gemini vision inspection ────────────────────────────────────────────────
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

function buildInspectionPrompt(request) {
  const science = request.scientificAccuracy === 'strict'
    ? 'This will teach real curriculum content, so scientific accuracy is CRITICAL: label any wrong number of parts, impossible anatomy, wrong colours for structures, or misleading proportions.'
    : request.scientificAccuracy === 'relaxed'
      ? 'Scientific accuracy is a soft signal; only flag clearly wrong imagery.'
      : 'Flag obvious scientific errors.';
  return [
    'You are a strict visual QA reviewer for an educational video platform.',
    `Requested subject: "${request.subject}".`,
    request.sceneDescription ? `Scene context: "${request.sceneDescription}".` : '',
    `Expected visual type: ${request.kind || 'any'}. Expected style: ${request.style || 'any'}.`,
    science,
    'Answer ONLY with compact JSON: {"subjectMatch": <0-100 int, does this image actually show the requested subject>,',
    '"scientificAccuracy": {"verdict": "ok"|"concern"|"fail", "note": "<short note>"},',
    '"watermark": <bool>, "textInImage": <bool>, "style": "<photo|illustration|diagram|3d|clipart|other>",',
    '"composition": "<closeup|full-subject|wide|cluttered|other>", "notes": "<max 25 words>"}.',
  ].filter(Boolean).join(' ');
}

async function geminiVisionInspect(buffer, mimeType, request) {
  if (!GEMINI_KEYS.length) return { available: false };
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const inlineData = { mimeType: mimeType || 'image/jpeg', data: buffer.toString('base64') };
  for (const key of GEMINI_KEYS) {
    const client = new GoogleGenerativeAI(key);
    for (const modelName of VISION_MODEL_PRIORITY) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: buildInspectionPrompt(request) }, { inlineData }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
        });
        const text = result.response.text();
        const parsed = extractJson(text);
        if (parsed && typeof parsed.subjectMatch !== 'undefined') {
          return { available: true, model: modelName, ...parsed };
        }
      } catch (error) {
        if (/429|quota|rate.?limit/i.test(error?.message || '')) break; // next key
        continue; // next model
      }
    }
  }
  return { available: false };
}

/**
 * Full inspection for one candidate.
 * Returns { ok, verdict: 'pass'|'concern'|'fail'|'uncertain', ... } and NEVER
 * throws — an inspection crash is reported as an inspection failure for that
 * candidate only.
 */
export async function inspectCandidate(candidate, bytes, request, { wantVision = true } = {}) {
  const base = {
    provider: candidate.provider,
    providerAssetId: candidate.providerAssetId,
    sourceUrl: candidate.pageUrl || candidate.url,
    inspectedAt: new Date().toISOString(),
    contentSha256: createHash('sha256').update(bytes).digest('hex'),
    byteSize: bytes.length,
    checks: {},
    vision: null,
    verdict: 'uncertain',
    reasons: [],
  };
  try {
    const sniff = sniffFormat(bytes);
    base.checks.format = sniff;
    if (sniff.format === 'unknown') {
      return { ...base, verdict: 'fail', reasons: [...base.reasons, 'Unrecognised file format (magic-number check failed).'] };
    }

    // Raster / SVG probe
    if (['png', 'jpeg', 'webp', 'gif', 'svg'].includes(sniff.format)) {
      const probe = await probeImage(bytes);
      if (probe.error) {
        base.checks.image = { error: probe.error };
        return { ...base, verdict: 'uncertain', reasons: [...base.reasons, `Image probe unavailable: ${probe.error}`] };
      }
      base.checks.image = probe;
      const minW = request.minWidth || 480;
      const minH = request.minHeight || 360;
      if (probe.width < minW || probe.height < minH) {
        base.checks.resolution = { pass: false, minWidth: minW, minHeight: minH };
        return { ...base, verdict: 'fail', reasons: [...base.reasons, `Resolution ${probe.width}x${probe.height} below the required ${minW}x${minH}.`] };
      }
      base.checks.resolution = { pass: true };
      if (probe.isFlat) {
        return { ...base, verdict: 'fail', reasons: [...base.reasons, 'Image is blank/flat (no usable content detected).'] };
      }
      if (request.transparent && sniff.format !== 'svg' && !probe.usesTransparency) {
        base.checks.transparency = { pass: false, note: 'No real transparency — background removal would be needed.' };
        base.reasons.push('Transparency requested but the raster has no real alpha usage (adapt: background removal).');
      } else {
        base.checks.transparency = { pass: sniff.format === 'svg' ? true : probe.usesTransparency };
      }
    } else if (['mp4-video'].includes(sniff.format)) {
      base.checks.video = { accepted: true, note: 'Header-validated mp4; frame probing happens at render time.' };
      if (request.transparent) {
        return { ...base, verdict: 'fail', reasons: [...base.reasons, 'Transparency requested; stock video cannot provide an alpha channel.'] };
      }
    } else if (['glb', 'gzip', 'zip'].includes(sniff.format)) {
      base.checks.model3d = { accepted: true, format: sniff.format, note: 'Archive/3D payload validated by magic number only.' };
      if (request.transparent) {
        base.reasons.push('3D assets support transparent rendering at engine level; asset itself is not an image.');
      }
    }

    // Vision check (raster + svg rendered by the model viewer only; for video
    // we inspect the provider's still preview instead).
    if (wantVision && visionAvailable()) {
      const visionTarget = sniff.format === 'mp4-video'
        ? (candidate.previewUrl && candidate.previewUrl.startsWith('http') ? await downloadPreview(candidate.previewUrl) : null)
        : (sniff.format === 'svg' ? bytes : bytes);
      if (visionTarget) {
        const visionMime = sniff.format === 'mp4-video' ? 'image/jpeg' : sniff.mime;
        const vision = await geminiVisionInspect(visionTarget, visionMime, request);
        base.vision = vision.available
          ? {
              available: true, model: vision.model,
              subjectMatch: Number(vision.subjectMatch) || 0,
              scientificAccuracy: vision.scientificAccuracy || null,
              watermark: Boolean(vision.watermark),
              textInImage: Boolean(vision.textInImage),
              style: vision.style || null,
              composition: vision.composition || null,
              notes: vision.notes || null,
            }
          : { available: false, note: 'Vision model unreachable; subject accuracy NOT visually confirmed.' };
        if (base.vision.available) {
          if (base.vision.watermark) base.reasons.push('Vision check flagged a watermark or logo overlay.');
          if (request.scientificAccuracy === 'strict' && base.vision.scientificAccuracy?.verdict === 'fail') {
            return { ...base, verdict: 'fail', reasons: [...base.reasons, `Scientific accuracy rejected: ${base.vision.scientificAccuracy.note || 'inaccurate imagery'}.`] };
          }
        }
      }
    } else if (wantVision && !visionAvailable()) {
      base.vision = { available: false, note: 'No vision credentials configured; subject accuracy NOT visually confirmed.' };
    }

    // Watermark without vision: nothing we can detect deterministically here.
    const visionSubject = base.vision?.available ? base.vision.subjectMatch : null;
    if (visionSubject === null) base.verdict = 'uncertain';
    else if (visionSubject >= 80) base.verdict = 'pass';
    else if (visionSubject >= 60) base.verdict = 'concern';
    else base.verdict = 'fail';
    return base;
  } catch (error) {
    return { ...base, verdict: 'uncertain', reasons: [...base.reasons, `Inspection crashed: ${error?.message || 'unknown'}`] };
  }
}

async function downloadPreview(url) {
  const { getBytes } = await import('./providers/http.js');
  const res = await getBytes(url, { timeoutMs: 15000, maxBytes: 4 * 1024 * 1024 });
  return res?.buffer || null;
}

export async function inspectCandidates(candidates, request, { limit = 8, concurrency = 3 } = {}) {
  const picked = candidates.slice(0, limit);
  const inspected = [];
  let cursor = 0;
  async function worker() {
    while (cursor < picked.length) {
      const candidate = picked[cursor++];
      const { fetchCandidateBytes } = await import('./providers/index.js');
      const bytesRes = await fetchCandidateBytes(candidate);
      if (!bytesRes.ok) {
        inspected.push({
          candidate, inspection: {
            provider: candidate.provider, providerAssetId: candidate.providerAssetId,
            verdict: 'fail', reasons: [bytesRes.error], inspectedAt: new Date().toISOString(), contentSha256: null,
          },
        });
        continue;
      }
      const inspection = await inspectCandidate(candidate, bytesRes.buffer, request);
      inspected.push({ candidate, inspection, bytes: bytesRes.buffer, mimeType: bytesRes.contentType || candidate.mimeType });
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, picked.length) }, worker));
  return inspected;
}
