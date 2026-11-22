// lib/visual-intelligence/providers/three-d-providers.js
//
// 3D model / texture providers: Poly Haven (CC0, full public API, no key) and
// Sketchfab (official v3 API; search works anonymously but downloads need a
// token, and only downloadable + freely licensed models are surfaced).

import { getJson } from './http.js';

// ── Poly Haven ──────────────────────────────────────────────────────────────
// Everything on Poly Haven is CC0. The public API exposes the full asset list
// (models / textures / HDRIs); filtering happens client-side and the list is
// meant to be cached. Actual files download via api.polyhaven.com/files/{slug}
// and are re-hosted in our bucket — Poly Haven explicitly permits this.
export const polyHaven = {
  id: 'polyhaven',
  label: 'Poly Haven',
  kinds: ['3d', 'texture'],
  mode: 'api',
  credentials: [],
  licenseText: 'CC0 1.0 Universal (Poly Haven)',
  cacheTtlSeconds: 7 * 24 * 3600,
  rateLimitNote: 'Public API, no key; cache the asset list (we use a 7-day cache TTL)',
  available() { return true; },
  async search(request) {
    const wantTexture = request.kind === 'texture' || /texture|surface|material/i.test(request.query);
    const type = wantTexture ? 'textures' : 'models';
    const res = await getJson(`https://api.polyhaven.com/assets?t=${type}`, { timeoutMs: 30000 });
    if (!res.ok) return res;
    const assets = res.data || {};
    const terms = String(request.query || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
    const scored = [];
    for (const [slug, asset] of Object.entries(assets)) {
      const haystack = `${slug} ${asset.name || ''} ${(asset.tags || []).join(' ')}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += slug.includes(term) ? 3 : 1;
      }
      if (score > 0) scored.push({ slug, asset, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, Math.min(request.limit || 6, 12)).map(({ slug, asset }) => ({
      provider: 'polyhaven', providerAssetId: slug, kind: type === 'textures' ? 'texture' : '3d',
      url: `https://api.polyhaven.com/files/${slug}`, // resolved to concrete files at download time
      previewUrl: `https://cdn.polyhaven.com/asset_img/primary/${slug}.png?width=480&height=320`,
      pageUrl: `https://polyhaven.com/a/${slug}`,
      title: asset.name || slug, creator: Object.keys(asset.authors || {})[0] || 'Poly Haven',
      license: this.licenseText, width: null, height: null, mimeType: 'model/gltf-binary',
      meta: { polyhavenType: type, tags: asset.tags || [], categories: asset.categories || [] },
    }));
    return { ok: true, results };
  },
  /** Resolve a Poly Haven asset to a concrete downloadable file URL. */
  async resolveDownload(providerAssetId, kind) {
    const res = await getJson(`https://api.polyhaven.com/files/${providerAssetId}`, { timeoutMs: 30000 });
    if (!res.ok) return null;
    if (kind === 'texture') {
      const maps = res.data.Diffuse || resData(res.data, 'diffuse') || res.data;
      const entry = maps?.['2k']?.jpg || firstEntry(res.data);
      return entry?.url || null;
    }
    const gltf = res.data.gltf || resData(res.data, 'gltf');
    const entry = gltf?.['2k'] || gltf?.['1k'] || firstEntry(gltf) || firstEntry(res.data);
    return entry?.gltf?.url || entry?.url || null;
  },
};

function resData(data, key) {
  for (const k of Object.keys(data || {})) if (k.toLowerCase() === key) return data[k];
  return null;
}
function firstEntry(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const firstKey = Object.keys(obj)[0];
  return firstKey ? obj[firstKey] : null;
}

// ── Sketchfab ───────────────────────────────────────────────────────────────
// Official v3 API. Anonymous search is allowed; only "downloadable" models
// are requested, and without SKETCHFAB_API_TOKEN we can display metadata but
// cannot fetch the actual files (downloads are token-gated). Licenses are per
// model — CC variants pass through the hard gate.
export const sketchfab = {
  id: 'sketchfab',
  label: 'Sketchfab',
  kinds: ['3d'],
  mode: 'api',
  credentials: [{ env: 'SKETCHFAB_API_TOKEN', required: false, signup: 'https://sketchfab.com/settings/password', note: 'Needed only to download model files; search/metadata works without it.' }],
  licenseText: 'Per-model license from Sketchfab metadata (evaluated by policy)',
  cacheTtlSeconds: 24 * 3600,
  rateLimitNote: 'v3 API; keep search volume low, cache results',
  available() { return true; },
  async search(request) {
    const params = new URLSearchParams({
      type: 'models', q: request.query, downloadable: 'true', count: String(Math.min(request.limit || 6, 24)),
      sort: '-likeCount',
    });
    const headers = {};
    if (process.env.SKETCHFAB_API_TOKEN) headers.Authorization = `Token ${process.env.SKETCHFAB_API_TOKEN}`;
    const res = await getJson(`https://api.sketchfab.com/v3/search?${params.toString()}`, { timeoutMs: 25000, headers });
    if (!res.ok) return res;
    const results = [];
    for (const model of res.data.results || []) {
      const thumbs = model.thumbnails?.images || [];
      const preview = thumbs.filter((t) => t.width >= 300).sort((a, b) => a.width - b.width)[0] || thumbs[0];
      results.push({
        provider: 'sketchfab', providerAssetId: model.uid, kind: '3d',
        url: null, // resolved via /v3/models/{uid}/download (token required)
        previewUrl: preview?.url || null, pageUrl: model.viewerUrl,
        title: model.name, creator: model.user?.username || null,
        license: model.license?.label || 'Unknown — see Sketchfab model page',
        width: null, height: null, mimeType: 'model/gltf-binary',
        meta: { animationCount: model.animationCount || 0, vertexCount: model.vertexCount || null, licenseEdi: model.license || null, hasAnimation: (model.animationCount || 0) > 0 },
      });
    }
    return { ok: true, results };
  },
  async resolveDownload(providerAssetId) {
    const token = process.env.SKETCHFAB_API_TOKEN;
    if (!token) return null;
    const res = await getJson(`https://api.sketchfab.com/v3/models/${providerAssetId}/download`, {
      timeoutMs: 30000, headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) return null;
    return res.data?.gltf?.url || res.data?.glb?.url || null;
  },
};

export const threeDProviders = [polyHaven, sketchfab];
