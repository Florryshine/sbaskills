// src/imagery/providers.ts — free illustration chain with provenance.
//
// Scenes are filmed in SHOTS: one image never stays on screen longer than
// maxShotSeconds (default 3s), so each scene resolves N images. For every
// shot the chain tries providers in a style-aware rotation:
//
//   cartoon/sketch → pollinations (AI, style-locked) → pollinations (varied
//                    seed) → pixabay illustration-type → pexels → wikimedia
//                    → openverse → engine-drawn SVG scene card
//   photo          → pexels → pixabay → wikimedia → openverse → pollinations
//                    → placeholder
//
// Pexels/Pixabay use the platform's existing free keys (PEXELS_API_KEY /
// PIXABAY_API_KEY, already wired to GitHub). Wikimedia and Openverse need no
// key at all. Every asset records provider, prompt, seed and dimensions in
// the manifest so episodes can be re-rendered identically and audited.

import type { ImageAsset, ImageProviderName, StylePreset } from '../types';
import { SHOT_VARIATIONS, buildImagePrompt, stockQueryFrom } from './style';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const IMAGE_TIMEOUT_MS = 150000;
const STOCK_TIMEOUT_MS = 30000;

export interface ImageRequest {
  sceneIndex: number;
  subject: string;
  style: StylePreset;
  aspect: '16:9' | '9:16' | '1:1';
  seed: number;
  publicDir: string;
  preferred?: ImageProviderName;
  /** how many shots this scene needs (1..8) */
  count?: number;
  /** 'a' | 'b' for the two compare sides (single shot each, no carousel) */
  slot?: 'a' | 'b';
}

function targetSize(aspect: '16:9' | '9:16' | '1:1'): { width: number; height: number; aspectHint: 'wide' | 'square' | 'tall' } {
  if (aspect === '9:16') return { width: 1024, height: 1536, aspectHint: 'tall' };
  if (aspect === '1:1') return { width: 1200, height: 1200, aspectHint: 'square' };
  return { width: 1536, height: 1024, aspectHint: 'wide' };
}

function shotFile(publicDir: string, sceneIndex: number, shot: number, slot?: 'a' | 'b'): { abs: string; rel: string } {
  const base = `scene-${String(sceneIndex).padStart(3, '0')}`;
  const name = slot ? `${base}-${slot}.jpg` : `${base}-s${shot}.jpg`;
  return { abs: join(publicDir, 'images', name), rel: join('images', name) };
}

/** Normalize any image into exact RGB pixels; crops the pollinations strip. */
async function normalizeImage(input: Buffer, width: number, height: number, opts: { cropBottom?: boolean; cropRight?: boolean }): Promise<Buffer | null> {
  try {
    const sharp = (await import('sharp')).default;
    let img = sharp(input, { failOn: 'none' }).rotate(); // respect EXIF
    const meta = await img.metadata();
    const srcW = meta.width || width;
    const srcH = meta.height || height;
    let extractW = srcW;
    let extractH = srcH;
    if (opts.cropBottom) extractH = Math.round(srcH * 0.93);
    if (opts.cropRight) extractW = Math.round(srcW * 0.93);
    if (extractW !== srcW || extractH !== srcH) {
      img = img.extract({ left: 0, top: 0, width: extractW, height: extractH });
    }
    return await img
      .resize(width, height, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#FDFBF7' })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    return null;
  }
}

// Wikimedia (and some CC hosts) 403 generic/browser user agents on media
// requests — a descriptive app UA with contact info is required, same as
// lib/image-search.js.
const STOCK_UA =
  'ShineyBrainAcademy/1.0 (https://shineybrainacademy.vercel.app; contact: sba.support@shineybrainacademy.com)';

function fetchWithTimeout(url: string, ms: number, headers: Record<string, string> = {}): Promise<Response | null> {
  return Promise.race([
    fetch(url, { headers }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]).catch(() => null);
}

// ---------------------------------------------------------------------------
// AI generation (free, no key)
// ---------------------------------------------------------------------------

async function fetchPollinations(prompt: string, width: number, height: number, seed: number): Promise<Buffer | null> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1800))}?width=${width}&height=${height}&nologo=true&model=flux&seed=${seed}`;
  const r = await fetchWithTimeout(url, IMAGE_TIMEOUT_MS, { 'User-Agent': STOCK_UA });
  if (!r || !r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length >= 8000 ? buf : null;
}

async function generateZai(prompt: string, outPath: string, width: number, height: number): Promise<Buffer | null> {
  const { spawnSync } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  // The z-ai CLI only accepts fixed size presets — pick the nearest supported
  // one and let the sharp cover-crop normalize to the exact target afterwards.
  const presets: [number, number][] = [
    [1440, 720], [1152, 864], [1344, 768], [1024, 1024], [864, 1152], [768, 1344], [720, 1440],
  ];
  const target = width / height;
  const best = presets.reduce((a, b) => (Math.abs(b[0] / b[1] - target) < Math.abs(a[0] / a[1] - target) ? b : a));
  const res = spawnSync('z-ai', ['image', '-p', prompt.slice(0, 1600), '-o', outPath, '--size', `${best[0]}x${best[1]}`], {
    encoding: 'utf8',
    timeout: 240000,
  });
  if (res.status !== 0 || !existsSync(outPath)) return null;
  const { readFile } = await import('node:fs/promises');
  return readFile(outPath);
}

// ---------------------------------------------------------------------------
// Stock providers (free keys the platform already has + key-less sources)
// ---------------------------------------------------------------------------

interface StockHit {
  url: string;
  source: ImageProviderName;
}

export async function searchPexels(query: string, count: number, orientation: 'landscape' | 'portrait' | 'square'): Promise<StockHit[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({ query, per_page: String(Math.max(count, 4)) });
  if (orientation !== 'square') params.set('orientation', orientation);
  const r = await fetchWithTimeout(`https://api.pexels.com/v1/search?${params}`, STOCK_TIMEOUT_MS, { Authorization: key });
  if (!r || !r.ok) return [];
  const data = (await r.json().catch(() => null)) as { photos?: { src?: Record<string, string> }[] } | null;
  return (data?.photos || []).slice(0, count).map((p): StockHit => ({ url: p.src?.large2x || p.src?.large || p.src?.original || '', source: 'pexels' })).filter((h) => Boolean(h.url));
}

