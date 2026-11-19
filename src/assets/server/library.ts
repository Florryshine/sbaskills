// Visual asset library — DB operations: create with hard dedup (sha256),
// scored search, catalog seeding, metadata edit, delete, usage tracking.
import { db } from "@/lib/db";
import {
  writeAssetFile, deleteAssetFile, assetFileExists, sha256, slugify,
  svgDimensions, MIME_BY_EXT,
} from "./storage";
import { ASSET_CATALOG, CATALOG_BY_KEY } from "../svg/catalog";
import { minifySvg } from "../svg/kit";

export interface VisualAssetDTO {
  id: string; name: string; slug: string; description: string;
  subject: string; category: string; assetType: string; keywords: string[];
  publicUrl: string; filePath: string; mimeType: string;
  width: number | null; height: number | null; fileSizeBytes: number;
  source: string; sourceRef: string | null; sourceUrl: string | null;
  creator: string | null; license: string; licenseUrl: string | null;
  attributionRequired: boolean; attribution: string | null;
  generationParams: Record<string, unknown>;
  usageCount: number; isActive: boolean;
  createdAt: string; updatedAt: string;
}

type Row = {
  id: string; name: string; slug: string; description: string; subject: string;
  category: string; assetType: string; keywords: string; filePath: string;
  publicUrl: string; mimeType: string; width: number | null; height: number | null;
  fileSizeBytes: number; source: string; sourceRef: string | null; sourceUrl: string | null;
  creator: string | null; license: string; licenseUrl: string | null;
  attributionRequired: boolean; attribution: string | null; contentHash: string;
  generationParams: string; usageCount: number; isActive: boolean;
  createdAt: Date; updatedAt: Date;
};

