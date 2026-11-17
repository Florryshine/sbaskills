// src/imagery/source.ts — resolve an `image:` reference to image bytes.
//
// A reference can be:
//   • an http(s) URL
//   • a local file (looked up in whiteboard-engine/assets/images/, then as given)
//   • search keywords → free sources only, no paid image-gen:
//       intent "diagram": Pixabay illustrations (if key) → Wikimedia Commons
//       intent "photo":   Pexels photos (if key) → Wikimedia Commons
//       Wikimedia is the always-available keyless fallback; missing keys are
//       reported as notes instead of failing silently.
//
// Candidates are SCORED (keyword overlap in title, sane dimensions) before the
// first download is attempted, downloads are time/size-capped, and every image
// already used in the job can be excluded (no repeated stock photos).
//
// Results are cached on disk by reference so re-renders are deterministic and
// do not re-hit the network.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UA = 'ShineyBrainAcademy/2.0 (whiteboard-engine; contact: sba.support@shineybrainacademy.com)';

export interface LoadedImage {
  buffer: Buffer;
  /** Attribution / licence note when known (surface it in the video description). */
  credit?: string;
}

const CACHE_DIR = path.join(os.tmpdir(), 'sba-wb-images');

export type ImageIntent = 'diagram' | 'photo' | 'any';

export interface LoadOptions {
  /** What kind of visual the planner wanted. Default: diagram (traces best). */
  intent?: ImageIntent;
  /** Content hashes already used by this job — skipped to avoid repeats. */
  avoid?: Set<string>;
  /** Collector for key-status / provider diagnostics shown in the admin UI. */
  notes?: string[];
}

export function looksLikeDirectRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref) || /[\\/]/.test(ref) || /\.(png|jpe?g|webp|gif|svg)$/i.test(ref);
}

export function imageId(ref: string): string {
  return 'img.' + createHash('sha1').update(ref.trim().toLowerCase()).digest('hex').slice(0, 10);
}