export async function searchPixabay(query: string, count: number, orientation: 'landscape' | 'portrait' | 'square', illustration: boolean): Promise<StockHit[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const params = new URLSearchParams({
    key,
    q: query,
    safesearch: 'true',
    per_page: String(Math.max(count, 4)),
    image_type: illustration ? 'illustration' : 'photo',
  });
  if (orientation === 'landscape') params.set('orientation', 'horizontal');
  if (orientation === 'portrait') params.set('orientation', 'vertical');
  const r = await fetchWithTimeout(`https://pixabay.com/api/?${params}`, STOCK_TIMEOUT_MS);
  if (!r || !r.ok) return [];
  const data = (await r.json().catch(() => null)) as { hits?: { largeImageURL?: string; webformatURL?: string }[] } | null;
  return (data?.hits || []).slice(0, count).map((h): StockHit => ({ url: h.largeImageURL || h.webformatURL || '', source: 'pixabay' })).filter((h) => Boolean(h.url));
}

export async function searchWikimedia(query: string, count: number): Promise<StockHit[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrnamespace: '6',
    gsrsearch: query,
    gsrlimit: String(Math.max(count * 2, 8)),
    prop: 'imageinfo',
    iiprop: 'url|mime|size',
    iiurlwidth: '1400',
  });
  const r = await fetchWithTimeout(`https://commons.wikimedia.org/w/api.php?${params}`, STOCK_TIMEOUT_MS, {
    'User-Agent': STOCK_UA,
  });
  if (!r || !r.ok) return [];
  const data = (await r.json().catch(() => null)) as { query?: { pages?: Record<string, { imageinfo?: { url: string; thumburl?: string; mime?: string; width?: number; height?: number }[] }> } } | null;
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((p) => p.imageinfo?.[0])
    .filter((info): info is NonNullable<typeof info> => Boolean(info))
    .filter((info) => /jpeg|png|webp|svg/i.test(info.mime || ''))
    .filter((info) => (info.width || 0) >= 500 && (info.height || 0) >= 400)
    .slice(0, count)
    .map((info) => ({ url: info.thumburl || info.url, source: 'wikimedia' as const }));
}

/** Openverse — key-less CC search (best-effort; anonymous rate limits apply). */
export async function searchOpenverse(query: string, count: number): Promise<StockHit[]> {
  const params = new URLSearchParams({ q: query, page_size: String(Math.max(count, 4)), license_type: 'all-cc' });
  const r = await fetchWithTimeout(`https://api.openverse.org/v1/images/?${params}`, STOCK_TIMEOUT_MS, {
    'User-Agent': STOCK_UA,
  });
  if (!r || !r.ok) return [];
  const data = (await r.json().catch(() => null)) as { results?: { url?: string; thumbnail?: string }[] } | null;
  return (data?.results || [])
    .slice(0, count)
    .map((h): StockHit => ({ url: h.url || h.thumbnail || '', source: 'openverse' }))
    .filter((h) => Boolean(h.url));
}

