// lib/visual-intelligence/providers/photo-providers.js
//
// Photo / raster providers: Pexels, Pixabay, Wikimedia Commons, Openverse.
// Each module is self-contained: missing credentials disable only that
// provider (available() → false), never the whole chain. Search failures are
// returned as { ok:false, error } so the orchestrator can move on.

import { getJson } from './http.js';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// ── Pexels ──────────────────────────────────────────────────────────────────
// API key required (free tier, 200 req/hour). Pexels License: free for
// commercial use, no attribution required, modifications allowed.
export const pexels = {
  id: 'pexels',
  label: 'Pexels',
  kinds: ['photo', 'video'],
  mode: 'api',
  credentials: [{ env: 'PEXELS_API_KEY', required: true, signup: 'https://www.pexels.com/api/' }],
  licenseText: 'Pexels License (free for commercial use, no attribution required)',
  cacheTtlSeconds: 7 * 24 * 3600, // search metadata cache; files are re-hosted
  rateLimitNote: '200 requests/hour on the free key',
  available() { return Boolean(PEXELS_API_KEY); },
  async search(request) {
    if (!PEXELS_API_KEY) return { ok: false, error: 'PEXELS_API_KEY missing' };
    const perPage = Math.min(request.limit || 6, 30);
    const video = request.kind === 'video';
    const url = video
      ? `https://api.pexels.com/videos/search?query=${encodeURIComponent(request.query)}&per_page=${perPage}`
      : `https://api.pexels.com/v1/search?query=${encodeURIComponent(request.query)}&per_page=${perPage}`;
    const res = await getJson(url, { headers: { Authorization: PEXELS_API_KEY }, timeoutMs: 20000 });
    if (!res.ok) return res;
    const results = [];
    if (video) {
      for (const v of res.data.videos || []) {
        const files = v.video_files || [];
        const preferred = files.find((f) => (f.height || 0) <= 1080 && (f.height || 0) >= 480) ||
          files.sort((a, b) => (a.height || 9999) - (b.height || 9999))[0];
        if (!preferred?.link) continue;
        results.push({
          provider: 'pexels', providerAssetId: String(v.id), kind: 'video',
          url: preferred.link, previewUrl: v.image, pageUrl: v.url,
          title: `Pexels video ${v.id}`, creator: v.user?.name || null,
          license: this.licenseText, width: preferred.width, height: preferred.height,
          mimeType: preferred.file_type || 'video/mp4', meta: { durationSeconds: v.duration },
        });
      }
    } else {
      for (const p of res.data.photos || []) {
        results.push({
          provider: 'pexels', providerAssetId: String(p.id), kind: 'photo',
          url: p.src?.large2x || p.src?.large || p.src?.original, previewUrl: p.src?.medium,
          pageUrl: p.url, title: p.alt || `Pexels photo ${p.id}`, creator: p.photographer,
          license: this.licenseText, width: p.width, height: p.height,
          mimeType: 'image/jpeg', meta: { avgColor: p.avg_color },
        });
      }
    }
    return { ok: true, results };
  },
};

// ── Pixabay ─────────────────────────────────────────────────────────────────
// API key required. Pixabay Content License: free for commercial use, no
// attribution required. IMPORTANT platform rule honoured here: the Pixabay API
// terms allow caching API results for at most 24 hours and discourage
// hotlinking their CDN — so search cache TTL is capped at 24h and stored
// assets are always re-hosted in our own bucket, never deep-linked.
export const pixabay = {
  id: 'pixabay',
  label: 'Pixabay',
  kinds: ['photo', 'illustration', 'video'],
  mode: 'api',
  credentials: [{ env: 'PIXABAY_API_KEY', required: true, signup: 'https://pixabay.com/api/docs/' }],
  licenseText: 'Pixabay Content License (free for commercial use, no attribution required)',
  cacheTtlSeconds: 24 * 3600, // hard cap from Pixabay API terms
  rateLimitNote: 'Rate limited by key; keep request volume modest (default 100/60s)',
  available() { return Boolean(PIXABAY_API_KEY); },
  async search(request) {
    if (!PIXABAY_API_KEY) return { ok: false, error: 'PIXABAY_API_KEY missing' };
    const perPage = Math.min(request.limit || 6, 30);
    const video = request.kind === 'video';
    const imageType = request.kind === 'illustration' ? 'illustration' : 'photo';
    const url = video
      ? `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(request.query)}&safesearch=true&per_page=${perPage}`
      : `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(request.query)}&image_type=${imageType}&safesearch=true&per_page=${perPage}`;
    const res = await getJson(url, { timeoutMs: 20000 });
    if (!res.ok) return res;
    const results = [];
    if (video) {
      for (const hit of res.data.hits || []) {
        const rendition = hit.videos?.medium || hit.videos?.small || hit.videos?.large || hit.videos?.tiny;
        if (!rendition?.url) continue;
        results.push({
          provider: 'pixabay', providerAssetId: String(hit.id), kind: 'video',
          url: rendition.url, previewUrl: hit.userImageURL || null, pageUrl: hit.pageURL,
          title: `Pixabay video ${hit.id}`, creator: hit.user,
          license: this.licenseText, width: rendition.width, height: rendition.height,
          mimeType: 'video/mp4', meta: { durationSeconds: hit.duration },
        });
      }
    } else {
      for (const hit of res.data.hits || []) {
        results.push({
          provider: 'pixabay', providerAssetId: String(hit.id), kind: request.kind === 'illustration' ? 'illustration' : 'photo',
          url: hit.largeImageURL || hit.webformatURL, previewUrl: hit.webformatURL,
          pageUrl: hit.pageURL, title: (hit.tags || '').split(',').slice(0, 3).join(', ') || `Pixabay ${hit.id}`,
          creator: hit.user, license: this.licenseText, width: hit.imageWidth, height: hit.imageHeight,
          mimeType: hit.type === 'image/svg' ? 'image/svg+xml' : hit.largeImageURL?.endsWith('.png') ? 'image/png' : 'image/jpeg',
          meta: { pixabayTags: hit.tags, imageType: hit.type },
        });
      }
    }
    return { ok: true, results };
  },
};