export function toDTO(r: Row): VisualAssetDTO {
  let keywords: string[] = [];
  let params: Record<string, unknown> = {};
  try { keywords = JSON.parse(r.keywords); } catch { /* keep [] */ }
  try { params = JSON.parse(r.generationParams); } catch { /* keep {} */ }
  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description,
    subject: r.subject, category: r.category, assetType: r.assetType,
    keywords, filePath: r.filePath, publicUrl: r.publicUrl, mimeType: r.mimeType,
    width: r.width, height: r.height, fileSizeBytes: r.fileSizeBytes,
    source: r.source, sourceRef: r.sourceRef, sourceUrl: r.sourceUrl,
    creator: r.creator, license: r.license, licenseUrl: r.licenseUrl,
    attributionRequired: r.attributionRequired, attribution: r.attribution,
    generationParams: params, usageCount: r.usageCount, isActive: r.isActive,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------- create ---

export interface CreateAssetInput {
  name: string;
  description?: string;
  subject?: string;
  category?: string;
  assetType?: "svg" | "image" | "3d";
  keywords?: string[];
  data: Buffer;                 // raw file bytes
  ext: string;                  // svg | png | jpg | webp | glb …
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  source?: string;              // catalog|svg-llm|upload|openverse|…
  sourceRef?: string | null;
  sourceUrl?: string | null;
  creator?: string | null;
  license?: string;
  licenseUrl?: string | null;
  attributionRequired?: boolean;
  attribution?: string | null;
  generationParams?: Record<string, unknown>;
}

export interface CreateResult {
  asset: VisualAssetDTO;
  duplicate: boolean;          // true = identical content already existed
  duplicateOf?: VisualAssetDTO;
}

/** Create (or return the existing twin — hard dedup by normalised sha256). */
export async function createAsset(input: CreateAssetInput): Promise<CreateResult> {
  // normalise SVG content so cosmetic whitespace can't defeat the hash
  const isSvg = (input.ext || "").toLowerCase() === "svg";
  const normalised = isSvg ? Buffer.from(minifySvg(input.data.toString("utf8")), "utf8") : input.data;
  const hash = sha256(normalised);
  // keywords must be unique (React keys in the UI, cleaner search)
  const keywords = Array.from(new Set((input.keywords || []).map((k) => k.trim()).filter(Boolean)));

  const existing = await db.visualAsset.findUnique({ where: { contentHash: hash } });
  if (existing) return { asset: toDTO(existing), duplicate: true, duplicateOf: toDTO(existing) };

  // provider-level dedup too (same stock photo re-imported)
  if (input.source && input.sourceRef) {
    const sameSource = await db.visualAsset.findFirst({
      where: { source: input.source, sourceRef: input.sourceRef },
    });
    if (sameSource) return { asset: toDTO(sameSource), duplicate: true, duplicateOf: toDTO(sameSource) };
  }

  // unique slug (name may repeat)
  const base = slugify(input.name || "asset");
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.visualAsset.findUnique({ where: { slug } });
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const stored = writeAssetFile(slug, input.ext, input.data);
  const dims = isSvg ? svgDimensions(input.data.toString("utf8")) : null;

  const created = await db.visualAsset.create({
    data: {
      name: input.name, slug,
      description: input.description ?? "",
      subject: input.subject ?? "General",
      category: input.category ?? "object",
      assetType: input.assetType ?? (isSvg ? "svg" : "image"),
      keywords: JSON.stringify(keywords),
      filePath: stored.filePath,
      publicUrl: stored.publicUrl,
      mimeType: input.mimeType ?? MIME_BY_EXT[input.ext] ?? "application/octet-stream",
      width: input.width ?? dims?.w ?? null,
      height: input.height ?? dims?.h ?? null,
      fileSizeBytes: stored.size,
      source: input.source ?? "upload",
      sourceRef: input.sourceRef ?? null,
      sourceUrl: input.sourceUrl ?? null,
      creator: input.creator ?? null,
      license: input.license ?? "SBA Original (CC0)",
      licenseUrl: input.licenseUrl ?? null,
      attributionRequired: input.attributionRequired ?? false,
      attribution: input.attribution ?? null,
      contentHash: hash,
      generationParams: JSON.stringify(input.generationParams ?? {}),
    },
  });
  return { asset: toDTO(created), duplicate: false };
}

// ----------------------------------------------------------------- seed ---

/** Generate + store every catalog asset. Idempotent: hashes dedup, so
 * re-seeding adds nothing. Safe to call on every discovery request. */
export async function ensureCatalogSeeded(force = false): Promise<{ created: number; skipped: number; total: number }> {
  let created = 0, skipped = 0;
  const existingCount = await db.visualAsset.count({ where: { source: "catalog" } });
  if (!force && existingCount >= ASSET_CATALOG.length) {
    return { created: 0, skipped: existingCount, total: existingCount };
  }
  for (const entry of ASSET_CATALOG) {
    const res = await createAsset({
      name: entry.name,
      description: entry.description,
      subject: entry.subject,
      category: entry.category,
      keywords: [entry.name, entry.key.replace(/-/g, " "), ...entry.keywords],
      data: Buffer.from(entry.gen(), "utf8"),
      ext: "svg",
      source: "catalog",
      sourceRef: entry.key,
      license: "SBA Original (CC0)",
      attribution: "Shiney Brain Academy — original artwork",
      generationParams: { catalogKey: entry.key, generator: "builtin" },
    });
    if (res.duplicate) skipped++; else created++;
  }
  return { created, skipped, total: await db.visualAsset.count({ where: { source: "catalog" } }) };
}

// --------------------------------------------------------------- search ---

export interface SearchOpts {
  q?: string; subject?: string; category?: string; assetType?: string;
  source?: string; limit?: number;
}

const SEARCH_STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "into", "your", "what",
  "when", "how", "why", "are", "was", "were", "have", "has", "will", "about",
  "a", "an", "of", "in", "on", "to", "is", "it", "its", "as", "at", "by",
  "learn", "today", "lets", "let", "very", "some", "then", "them", "they",
]);

/** Scored search: name hits > keyword hits > subject > description.
 * Ties broken by usage count (proven assets first). SQLite `contains` is
 * case-sensitive and phrase-based, so the query is split into terms and
 * OR-searched per term, then scored in JS. */
export async function searchAssets(opts: SearchOpts): Promise<VisualAssetDTO[]> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? 60));
  const where: Record<string, unknown> = { isActive: true };
  if (opts.subject) where.subject = opts.subject;
  if (opts.category) where.category = opts.category;
  if (opts.assetType) where.assetType = opts.assetType;
  if (opts.source) where.source = opts.source;

  const q = (opts.q || "").trim().toLowerCase();
  const terms = q ? q.split(/\s+/)
    .filter((t) => t.length > 1 && !SEARCH_STOPWORDS.has(t))
    .slice(0, 8) : [];
  if (terms.length) {
    const perTerm = terms.flatMap((t) => [
      { name: { contains: t } },
      { keywords: { contains: t } },
      { subject: { contains: t } },
      { description: { contains: t } },
      { category: { contains: t } },
    ]);
    where.OR = perTerm;
  }
  const rows = await db.visualAsset.findMany({
    where, orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }], take: limit * 3,
  });
  if (!terms.length) return rows.slice(0, limit).map(toDTO);

  // word-boundary matching — a raw substring match made "join" hit "joint"
  const wordHit = (hay: string, t: string) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(hay);
  const scored = rows.map((r) => {
    const name = r.name.toLowerCase();
    const kws = r.keywords.toLowerCase();
    let s = 0;
    for (const t of terms) {
      if (name === t) s += 100;
      else if (name.startsWith(t) && t.length >= 4) s += 50; // "key" must not match "Kidneys"
      else if (wordHit(name, t)) s += 40;
      if (wordHit(kws, t)) s += 24;
      if (r.subject.toLowerCase() === t) s += 30;
      if (r.category === t) s += 26;
      if (wordHit(r.description.toLowerCase(), t)) s += 8;
    }
    s += Math.min(12, r.usageCount);
    return { r, s };
  });
  return scored.filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => toDTO(x.r));
}