async function downloadStock(hit: StockHit, width: number, height: number): Promise<Buffer | null> {
  const r = await fetchWithTimeout(hit.url, STOCK_TIMEOUT_MS, { 'User-Agent': STOCK_UA, Accept: 'image/*' });
  if (!r || !r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length > 12000 ? buf : null;
}

// ---------------------------------------------------------------------------
// Engine-drawn SVG scene card — deterministic, offline, always succeeds.
// ---------------------------------------------------------------------------

async function generatePlaceholder(width: number, height: number, sceneIndex: number, shotIndex: number, subject: string): Promise<Buffer> {
  // Fallback card DERIVED FROM THE SCENE, not one repeated face: a hash of
  // scene/subject picks one of 6 distinct compositions × 6 palettes (36
  // variants), so consecutive scenes never show the same card even when every
  // provider fails.
  let hash = 2166136261;
  const key = `${sceneIndex}:${subject}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const palette = ['#E63946', '#3A86FF', '#2A9D8F', '#E76F51', '#8338EC', '#2B2D42'];
  const tints = ['#FDFBF7', '#F7F1E6', '#FDF6EC', '#F3F8F4', '#F5F0FA', '#FAF3E0'];
  const accent = palette[hash % palette.length];
  const bg = tints[(hash >> 3) % tints.length];
  const ink = '#16161A';
  const cx = width / 2;
  const cy = height / 2;
  const u = Math.min(width, height);
  const kind = (hash >> 6) % 6;
  const glyph = (() => {
    switch (kind) {
      case 0: // lightbulb
        return `<circle cx="${cx}" cy="${cy - u * 0.06}" r="${u * 0.16}" fill="none" stroke="${accent}" stroke-width="${u * 0.012}"/>
  <path d="M ${cx - u * 0.07} ${cy + u * 0.1} L ${cx + u * 0.07} ${cy + u * 0.1} M ${cx - u * 0.05} ${cy + u * 0.15} L ${cx + u * 0.05} ${cy + u * 0.15}" stroke="${ink}" stroke-width="${u * 0.01}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy - u * 0.3}" y2="${cy - u * 0.22}" stroke="${accent}" stroke-width="${u * 0.008}"/>
  <line x1="${cx - u * 0.24}" y1="${cy - u * 0.18}" x2="${cx - u * 0.18}" y2="${cy - u * 0.13}" stroke="${accent}" stroke-width="${u * 0.008}"/>
  <line x1="${cx + u * 0.24}" y1="${cy - u * 0.18}" x2="${cx + u * 0.18}" y2="${cy - u * 0.13}" stroke="${accent}" stroke-width="${u * 0.008}"/>`;
      case 1: // open book
        return `<path d="M ${cx - u * 0.22} ${cy - u * 0.12} Q ${cx} ${cy - u * 0.2} ${cx + u * 0.22} ${cy - u * 0.12} L ${cx + u * 0.22} ${cy + u * 0.12} Q ${cx} ${cy + u * 0.05} ${cx - u * 0.22} ${cy + u * 0.12} Z" fill="none" stroke="${accent}" stroke-width="${u * 0.012}"/>
  <line x1="${cx}" y1="${cy - u * 0.2}" x2="${cx}" y2="${cy + u * 0.05}" stroke="${ink}" stroke-width="${u * 0.008}"/>
  <line x1="${cx - u * 0.15}" y1="${cy - u * 0.04}" x2="${cx - u * 0.05}" y2="${cy - u * 0.07}" stroke="${ink}" stroke-width="${u * 0.006}" opacity="0.7"/>
  <line x1="${cx + u * 0.05}" y1="${cy - u * 0.07}" x2="${cx + u * 0.15}" y2="${cy - u * 0.04}" stroke="${ink}" stroke-width="${u * 0.006}" opacity="0.7"/>`;
      case 2: // rising chart
        return `<line x1="${cx - u * 0.2}" y1="${cy + u * 0.16}" x2="${cx + u * 0.2}" y2="${cy + u * 0.16}" stroke="${ink}" stroke-width="${u * 0.01}" stroke-linecap="round"/>
  <rect x="${cx - u * 0.14}" y="${cy + u * 0.02}" width="${u * 0.08}" height="${u * 0.13}" fill="${accent}" opacity="0.85"/>
  <rect x="${cx - u * 0.02}" y="${cy - u * 0.06}" width="${u * 0.08}" height="${u * 0.21}" fill="${accent}" opacity="0.6"/>
  <rect x="${cx + u * 0.1}" y="${cy - u * 0.16}" width="${u * 0.08}" height="${u * 0.31}" fill="${accent}"/>
  <circle cx="${cx + u * 0.14}" cy="${cy - u * 0.22}" r="${u * 0.025}" fill="${ink}"/>`;
      case 3: // clock / time
        return `<circle cx="${cx}" cy="${cy}" r="${u * 0.16}" fill="none" stroke="${accent}" stroke-width="${u * 0.012}"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - u * 0.1}" stroke="${ink}" stroke-width="${u * 0.01}" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${cx + u * 0.08}" y2="${cy + u * 0.04}" stroke="${accent}" stroke-width="${u * 0.01}" stroke-linecap="round"/>`;
      case 4: // target / focus
        return `<circle cx="${cx}" cy="${cy}" r="${u * 0.17}" fill="none" stroke="${accent}" stroke-width="${u * 0.01}"/>
  <circle cx="${cx}" cy="${cy}" r="${u * 0.1}" fill="none" stroke="${accent}" stroke-width="${u * 0.01}" opacity="0.6"/>
  <circle cx="${cx}" cy="${cy}" r="${u * 0.035}" fill="${accent}"/>`;
      default: // friendly face
        return `<circle cx="${cx}" cy="${cy}" r="${u * 0.16}" fill="none" stroke="${accent}" stroke-width="${u * 0.012}"/>
  <circle cx="${cx - u * 0.055}" cy="${cy - u * 0.03}" r="${u * 0.012}" fill="${ink}"/>
  <circle cx="${cx + u * 0.055}" cy="${cy - u * 0.03}" r="${u * 0.012}" fill="${ink}"/>
  <path d="M ${cx - u * 0.07} ${cy + u * 0.05} Q ${cx} ${cy + u * 0.11} ${cx + u * 0.07} ${cy + u * 0.05}" fill="none" stroke="${ink}" stroke-width="${u * 0.01}" stroke-linecap="round"/>`;
    }
  })();
  const rot = ((hash >> 9) % 24) - 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <circle cx="${cx}" cy="${cy}" r="${u * 0.3}" fill="${accent}" opacity="0.08"/>
  <g transform="rotate(${rot} ${cx} ${cy})">
  ${glyph}
  </g>
</svg>`;
  const sharp = (await import('sharp')).default;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Shot resolution
// ---------------------------------------------------------------------------

function providerChain(style: StylePreset, preferred?: ImageProviderName): ImageProviderName[] {
  const chain: ImageProviderName[] = [];
  if (preferred === 'placeholder') return ['placeholder']; // offline mode (selftest)
  if (preferred) chain.push(preferred);
  if (style === 'photo') {
    // Photo style: real stock first (Pexels/Pixabay/Wikimedia/Openverse are
    // all free), AI generation only fills gaps.
    chain.push('pexels', 'pixabay', 'wikimedia', 'openverse', 'pollinations', 'zai');
  } else {
    // Cartoon/sketch: alternate AI and stock per shot. AI anchors the style on
    // shots 0/2, stock sources (pixabay illustration graphics, wikimedia,
    // openverse) genuinely diversify the carousel AND keep episodes rendering
    // when pollinations rate-limits — a throttled AI no longer collapses
    // every shot to the placeholder.
    chain.push('pollinations', 'pixabay', 'pollinations', 'wikimedia', 'openverse', 'zai', 'pollinations');
  }
  chain.push('placeholder');
  return chain;
}

/** Resolve N shots for one scene through the provider chain. */
export async function resolveSceneImages(req: ImageRequest): Promise<ImageAsset[]> {
  const { width, height, aspectHint } = targetSize(req.aspect);
  const slot = req.slot;
  const count = slot ? 1 : Math.max(1, Math.min(8, req.count ?? 1));
  await mkdir(join(req.publicDir, 'images'), { recursive: true });

  // Stock search per (provider, shot-query): SHORT keyword queries (long
  // natural-language sentences return zero results on stock APIs) with a
  // per-shot angle word, cached per query. Distinct queries per shot make the
  // carousel images genuinely different, not re-crops of one result set.
  const stockCache = new Map<string, StockHit[]>();
  const getStock = async (provider: ImageProviderName, shotIndex: number, orientation: 'landscape' | 'portrait' | 'square', illustration: boolean): Promise<StockHit | null> => {
    // Commons/Openverse AND every term — they only match on strict 2-word
    // queries, so they never receive the angle word (and retry 1 word on 0 hits).
    const strict = provider === 'wikimedia' || provider === 'openverse';
    const query = strict ? stockQueryFrom(req.subject, 0, 2, false) : stockQueryFrom(req.subject, shotIndex);
    const cacheKey = `${provider}:${query}:${orientation}`;
    let hits = stockCache.get(cacheKey);
    if (!hits) {
      hits =
        provider === 'pexels'
          ? await searchPexels(query, 8, orientation)
          : provider === 'pixabay'
            ? await searchPixabay(query, 8, orientation, illustration)
            : provider === 'wikimedia'
              ? await searchWikimedia(query, 8)
              : provider === 'openverse'
                ? await searchOpenverse(query, 8)
                : [];
      if (hits.length === 0 && strict && query.includes(' ')) {
        // Retry with just the first keyword before giving up.
        hits = await searchWikimedia(query.split(' ')[0], 8);
      }
      stockCache.set(cacheKey, hits);
    }
    return hits[Math.floor(Math.random() * Math.max(1, hits.length))] ?? null;
  };

  const assets: ImageAsset[] = [];
  for (let shot = 0; shot < count; shot++) {
    const { abs, rel } = shotFile(req.publicDir, req.sceneIndex, shot, slot);
    const variation = slot ? '' : SHOT_VARIATIONS[shot % SHOT_VARIATIONS.length];
    const prompt = buildImagePrompt(req.subject, req.style, aspectHint, variation);
    // Wide prime-number seed spread: consecutive shots/scenes produce very
    // different AI images instead of near-identical variations.
    const seed = req.seed + req.sceneIndex * 1009 + shot * 977 + (slot === 'b' ? 401 : 0);

    let provider: ImageProviderName = 'placeholder';
    let raw: Buffer | null = null;
    let pollinationsAttempts = 0;
    for (const p of providerChain(req.style, req.preferred)) {
      if (p === 'pollinations') {
        if (pollinationsAttempts > 0) await new Promise((r) => setTimeout(r, Math.min(8000, 1500 * pollinationsAttempts)));
        const pSeed = seed + pollinationsAttempts * 101;
        pollinationsAttempts += 1;
        raw = await fetchPollinations(prompt, width, height, pSeed);
        if (raw) {
          const normalized = await normalizeImage(raw, width, height, { cropBottom: true, cropRight: true });
          if (normalized) {
            raw = normalized;
            provider = p;
            break;
          }
          raw = null;
        }
      } else if (p === 'zai') {
        const rawPath = `${abs}.raw.png`;
        raw = await generateZai(prompt, rawPath, width, height);
        if (raw) {
          const normalized = await normalizeImage(raw, width, height, {});
          if (normalized) {
            raw = normalized;
            provider = p;
            break;
          }
          raw = null;
        }
      } else if (p === 'placeholder') {
        raw = await generatePlaceholder(width, height, req.sceneIndex, shot, req.subject);
        provider = p;
        break;
      } else if (p === 'pexels' || p === 'pixabay' || p === 'wikimedia' || p === 'openverse') {
        const illustration = p === 'pixabay' && req.style !== 'photo';
        const hit = await getStock(p, shot, aspectHint === 'tall' ? 'portrait' : aspectHint === 'square' ? 'square' : 'landscape', illustration);
        if (!hit) {
          console.warn(`[imagery] ${p}: no results for scene ${req.sceneIndex} shot ${shot}`);
          continue;
        }
        const buf = await downloadStock(hit, width, height);
        if (!buf) {
          console.warn(`[imagery] ${p}: download failed for scene ${req.sceneIndex} shot ${shot} (${hit.url.slice(0, 90)})`);
          continue;
        }
        const normalized = await normalizeImage(buf, width, height, {});
        if (normalized) {
          raw = normalized;
          provider = p;
          break;
        }
        console.warn(`[imagery] ${p}: normalize failed for scene ${req.sceneIndex} shot ${shot}`);
      }
    }
    if (!raw) {
      raw = await generatePlaceholder(width, height, req.sceneIndex, shot, req.subject);
      provider = 'placeholder';
    }
    await writeFile(abs, raw);
    assets.push({
      sceneIndex: req.sceneIndex,
      provider,
      file: rel,
      prompt,
      seed,
      width,
      height,
      shot,
    });
  }
  return assets;
}
