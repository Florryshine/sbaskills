// src/imagery/source.ts — resolve an `image:` reference to image bytes.
//
// A reference can be:
//   • an http(s) URL
//   • a local file (looked up in whiteboard-engine/assets/images/, then as given)
//   • search keywords → free sources only, no paid image-gen:
//       Pixabay (illustrations first, needs PIXABAY_API_KEY, already used by SBA)
//       → Wikimedia Commons (no key) → Pexels (needs PEXELS_API_KEY)
//
// Results are cached on disk by reference so re-renders are deterministic and
// do not re-hit the network.

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const UA = 'ShineyBrainAcademy/1.0 (whiteboard-engine; contact: sba.support@shineybrainacademy.com)';

export interface LoadedImage {
  buffer: Buffer;
  /** Attribution / licence note when known (surface it in the video description). */
  credit?: string;
}

const CACHE_DIR = path.join(os.tmpdir(), 'sba-wb-images');

export function looksLikeDirectRef(ref: string): boolean {
  return /^https?:\/\//i.test(ref) || /[\\/]/.test(ref) || /\.(png|jpe?g|webp|gif|svg)$/i.test(ref);
}

export function imageId(ref: string): string {
  return 'img.' + createHash('sha1').update(ref.trim().toLowerCase()).digest('hex').slice(0, 10);
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

interface Candidate {
  url: string;
  credit: string;
}

async function pixabay(query: string): Promise<Candidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const out: Candidate[] = [];
  // illustrations / vectors trace far better than photos
  for (const type of ['illustration', 'vector']) {
    try {
      const url = `https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&image_type=${type}&safesearch=true&per_page=6`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const data = (await res.json()) as { hits?: Array<{ largeImageURL?: string; webformatURL?: string; user?: string }> };
      for (const hit of data.hits ?? []) {
        const u = hit.largeImageURL || hit.webformatURL;
        if (u) out.push({ url: u, credit: `Pixabay / ${hit.user ?? 'unknown'} (Pixabay License)` });
      }
    } catch {
      /* try next source */
    }
  }
  return out;
}

async function wikimedia(query: string): Promise<Candidate[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrsearch: `${query} diagram`,
      gsrlimit: '10',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|user',
      iiurlwidth: '900',
      origin: '*',
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as { query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string; user?: string; extmetadata?: { LicenseShortName?: { value?: string } } }> }> } };
    const out: Candidate[] = [];
    for (const page of Object.values(data.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const u = info?.thumburl || info?.url;
      if (!u || !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(u)) continue;
      out.push({ url: u, credit: `Wikimedia Commons / ${info?.user ?? 'unknown'} (${info?.extmetadata?.LicenseShortName?.value ?? 'see source'})` });
    }
    return out;
  } catch {
    return [];
  }
}

async function pexels(query: string): Promise<Candidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5`, { headers: { Authorization: key, 'User-Agent': UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as { photos?: Array<{ src?: { large?: string }; photographer?: string }> };
    return (data.photos ?? []).filter((p) => p.src?.large).map((p) => ({ url: p.src!.large!, credit: `Pexels / ${p.photographer ?? 'unknown'} (Pexels License)` }));
  } catch {
    return [];
  }
}

export async function loadImage(ref: string): Promise<LoadedImage> {
  const r = ref.trim();
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
    return { buffer: cached, credit };
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

  // 3. keyword search across free sources
  const sources = [pixabay, wikimedia, pexels];
  for (const src of sources) {
    const cands = await src(r);
    for (const c of cands.slice(0, 4)) {
      try {
        const buffer = await download(c.url);
        await fs.writeFile(cacheKey, buffer);
        await fs.writeFile(cacheKey + '.credit', c.credit);
        return { buffer, credit: c.credit };
      } catch {
        /* next candidate */
      }
    }
  }
  throw new Error(`no free image found for "${r}" (set PIXABAY_API_KEY / PEXELS_API_KEY, or give a URL / local file)`);
}