// ── Wikimedia Commons ───────────────────────────────────────────────────────
// No key needed. Per-file licenses (mostly CC BY / CC BY-SA / CC0 / PD) are
// read from extmetadata and passed through the hard license gate downstream.
// Requires the descriptive User-Agent (Wikimedia UA policy).
export const wikimedia = {
  id: 'wikimedia',
  label: 'Wikimedia Commons',
  kinds: ['photo', 'illustration', 'svg', 'diagram'],
  mode: 'api',
  credentials: [],
  licenseText: 'Per-file license from Commons metadata (evaluated by policy)',
  cacheTtlSeconds: 24 * 3600,
  rateLimitNote: 'Polite use; descriptive User-Agent required by Wikimedia policy',
  available() { return true; },
  async search(request) {
    const params = new URLSearchParams({
      action: 'query', format: 'json', generator: 'search',
      gsrnamespace: '6', gsrsearch: request.query,
      gsrlimit: String(Math.min((request.limit || 6) * 2, 20)),
      prop: 'imageinfo', iiprop: 'url|extmetadata|user|size|mime', iiurlwidth: '1280', origin: '*',
    });
    const res = await getJson(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, { timeoutMs: 20000 });
    if (!res.ok) return res;
    const pages = res.data?.query?.pages ? Object.values(res.data.query.pages) : [];
    const results = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      const mime = String(info.mime || '');
      const isImage = /^(image\/(jpeg|png|webp|gif|svg\+xml|tiff))$/.test(mime);
      if (!isImage) continue;
      const thumbUrl = info.thumburl || info.url;
      const license = info.extmetadata?.LicenseShortName?.value || 'Unknown — see Commons file page';
      results.push({
        provider: 'wikimedia', providerAssetId: String(page.pageid), kind: mime.includes('svg') ? 'svg' : 'photo',
        url: thumbUrl, previewUrl: info.thumburl || info.url, pageUrl: info.descriptionurl,
        title: (page.title || '').replace(/^File:/, ''), creator: info.user || null,
        license, width: info.thumbwidth || info.width, height: info.thumbheight || info.height,
        mimeType: mime, meta: {
          artist: info.extmetadata?.Artist?.value || null,
          credit: info.extmetadata?.Credit?.value || null,
          licenseUrl: info.extmetadata?.LicenseUrl?.value || null,
        },
      });
    }
    return { ok: true, results };
  },
};

// ── Openverse ───────────────────────────────────────────────────────────────
// No key needed for light anonymous use (strict anonymous rate limits — keep
// per-request volume tiny and cache aggressively). Returns CC license data in
// machine-readable form for the hard gate.
export const openverse = {
  id: 'openverse',
  label: 'Openverse',
  kinds: ['photo', 'illustration', 'svg'],
  mode: 'api',
  credentials: [{ env: 'OPENVERSE_API_TOKEN', required: false, signup: 'https://api.openverse.org/v1/auth_tokens/create/', note: 'Anonymous access works but is tightly rate-limited; a free token raises the ceiling.' }],
  licenseText: 'CC license from Openverse metadata (evaluated by policy)',
  cacheTtlSeconds: 7 * 24 * 3600,
  rateLimitNote: 'Anonymous ~20 req/min; authenticated higher. Cache results.',
  available() { return true; },
  async search(request) {
    const params = new URLSearchParams({
      q: request.query, page_size: String(Math.min(request.limit || 6, 20)),
      mature: 'false', license_type: 'all-cc,+commercial',
    });
    const headers = {};
    if (process.env.OPENVERSE_API_TOKEN) headers.Authorization = `Bearer ${process.env.OPENVERSE_API_TOKEN}`;
    const res = await getJson(`https://api.openverse.org/v1/images/?${params.toString()}`, { timeoutMs: 20000, headers });
    if (!res.ok) return res;
    const results = [];
    for (const hit of res.data.results || []) {
      const license = `CC ${String(hit.license || '').toUpperCase()} ${hit.license_version || ''}`.trim();
      const url = hit.url || hit.thumbnail;
      if (!url) continue;
      results.push({
        provider: 'openverse', providerAssetId: String(hit.id), kind: hit.filetype === 'svg' ? 'svg' : 'photo',
        url, previewUrl: hit.thumbnail || url, pageUrl: hit.foreign_landing_url,
        title: hit.title || 'Openverse image', creator: hit.creator || null,
        license, width: hit.width, height: hit.height,
        mimeType: hit.filetype ? `image/${hit.filetype}` : 'image/jpeg',
        meta: { attribution: hit.attribution, source: hit.source, licenseUrl: hit.license_url },
      });
    }
    return { ok: true, results };
  },
};

export const photoProviders = [pexels, pixabay, wikimedia, openverse];
