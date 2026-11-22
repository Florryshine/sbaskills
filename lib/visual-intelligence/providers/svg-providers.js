// lib/visual-intelligence/providers/svg-providers.js
//
// SVG / icon / illustration providers.
//
// ToS honesty rule for this integration: only providers that publish an
// official, documented API are wired for automated fetching. Sources WITHOUT
// a public API (SVG Repo, unDraw, Storyset, Open Peeps) are declared as
// mode:'manual' — the admin UI shows their license terms and import path, and
// files enter the library through the existing manual upload flow (which
// already sanitises SVGs and captures license metadata). No HTML scraping, so
// no provider ToS is violated.

import { getJson } from './http.js';

// ── Openclipart ─────────────────────────────────────────────────────────────
// Official JSON search endpoint, CC0 1.0 for every clipart.
export const openclipart = {
  id: 'openclipart',
  label: 'Openclipart',
  kinds: ['svg', 'illustration', 'icon'],
  mode: 'api',
  credentials: [],
  licenseText: 'CC0 1.0 Universal (Openclipart)',
  cacheTtlSeconds: 7 * 24 * 3600,
  rateLimitNote: 'Community service — cache results, low volume',
  available() { return true; },
  async search(request) {
    const amount = Math.min(request.limit || 6, 24);
    const res = await getJson(
      `https://openclipart.org/search/json/?query=${encodeURIComponent(request.query)}&amount=${amount}&page=1`,
      { timeoutMs: 20000 }
    );
    if (!res.ok) return res;
    const items = res.data?.payload || [];
    const results = [];
    for (const item of items) {
      const svgUrl = item.svg?.url || (item.id ? `https://openclipart.org/download/${item.id}.svg` : null);
      const pngUrl = item.png?.url || null;
      if (!svgUrl && !pngUrl) continue;
      results.push({
        provider: 'openclipart', providerAssetId: String(item.id || item.uuid || svgUrl), kind: 'svg',
        url: svgUrl || pngUrl, previewUrl: pngUrl || svgUrl, pageUrl: item.detail_link || item.absolute_url || null,
        title: item.title || 'Openclipart asset', creator: item.uploaded_by?.user_name || item.created_by || null,
        license: this.licenseText, width: item.svg?.width || null, height: item.svg?.height || null,
        mimeType: 'image/svg+xml', meta: { description: item.description || null, svgIsVector: Boolean(svgUrl) },
      });
    }
    return { ok: true, results };
  },
};

// ── Manual-import sources (no public API; no scraping) ─────────────────────
function manualProvider({ id, label, kinds, licenseText, licenseUrl, attribution, derivatives, searchTips, browseUrl }) {
  return {
    id, label, kinds, mode: 'manual',
    credentials: [],
    licenseText,
    cacheTtlSeconds: 0, // nothing is fetched automatically
    rateLimitNote: 'Manual import only — no automated fetching (no public API).',
    manualImport: {
      licenseUrl, attribution, derivatives,
      tips: searchTips,
      browseUrl,
      importPath: 'Download manually from the source site, then upload on the Library tab of this page. The upload flow records creator, license and attribution and sanitises SVG files.',
    },
    available() { return false; }, // never auto-fetched
    async search() { return { ok: false, error: `${label} is a manual-import source (no public API); use the Library tab upload flow.` }; },
  };
}

export const svgRepo = manualProvider({
  id: 'svgrepo',
  label: 'SVG Repo',
  kinds: ['svg', 'icon', 'illustration'],
  licenseText: 'Varies per collection — many sets are CC0 / Public Domain; each icon page states its license',
  licenseUrl: 'https://www.svgrepo.com/page/licensing',
  attribution: 'Per-license; CC0 sets need no attribution',
  derivatives: 'Per-license',
  searchTips: 'Filter by license CC0/Public Domain inside SVG Repo, download the SVG, upload it on the Library tab.',
  browseUrl: 'https://www.svgrepo.com/vectors/science/',
});

export const unDraw = manualProvider({
  id: 'undraw',
  label: 'unDraw',
  kinds: ['illustration'],
  licenseText: 'unDraw License (open license: commercial + personal use, no attribution required, recolour allowed)',
  licenseUrl: 'https://undraw.co/license',
  attribution: 'Not required',
  derivatives: 'Allowed (recoloring is the intended use)',
  searchTips: 'Search on undraw.co, pick a skin tone / accent colour, download the SVG, upload it on the Library tab.',
  browseUrl: 'https://undraw.co/illustrations',
});

export const storyset = manualProvider({
  id: 'storyset',
  label: 'Storyset (Freepik)',
  kinds: ['illustration'],
  licenseText: 'Freepik/Storyset license: free with attribution; editable illustrations',
  licenseUrl: 'https://storyset.com/license',
  attribution: 'REQUIRED — credit "Storyset / Freepik"',
  derivatives: 'Editing allowed with attribution',
  searchTips: 'Download from storyset.com, upload on the Library tab, and set attribution to "Storyset / Freepik".',
  browseUrl: 'https://storyset.com/science',
});

export const openPeeps = manualProvider({
  id: 'openpeeps',
  label: 'Open Peeps',
  kinds: ['illustration', 'character'],
  licenseText: 'CC0 1.0 Universal (Open Peeps by Pablo Stanley)',
  licenseUrl: 'https://www.openpeeps.com/license',
  attribution: 'Not required (CC0)',
  derivatives: 'Allowed',
  searchTips: 'Use the Open Peeps hand-drawn builder (openpeeps.com) to compose a character, export SVG, upload on the Library tab.',
  browseUrl: 'https://www.openpeeps.com/',
});

export const svgProviders = [openclipart, svgRepo, unDraw, storyset, openPeeps];
