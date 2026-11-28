/**
 * Node-only acquisition adapter for Stickman 2 Image Presenter.
 * Uses traceable stock sources and existing platform credentials; no
 * unlicensed AI endpoints or generic placeholders are substituted.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ImagePresenterAcquisitionOptions, ImagePresenterAcquisitionResult, PresenterImageAsset } from './types';
import type { ImagePresenterScenePlan } from './planner';

type Provider = 'pexels' | 'pixabay' | 'wikimedia' | 'openverse';
interface Candidate {
  provider: Provider; mediaUrl: string; sourceUrl: string; title: string;
  attribution?: string; license?: string; attributionRequired?: boolean;
  licenseVerified: boolean; width?: number; height?: number;
}
interface CacheFile { version: 1; entries: Record<string, PresenterImageAsset & { localFile: string; contentHash: string }> }
const USER_AGENT = 'ShineyBrainAcademy/1.0 (https://shineybrainacademy.vercel.app)';
const DEFAULT_PROVIDERS: Provider[] = ['pexels', 'pixabay', 'wikimedia', 'openverse'];
function dimensions(aspect: string): { width: number; height: number } {
  if (aspect === '9:16') return { width: 900, height: 1600 };
  if (aspect === '1:1') return { width: 1200, height: 1200 };
  return { width: 1600, height: 900 };
}
function keyFor(query: string, aspect: string): string {
  return createHash('sha256').update(query.trim().toLowerCase() + '|' + aspect).digest('hex');
}
function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'image';
}
async function json(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(25000) });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}
function uniqueCandidates(items: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.mediaUrl.split('?')[0].replace(/\/$/, '');
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
async function searchProvider(provider: Provider, query: string, limit: number): Promise<Candidate[]> {
  if (provider === 'pexels') {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return [];
    const data = await json('https://api.pexels.com/v1/search?' + new URLSearchParams({ query, per_page: String(limit) }), { Authorization: apiKey });
    return (data?.photos ?? []).flatMap((p: any) => {
      const mediaUrl = p.src?.large2x || p.src?.large || p.src?.original;
      return mediaUrl ? [{ provider, mediaUrl, sourceUrl: p.url, title: p.alt || query, attribution: p.photographer, license: 'Pexels License', attributionRequired: false, licenseVerified: true, width: p.width, height: p.height }] : [];
    });
  }
  if (provider === 'pixabay') {
    const apiKey = process.env.PIXABAY_API_KEY;
    if (!apiKey) return [];
    const data = await json('https://pixabay.com/api/?' + new URLSearchParams({ key: apiKey, q: query, image_type: 'photo', safesearch: 'true', per_page: String(limit) }));
    return (data?.hits ?? []).flatMap((p: any) => p.largeImageURL ? [{
      provider, mediaUrl: p.largeImageURL, sourceUrl: p.pageURL, title: p.tags || query,
      attribution: p.user, license: 'Pixabay Content License', attributionRequired: false,
      licenseVerified: true, width: p.imageWidth, height: p.imageHeight,
    }] : []);
  }
  if (provider === 'wikimedia') {
    const params = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrsearch: query, gsrlimit: String(limit * 2), prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' });
    const data = await json('https://commons.wikimedia.org/w/api.php?' + params, { 'User-Agent': USER_AGENT });
    const pages = Object.values(data?.query?.pages ?? {}) as any[];
    return pages.flatMap(page => {
      const info = page.imageinfo?.[0], meta = info?.extmetadata ?? {};
      if (!info?.url || !/image\/(jpeg|png|webp)/i.test(info.mime || '') || (info.width ?? 0) < 500 || (info.height ?? 0) < 400) return [];
      const clean = (v: any) => typeof v?.value === 'string' ? v.value.replace(/<[^>]*>/g, '').trim() : undefined;
      return [{
        provider, mediaUrl: info.thumburl || info.url,
        sourceUrl: 'https://commons.wikimedia.org/wiki/' + encodeURIComponent(page.title || ''),
        title: page.title || query, attribution: clean(meta.Attribution) || clean(meta.Artist),
        license: clean(meta.LicenseShortName), attributionRequired: clean(meta.AttributionRequired) === 'true',
        licenseVerified: Boolean(clean(meta.LicenseShortName)), width: info.width, height: info.height,
      }];
    });
  }
  const data = await json('https://api.openverse.org/v1/images/?' + new URLSearchParams({ q: query, page_size: String(limit), license_type: 'all-cc' }), { 'User-Agent': USER_AGENT });
  return (data?.results ?? []).flatMap((p: any) => p.url ? [{
    provider, mediaUrl: p.url, sourceUrl: p.foreign_landing_url || p.detail_url || p.url,
    title: p.title || query, attribution: p.attribution || p.creator,
    license: [p.license, p.license_version].filter(Boolean).join(' ') || undefined,
    attributionRequired: Boolean(p.attribution_required), licenseVerified: Boolean(p.license),
    width: p.width, height: p.height,
  }] : []);
}
async function materialize(candidate: Candidate, needId: string, subject: string, publicDir: string, aspect: string): Promise<(PresenterImageAsset & { localFile: string; contentHash: string }) | null> {
  try {
    const response = await fetch(candidate.mediaUrl, { headers: { 'User-Agent': USER_AGENT, Accept: 'image/*' }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    if (input.length < 4000) return null;
    const sharp = (await import('sharp')).default, size = dimensions(aspect);
    const output = await sharp(input, { failOn: 'none' }).rotate().resize(size.width, size.height, { fit: 'contain', background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer();
    if (output.length < 4000) return null;
    const contentHash = createHash('sha256').update(output).digest('hex');
    const relative = join('images', 'presenter', safeName(needId) + '-' + contentHash.slice(0, 12) + '.jpg');
    const absolute = join(publicDir, relative);
    await mkdir(join(publicDir, 'images', 'presenter'), { recursive: true });
    if (!existsSync(absolute)) await writeFile(absolute, output);
    return {
      id: needId, subject, title: candidate.title, alt: subject, mediaUrl: candidate.mediaUrl,
      sourceUrl: candidate.sourceUrl, provider: candidate.provider, mimeType: 'image/jpeg',
      width: size.width, height: size.height, license: candidate.license, attribution: candidate.attribution,
      attributionRequired: candidate.attributionRequired, licenseVerified: candidate.licenseVerified,
      contentHash, localFile: relative,
    };
  } catch { return null; }
}
export async function acquireImagePresenterAssets(plan: ImagePresenterScenePlan, options: ImagePresenterAcquisitionOptions): Promise<ImagePresenterAcquisitionResult> {
  if (!options.publicDir) throw new Error('publicDir is required for image acquisition.');
  const aspect = options.aspectRatio ?? plan.aspectRatio;
  const providers = options.providers?.length ? options.providers : DEFAULT_PROVIDERS;
  const limit = Math.max(2, Math.min(20, Math.floor(options.candidatesPerNeed ?? 8)));
  const cachePath = join(options.publicDir, 'images', 'presenter-cache.json');
  await mkdir(join(options.publicDir, 'images'), { recursive: true });
  let cache: CacheFile = { version: 1, entries: {} };
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as CacheFile;
    if (parsed.version === 1 && parsed.entries) cache = parsed;
  } catch { /* no valid cache yet */ }
  const assets: ImagePresenterAcquisitionResult['assets'] = {}, warnings: string[] = [], occupied = new Set<string>();
  const needs = plan.scenes.flatMap(scene => scene.imageNeeds);
  const distinctNeedIds = new Set(needs.filter(need => need.distinctFrom || need.role === 'step').map(need => need.id));
  for (const need of needs) {
    const cacheKey = keyFor(need.searchQuery, aspect), cached = cache.entries[cacheKey];
    const avoidDuplicate = distinctNeedIds.has(need.id);
    if (cached && existsSync(join(options.publicDir, cached.localFile)) && (!avoidDuplicate || !occupied.has(cached.contentHash))) {
      assets[need.id] = { ...cached, id: need.id, subject: need.subject, alt: need.subject };
      if (avoidDuplicate) occupied.add(cached.contentHash);
      continue;
    }
    let acquired: ImagePresenterAcquisitionResult['assets'][string] | null = null;
    for (const provider of providers) {
      const candidates = uniqueCandidates(await searchProvider(provider, need.searchQuery, limit));
      for (const candidate of candidates) {
        if (!candidate.licenseVerified) continue;
        const asset = await materialize(candidate, need.id, need.subject, options.publicDir, aspect);
        if (!asset || (avoidDuplicate && occupied.has(asset.contentHash))) continue;
        acquired = asset; break;
      }
      if (acquired) break;
    }
    if (!acquired) {
      warnings.push('No distinct, downloadable, traceable image found for "' + need.subject + '". The need remains unresolved; no placeholder or duplicate was substituted.');
      continue;
    }
    assets[need.id] = acquired;
    if (avoidDuplicate) occupied.add(acquired.contentHash);
    cache.entries[cacheKey] = acquired;
  }
  for (const need of needs) {
    if (!need.distinctFrom) continue;
    const left = assets[need.id], right = assets[need.distinctFrom];
    if (left && right && left.contentHash === right.contentHash) {
      delete assets[need.distinctFrom];
      warnings.push('Comparison assets were byte-identical after normalization. The paired asset was withheld rather than reused.');
    }
  }
  await writeFile(cachePath, JSON.stringify(cache, null, 2));
  return { assets, warnings };
}
