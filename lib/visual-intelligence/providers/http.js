// lib/visual-intelligence/providers/http.js
//
// Shared HTTP plumbing for every external provider module.
// - One descriptive User-Agent (Wikimedia policy; other CDNs accept it too).
// - Hard timeouts: a slow provider must never stall an engine render.
// - Never throws to the caller: failures become { ok:false, error } results
//   so one dead provider cannot fail the whole discovery chain.

export const APP_USER_AGENT =
  'ShineyBrainAcademy/1.0 (https://shineybrainacademy.vercel.app; contact: sba.support@shineybrainacademy.com)';

export function fetchWithTimeout(url, ms, headers = {}) {
  return Promise.race([
    fetch(url, { headers: { 'User-Agent': APP_USER_AGENT, ...headers } }),
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

/** JSON GET that degrades to { ok:false, error } instead of throwing. */
export async function getJson(url, { timeoutMs = 15000, headers = {} } = {}) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, { Accept: 'application/json', ...headers });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => null);
    if (!data) return { ok: false, status: res.status, error: 'Response was not valid JSON' };
    return { ok: true, status: res.status, data };
  } catch (error) {
    return { ok: false, error: error?.message || 'network error' };
  }
}

/** Binary GET with a size cap; degrades to null instead of throwing. */
export async function getBytes(url, { timeoutMs = 30000, maxBytes = 12 * 1024 * 1024, headers = {} } = {}) {
  try {
    const res = await fetchWithTimeout(url, timeoutMs, { Accept: 'image/*,model/gltf-binary,*/*', ...headers });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    const lenHeader = Number(res.headers.get('content-length') || 0);
    if (lenHeader > maxBytes) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > maxBytes) return null;
    return { buffer: buf, contentType: type };
  } catch {
    return null;
  }
}

/** Strip HTML tags from provider metadata (Wikimedia artist fields etc.). */
export function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .trim();
}
