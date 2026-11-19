// Stock image retrieval — free providers only, graceful degradation.
// No-key providers (Openverse, Wikimedia Commons) always work when the
// network is up; keyed providers (Pexels, Pixabay, Unsplash) activate
// automatically when their env key is present and are skipped otherwise.
// Nothing here is a mandatory dependency: the engine stays fully
// functional (library + local SVG generation) with zero providers.
import { createAsset } from "./library";
import { extFromMime } from "./storage";

export interface StockCandidate {
  provider: string;
  id: string;              // provider photo id
  title: string;
  thumbUrl: string;
  fullUrl: string;         // downloadable full image
  pageUrl: string;         // provider page (licence proof)
  width: number | null;
  height: number | null;
  creator: string | null;
  license: string;         // human-readable licence name
  licenseUrl: string | null;
  attributionRequired: boolean;
  attribution: string;
  mimeHint?: string;
}

export interface StockSearchResult {
  results: StockCandidate[];
  providers: Array<{ provider: string; status: "ok" | "no-key" | "error" | "no-results"; message?: string }>;
}

const TIMEOUT_MS = 9000;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

function stripHtml(s: string): string {
  return (s || "").replace(/<[^>]*>/g, "").trim();
}

// ------------------------------------------------------------- providers ---

async function searchOpenverse(query: string): Promise<StockCandidate[]> {
  // Openverse: openly-licensed (CC) media, no API key required for light use.
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=12&mature=false`;
  const data = await fetchJson(url) as { results?: Array<Record<string, unknown>> };
  return (data.results || []).map((r) => {
    const license = `${(r.license as string || "cc").toUpperCase()} ${r.license_version as string || ""}`.trim();
    const creator = stripHtml(r.creator as string || "Unknown");
    return {
      provider: "openverse",
      id: String(r.id),
      title: stripHtml(r.title as string || query),
      thumbUrl: (r.thumbnail as string) || (r.url as string),
      fullUrl: r.url as string,
      pageUrl: (r.foreign_landing_url as string) || "",
      width: (r.width as number) ?? null,
      height: (r.height as number) ?? null,
      creator,
      license: license.includes("CC0") ? "CC0 (public domain)" : license,
      licenseUrl: (r.license_url as string) || "https://creativecommons.org/licenses/",
      attributionRequired: !license.includes("CC0"),
      attribution: `"${stripHtml(r.title as string || query)}" by ${creator} — ${license} via Openverse`,
    } satisfies StockCandidate;
  });
}

async function searchWikimedia(query: string): Promise<StockCandidate[]> {
  // Wikimedia Commons API: no key, free media with licence metadata.
  const url = "https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({
    action: "query", format: "json", generator: "search",
    gsrsearch: query, gsrnamespace: "6", gsrlimit: "12",
    prop: "imageinfo", iiprop: "url|extmetadata|size|mime",
    iiurlwidth: "400",
  }).toString();
  const data = await fetchJson(url, { "User-Agent": "ShineyBrainAcademy/1.0 (asset library)" }) as {
    query?: { pages?: Record<string, Record<string, unknown>> };
  };
  const pages = Object.values(data.query?.pages || {});
  return pages.map((p) => {
    const info = (p.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
    if (!info) return null;
    const meta = (info.extmetadata as Record<string, { value?: string }> | undefined) || {};
    const license = stripHtml(meta.LicenseShortName?.value || "See Commons page");
    const artist = stripHtml(meta.Artist?.value || "Unknown");
    const title = stripHtml(String(p.title || "")).replace(/^File:/, "").replace(/\.(png|jpe?g|svg|gif|webp)$/i, "");
    return {
      provider: "wikimedia",
      id: String(p.pageid),
      title,
      thumbUrl: (info.thumburl as string) || (info.url as string),
      fullUrl: info.url as string,
      pageUrl: (info.descriptionurl as string) || "",
      width: (info.width as number) ?? null,
      height: (info.height as number) ?? null,
      creator: artist,
      license: /cc0|public domain/i.test(license) ? "CC0 / public domain" : license,
      licenseUrl: (meta.LicenseUrl?.value as string) || "https://commons.wikimedia.org/wiki/Commons:Licensing",
      attributionRequired: !/cc0|public domain/i.test(license),
      attribution: `"${title}" by ${artist} — ${license} (via Wikimedia Commons)`,
      mimeHint: info.mime as string,
    } satisfies StockCandidate;
  }).filter(Boolean) as StockCandidate[];
}

async function searchPexels(query: string): Promise<StockCandidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw Object.assign(new Error("PEXELS_API_KEY not set"), { code: "no-key" });
  const data = await fetchJson(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`, { Authorization: key }) as {
    photos?: Array<Record<string, unknown>>;
  };
  return (data.photos || []).map((p) => {
    const user = (p.user as Record<string, unknown>) || {};
    const name = String(user.name || "Pexels contributor");
    return {
      provider: "pexels",
      id: String(p.id),
      title: String(p.alt || query),
      thumbUrl: String((p.src as Record<string, string>)?.medium || ""),
      fullUrl: String((p.src as Record<string, string>)?.large2x || (p.src as Record<string, string>)?.original || ""),
      pageUrl: String(p.url || "https://www.pexels.com"),
      width: (p.width as number) ?? null,
      height: (p.height as number) ?? null,
      creator: name,
      license: "Pexels License (free to use)",
      licenseUrl: "https://www.pexels.com/license/",
      attributionRequired: false, // appreciated, not required
      attribution: `Photo by ${name} on Pexels`,
    } satisfies StockCandidate;
  });
}

