// lib/visual-intelligence/providers/index.js
//
// Provider registry for the shared visual intelligence service.
//
// Modularity contract: a provider with missing credentials or a failed
// endpoint disables ONLY itself. `listProviders()` powers the admin status
// panel; `runProviderSearch()` is what the orchestrator calls.

import { photoProviders } from './photo-providers.js';
import { svgProviders } from './svg-providers.js';
import { threeDProviders } from './three-d-providers.js';

export const PROVIDERS = [...photoProviders, ...svgProviders, ...threeDProviders];

export function getProvider(id) {
  return PROVIDERS.find((p) => p.id === id) || null;
}

/** Status snapshot for the admin UI. Never throws. */
export function listProviders() {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kinds: p.kinds,
    mode: p.mode, // 'api' = automated fetch allowed, 'manual' = import via upload flow
    available: p.available(),
    licenseText: p.licenseText,
    cacheTtlSeconds: p.cacheTtlSeconds,
    rateLimitNote: p.rateLimitNote,
    credentials: (p.credentials || []).map((c) => ({
      env: c.env,
      required: Boolean(c.required),
      configured: Boolean(process.env[c.env]),
      note: c.note || null,
      signup: c.signup || null,
    })),
    manualImport: p.manualImport || null,
  }));
}

/**
 * Query every applicable provider for one request.
 * - respects request.providerAllow / request.providerDeny
 * - skips providers whose kinds don't intersect the requested kinds
 * - skips providers missing credentials (recorded in `skipped`)
 * - collects per-provider errors without failing the batch
 */
export async function runProviderSearch(request, { perProviderTimeoutMs = 25000 } = {}) {
  const kinds = request.kinds || ['photo', 'illustration', 'svg'];
  const allow = request.providerAllow || null;
  const deny = new Set(request.providerDeny || []);
  const skipped = [];
  const errors = [];
  const all = [];

  const applicable = PROVIDERS.filter((p) => {
    if (!p.kinds.some((k) => kinds.includes(k))) return false;
    if (allow && !allow.includes(p.id)) return false;
    if (deny.has(p.id)) return false;
    return true;
  });

  await Promise.all(applicable.map(async (provider) => {
    if (!provider.available()) {
      skipped.push({ provider: provider.id, reason: 'credentials-missing-or-manual' });
      return;
    }
    try {
      const result = await Promise.race([
        provider.search(request),
        new Promise((_, rej) => setTimeout(() => rej(new Error('provider timeout')), perProviderTimeoutMs)),
      ]);
      if (!result?.ok) {
        errors.push({ provider: provider.id, error: result?.error || 'unknown provider error' });
        return;
      }
      for (const r of result.results || []) all.push(r);
    } catch (error) {
      errors.push({ provider: provider.id, error: error?.message || 'provider crashed' });
    }
  }));

  return { results: all, skipped, errors };
}

/** Fetch the actual bytes for a candidate (delegates to provider-specific resolvers). */
export async function fetchCandidateBytes(candidate) {
  const { getBytes } = await import('./http.js');
  const provider = getProvider(candidate.provider);
  let url = candidate.url;
  if (!url && provider?.resolveDownload) {
    url = await provider.resolveDownload(candidate.providerAssetId, candidate.kind);
    if (url) candidate.url = url;
  }
  if (!url) return { ok: false, error: 'No downloadable URL (token may be required for this provider).' };
  const bytes = await getBytes(url, { timeoutMs: 60000, maxBytes: 12 * 1024 * 1024 });
  if (!bytes) return { ok: false, error: 'Download failed or exceeded the 12 MB safety cap.' };
  return { ok: true, ...bytes };
}