async function download(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const type = res.headers.get('content-type') ?? '';
    if (type && !type.startsWith('image/')) throw new Error(`not an image (${type})`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_200) throw new Error('suspiciously small file');
    if (buf.length > 9_000_000) throw new Error('image too large (>9 MB)');
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

interface Candidate {
  url: string;
  credit: string;
  /** Search-result title / alt text used for relevance scoring. */
  title?: string;
  width?: number;
  height?: number;
  /** Wikimedia licence short name — non-free licences are rejected. */
  license?: string;
}

const NON_FREE = /(non-free|fair use|fairuse)/i;

/** Rank candidates: title keyword overlap first, then sane dimensions. */
function rank<T extends Candidate>(candidates: T[], query: string): T[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  return [...candidates]
    .sort((a, b) => score(b) - score(a))
    .filter((c) => !c.license || !NON_FREE.test(c.license));

  function score(c: Candidate): number {
    const t = (c.title ?? '').toLowerCase();
    let s = 0;
    for (const term of terms) if (t.includes(term)) s += 2;
    const w = c.width ?? 0;
    const h = c.height ?? 0;
    if (w && h) {
      if (w < 420 || h < 280) s -= 3; // too small to trace well
      const aspect = w / h;
      if (aspect < 0.3 || aspect > 3.6) s -= 2; // banners/icons trace badly
    }
    return s;
  }
}

/** Build a few high-quality query variants for the intent. */
function queryVariants(query: string, intent: ImageIntent): string[] {
  const q = query.trim();
  if (intent === 'photo') return [q, `${q} photo`];
  if (intent === 'diagram') return [`${q} diagram`, `${q} labeled illustration`, q];
  return [q, `${q} diagram`, `${q} illustration`];
}

async function pixabay(query: string, intent: ImageIntent): Promise<Candidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const out: Candidate[] = [];
  // illustrations / vectors trace far better than photos for diagram intent
  const types = intent === 'photo' ? ['photo'] : ['illustration', 'vector'];
  for (const type of types) {
    try {
      const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=${type}&safesearch=true&per_page=8`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        hits?: Array<{ largeImageURL?: string; webformatURL?: string; user?: string; tags?: string; imageWidth?: number; imageHeight?: number }>;
      };
      for (const hit of data.hits ?? []) {
        const u = hit.largeImageURL || hit.webformatURL;
        if (u)
          out.push({
            url: u,
            credit: `Pixabay / ${hit.user ?? 'unknown'} (Pixabay License)`,
            title: hit.tags ?? '',
            width: hit.imageWidth,
            height: hit.imageHeight,
          });
      }
    } catch {
      /* try next source */
    }
  }
  return out;
}

async function wikimedia(query: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const search of [query, `${query} diagram`].slice(0, 2)) {
    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6',
        gsrsearch: search,
        gsrlimit: '12',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|user|size',
        iiurlwidth: '1000',
        origin: '*',
      });
      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              imageinfo?: Array<{
                thumburl?: string;
                url?: string;
                user?: string;
                width?: number;
                height?: number;
                extmetadata?: { LicenseShortName?: { value?: string }; ObjectName?: { value?: string } };
              }>;
            }
          >;
        };
      };
      for (const page of Object.values(data.query?.pages ?? {})) {
        const info = page.imageinfo?.[0];
        const u = info?.thumburl || info?.url;
        if (!u || !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(u)) continue;
        out.push({
          url: u,
          credit: `Wikimedia Commons / ${info?.user ?? 'unknown'} (${info?.extmetadata?.LicenseShortName?.value ?? 'see source'})`,
          title: info?.extmetadata?.ObjectName?.value ?? page.title ?? '',
          width: info?.width,
          height: info?.height,
          license: info?.extmetadata?.LicenseShortName?.value ?? '',
        });
      }
      if (out.length) break; // first search variant that yields candidates wins
    } catch {
      /* try next variant */
    }
  }
  return out;
}

async function pexels(query: string): Promise<Candidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8`, {
      headers: { Authorization: key, 'User-Agent': UA },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      photos?: Array<{ src?: { large?: string }; photographer?: string; alt?: string; width?: number; height?: number }>;
    };
    return (data.photos ?? [])
      .filter((p) => p.src?.large)
      .map((p) => ({
        url: p.src!.large!,
        credit: `Pexels / ${p.photographer ?? 'unknown'} (Pexels License)`,
        title: p.alt ?? '',
        width: p.width,
        height: p.height,
      }));
  } catch {
    return [];
  }
}

export async function loadImage(ref: string, opts: LoadOptions = {}): Promise<LoadedImage> {
  const r = ref.trim();
  const notes = opts.notes;
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cacheKey = path.join(CACHE_DIR, createHash('sha1').update(r).digest('hex'));

  try {
    const cached = await fs.readFile(cacheKey);
    let credit: string | undefined;
    try {
      credit = await fs.readFile(cacheKey + '.credit', 'utf8');
    } catch {
      /* no credit file */
    }
    const hash = createHash('sha1').update(cached).digest('hex').slice(0, 12);
    if (opts.avoid?.has(hash)) {
      // cached image already used elsewhere in this job — fall through to search
    } else {
      return { buffer: cached, credit };
    }
  } catch {
    /* cache miss */
  }

  // 1. direct URL
  if (/^https?:\/\//i.test(r)) {
    const buffer = await download(r);
    await fs.writeFile(cacheKey, buffer);
    return { buffer };
  }

  // 2. local file
  if (looksLikeDirectRef(r)) {
    const candidates = [path.resolve('assets/images', r), path.resolve('whiteboard-engine/assets/images', r), path.resolve(r)];
    for (const c of candidates) {
      try {
        return { buffer: await fs.readFile(c) };
      } catch {
        /* next */
      }
    }
    throw new Error(`image file not found: ${r} (looked in assets/images/ and as given)`);
  }

  // 3. keyword search across free sources, ordered by intent
  const intent = opts.intent ?? 'diagram';
  const providers =
    intent === 'photo'
      ? [pexels, wikimedia, pixabay]
      : [pixabay, wikimedia, pexels];
  const used = new Set<string>();
  for (const src of providers) {
    let foundAny = false;
    for (const variant of queryVariants(r, intent)) {
      const cands = rank(await src(variant, intent), variant);
      if (cands.length) foundAny = true;
      for (const c of cands.slice(0, 5)) {
        if (used.has(c.url)) continue;
        try {
          const buffer = await download(c.url);
          const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
          if (opts.avoid?.has(hash)) continue; // already used in this job
          opts.avoid?.add(hash);
          used.add(c.url);
          await fs.writeFile(cacheKey, buffer);
          await fs.writeFile(cacheKey + '.credit', c.credit);
          return { buffer, credit: c.credit };
        } catch {
          /* next candidate */
        }
      }
      if (foundAny) break; // first variant with candidates wins for this provider
    }
  }

  // 4. diagnostics so missing keys are visible instead of silent
  if (notes) {
    if (!process.env.PIXABAY_API_KEY) notes.push(`Pixabay unavailable for "${r}": PIXABAY_API_KEY not set`);
    if (!process.env.PEXELS_API_KEY) notes.push(`Pexels unavailable for "${r}": PEXELS_API_KEY not set`);
  }
  throw new Error(
    `no free image found for "${r}" (set PIXABAY_API_KEY / PEXELS_API_KEY, or give a URL / local file)`,
  );
}