async function searchPixabay(query: string): Promise<StockCandidate[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw Object.assign(new Error("PIXABAY_API_KEY not set"), { code: "no-key" });
  const data = await fetchJson(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(query)}&per_page=12&safesearch=true`) as {
    hits?: Array<Record<string, unknown>>;
  };
  return (data.hits || []).map((h) => ({
    provider: "pixabay",
    id: String(h.id),
    title: String(h.tags || query).split(",").slice(0, 4).join(", "),
    thumbUrl: String(h.webformatURL || ""),
    fullUrl: String(h.largeImageURL || h.webformatURL || ""),
    pageUrl: String(h.pageURL || "https://pixabay.com"),
    width: (h.imageWidth as number) ?? null,
    height: (h.imageHeight as number) ?? null,
    creator: String(h.user || "Pixabay contributor"),
    license: "Pixabay Content License",
    licenseUrl: "https://pixabay.com/service/license-summary/",
    attributionRequired: false, // appreciated, not required
    attribution: `Image by ${String(h.user)} on Pixabay`,
  } satisfies StockCandidate));
}

async function searchUnsplash(query: string): Promise<StockCandidate[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw Object.assign(new Error("UNSPLASH_ACCESS_KEY not set"), { code: "no-key" });
  const data = await fetchJson(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&content_filter=high`,
    { Authorization: `Client-ID ${key}` },
  ) as { results?: Array<Record<string, unknown>> };
  return (data.results || []).map((r) => {
    const user = (r.user as Record<string, unknown>) || {};
    const links = (r.links as Record<string, string>) || {};
    const urls = (r.urls as Record<string, string>) || {};
    const name = String(user.name || "Unsplash photographer");
    return {
      provider: "unsplash",
      id: String(r.id),
      title: String((r as Record<string, unknown>).alt_description || r.description || query),
      thumbUrl: urls.small || urls.regular || "",
      fullUrl: `${links.download || (urls.regular || "")}${links.download ? "?force=true" : ""}`,
      pageUrl: links.html || "https://unsplash.com",
      width: (r.width as number) ?? null,
      height: (r.height as number) ?? null,
      creator: name,
      license: "Unsplash License",
      licenseUrl: "https://unsplash.com/license",
      attributionRequired: true, // guidelines ask for credit
      attribution: `Photo by ${name} on Unsplash`,
    } satisfies StockCandidate;
  });
}