// ----------------------------------------------------------------- crud ---

export async function getAsset(id: string): Promise<VisualAssetDTO | null> {
  const r = await db.visualAsset.findUnique({ where: { id } });
  return r ? toDTO(r) : null;
}

export async function updateAsset(id: string, patch: {
  name?: string; description?: string; subject?: string; category?: string;
  keywords?: string[]; license?: string; licenseUrl?: string | null;
  attribution?: string | null; attributionRequired?: boolean; isActive?: boolean;
}): Promise<VisualAssetDTO | null> {
  const existing = await db.visualAsset.findUnique({ where: { id } });
  if (!existing) return null;
  const updated = await db.visualAsset.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.keywords !== undefined ? { keywords: JSON.stringify(patch.keywords) } : {}),
      ...(patch.license !== undefined ? { license: patch.license } : {}),
      ...(patch.licenseUrl !== undefined ? { licenseUrl: patch.licenseUrl } : {}),
      ...(patch.attribution !== undefined ? { attribution: patch.attribution } : {}),
      ...(patch.attributionRequired !== undefined ? { attributionRequired: patch.attributionRequired } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    },
  });
  return toDTO(updated);
}

export async function deleteAsset(id: string): Promise<boolean> {
  const existing = await db.visualAsset.findUnique({ where: { id } });
  if (!existing) return false;
  deleteAssetFile(existing.filePath);
  await db.visualAsset.delete({ where: { id } });
  return true;
}

export async function bumpUsage(id: string): Promise<void> {
  await db.visualAsset.update({ where: { id }, data: { usageCount: { increment: 1 } } }).catch(() => {});
}

export async function libraryStats() {
  const [total, byType, bySource, sum] = await Promise.all([
    db.visualAsset.count({ where: { isActive: true } }),
    db.visualAsset.groupBy({ by: ["assetType"], _count: { _all: true }, where: { isActive: true } }),
    db.visualAsset.groupBy({ by: ["source"], _count: { _all: true }, where: { isActive: true } }),
    db.visualAsset.aggregate({ _sum: { fileSizeBytes: true }, where: { isActive: true } }),
  ]);
  return {
    total,
    byType: Object.fromEntries(byType.map((t) => [t.assetType, t._count._all])),
    bySource: Object.fromEntries(bySource.map((s) => [s.source, s._count._all])),
    totalBytes: sum._sum.fileSizeBytes ?? 0,
  };
}

/** Regenerate a catalog SVG asset from its (possibly edited) parameters. */
export async function regenerateCatalogAsset(id: string, catalogKey?: string): Promise<VisualAssetDTO | null> {
  const existing = await db.visualAsset.findUnique({ where: { id } });
  if (!existing) return null;
  let key = catalogKey;
  if (!key) {
    try { key = (JSON.parse(existing.generationParams) as { catalogKey?: string }).catalogKey; } catch { key = undefined; }
  }
  const entry = key ? CATALOG_BY_KEY.get(key) : undefined;
  if (!entry) return null;
  const svg = entry.gen();
  const updated = await db.visualAsset.update({
    where: { id },
    data: {
      filePath: existing.filePath, // same file path, new content
      width: svgDimensions(svg)?.w ?? existing.width,
      height: svgDimensions(svg)?.h ?? existing.height,
      generationParams: JSON.stringify({ catalogKey: entry.key, generator: "builtin" }),
    },
  });
  const fs = await import("fs");
  const path = await import("path");
  fs.writeFileSync(path.join(process.cwd(), "public", updated.filePath), Buffer.from(svg, "utf8"));
  return toDTO(updated);
}