interface ProviderDef { name: string; fn: (q: string) => Promise<StockCandidate[]>; keyed: boolean; }

const PROVIDERS: ProviderDef[] = [
  { name: "openverse", fn: searchOpenverse, keyed: false },
  { name: "wikimedia", fn: searchWikimedia, keyed: false },
  { name: "pexels", fn: searchPexels, keyed: true },
  { name: "pixabay", fn: searchPixabay, keyed: true },
  { name: "unsplash", fn: searchUnsplash, keyed: true },
];

// ---------------------------------------------------------------- search ---

export async function searchStock(query: string, only?: string[]): Promise<StockSearchResult> {
  const wanted = only && only.length ? PROVIDERS.filter((p) => only.includes(p.name)) : PROVIDERS;
  const results: StockCandidate[] = [];
  const providers: StockSearchResult["providers"] = [];
  await Promise.all(wanted.map(async (p) => {
    try {
      const found = await p.fn(query);
      if (found.length === 0) {
        providers.push({ provider: p.name, status: "no-results", message: "No images matched this query." });
      } else {
        results.push(...found);
        providers.push({ provider: p.name, status: "ok", message: `${found.length} results` });
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message || String(e);
      if (err.code === "no-key" || /not set/i.test(msg)) {
        providers.push({ provider: p.name, status: "no-key", message: "No API key configured — add it in .env to enable (free tier)." });
      } else {
        providers.push({ provider: p.name, status: "error", message: /abort/i.test(msg) ? "Timed out — service unreachable." : msg.slice(0, 140) });
      }
    }
  }));
  return { results, providers };
}

// ---------------------------------------------------------------- import ---

const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

/** Download a candidate and store it in the library with full licence metadata. */
export async function importStockCandidate(c: StockCandidate): Promise<{ assetId: string; duplicate: boolean; bytes: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  try {
    res = await fetch(c.fullUrl, { signal: ctrl.signal });
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMPORT_BYTES) throw new Error("Image too large to import (limit 15 MB).");
  if (buf.length < 256) throw new Error("Downloaded file looks empty or blocked.");

  const mime = res.headers.get("content-type")?.split(";")[0] || c.mimeHint || "image/jpeg";
  if (!/image\/|model\//.test(mime)) throw new Error(`Provider returned unexpected content type: ${mime}`);
  const ext = extFromMime(mime);

  const created = await createAsset({
    name: c.title.slice(0, 90) || `${c.provider}-${c.id}`,
    description: `Stock image from ${c.provider}. ${c.pageUrl}`,
    subject: "General",
    category: "object",
    assetType: ext === "glb" || ext === "gltf" ? "3d" : "image",
    keywords: [c.provider, c.title].filter(Boolean),
    data: buf, ext, mimeType: mime,
    width: c.width, height: c.height,
    source: c.provider,
    sourceRef: c.id,
    sourceUrl: c.pageUrl,
    creator: c.creator,
    license: c.license,
    licenseUrl: c.licenseUrl,
    attributionRequired: c.attributionRequired,
    attribution: c.attribution,
  });
  return { assetId: created.asset.id, duplicate: created.duplicate, bytes: buf.length };
}

export function providerKeyStatus(): Array<{ provider: string; configured: boolean }> {
  return [
    { provider: "openverse", configured: true },   // never needs a key
    { provider: "wikimedia", configured: true },   // never needs a key
    { provider: "pexels", configured: !!process.env.PEXELS_API_KEY },
    { provider: "pixabay", configured: !!process.env.PIXABAY_API_KEY },
    { provider: "unsplash", configured: !!process.env.UNSPLASH_ACCESS_KEY },
  ];
}
