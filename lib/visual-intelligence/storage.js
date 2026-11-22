// lib/visual-intelligence/storage.js
//
// STORE stage — the four-tier storage policy.
//
//   A  visual_search_cache        provider search results, TTL-bounded
//                                 (Pixabay hard-capped at 24h by their terms)
//   B  visual_ephemeral_assets    downloaded/staged bytes kept only while a
//                                 render needs them; purged by TTL cron
//   C  visual_assets (existing)   the permanent, admin-approved, reusable
//                                 library — provenance + license attached
//   D  procedural library         code-generated SVGs; outputs are stored in C
//                                 with source='procedural'
//
// Dedup: sha256 of file bytes; a duplicate upload re-points to the existing
// row instead of storing a second copy.
//
// Every function degrades gracefully: with Supabase env missing (local tests,
// worker boxes without creds) storage ops return { stored:false, reason }
// instead of throwing, so engines keep working.

import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'visual-assets'; // same bucket the existing library uses
const PREFIX = { ephemeral: 'ephemeral', library: 'library' };

let cachedClient = null;
export function getStorageClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedClient;
}

export function storageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function slugify(value) {
  return String(value || 'visual-asset').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'visual-asset';
}

// ── TIER A — search result cache ────────────────────────────────────────────
export function cacheKey(provider, query, extra = {}) {
  return sha256(Buffer.from(JSON.stringify({ provider, query: String(query).toLowerCase().trim(), ...extra })));
}

/** Pixabay's API terms cap result caching at 24h — the registry-level TTL is
 *  min(provider TTL, 24h) for pixabay, provider TTL otherwise. */
export function effectiveTtl(provider) {
  const ttl = provider?.cacheTtlSeconds ?? 24 * 3600;
  return provider?.id === 'pixabay' ? Math.min(ttl, 24 * 3600) : ttl;
}

export async function cacheSearchResults(providerId, query, extra, ttlSeconds, results) {
  const supabase = getStorageClient();
  if (!supabase) return { stored: false, reason: 'supabase-not-configured' };
  try {
    const key = cacheKey(providerId, query, extra);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const { error } = await supabase.from('visual_search_cache').upsert({
      cache_key: key, provider: providerId, query: String(query).slice(0, 300),
      params: extra || {}, results, expires_at: expiresAt,
    }, { onConflict: 'cache_key' });
    if (error) return { stored: false, reason: error.message };
    return { stored: true, cacheKey: key, expiresAt };
  } catch (error) {
    return { stored: false, reason: error?.message || 'cache write failed' };
  }
}

export async function readSearchCache(providerId, query, extra) {
  const supabase = getStorageClient();
  if (!supabase) return { hit: false, reason: 'supabase-not-configured' };
  try {
    const key = cacheKey(providerId, query, extra);
    const { data, error } = await supabase.from('visual_search_cache')
      .select('results, expires_at').eq('cache_key', key).maybeSingle();
    if (error) return { hit: false, reason: error.message };
    if (!data) return { hit: false };
    if (new Date(data.expires_at).getTime() < Date.now()) return { hit: false, expired: true };
    return { hit: true, results: data.results || [], expiresAt: data.expires_at };
  } catch (error) {
    return { hit: false, reason: error?.message || 'cache read failed' };
  }
}

// ── TIER B — ephemeral assets ───────────────────────────────────────────────
/**
 * Stage bytes for short-lived use (a render in progress, an admin preview).
 * retainUntilSeconds: 0 → default 7 days; render callers pass their job id so
 * cleanup can keep files whose render is still active.
 */
export async function stageEphemeral({ buffer, mimeType, name, retainUntilSeconds = 7 * 24 * 3600, retainedFor = null, requestContext = null }) {
  const supabase = getStorageClient();
  if (!supabase) return { stored: false, reason: 'supabase-not-configured' };
  try {
    const hash = sha256(buffer);
    // Dedup: same bytes already staged and not yet expired → reuse that row.
    const { data: existing } = await supabase.from('visual_ephemeral_assets')
      .select('id, storage_path, public_url, expires_at')
      .eq('content_hash', hash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (existing) {
      await supabase.from('visual_ephemeral_assets').update({
        last_used_at: new Date().toISOString(),
        retained_for: retainedFor || existing.retained_for || null,
      }).eq('id', existing.id);
      return { stored: true, reused: true, ...existing };
    }
    const ext = (mimeType || 'image/jpeg').split('/')[1]?.replace('+xml', '') || 'bin';
    const path = `${PREFIX.ephemeral}/${slugify(name || 'asset')}-${hash.slice(0, 10)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimeType || 'application/octet-stream', upsert: false,
    });
    if (upErr && !/exists/i.test(upErr.message || '')) return { stored: false, reason: upErr.message };
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const expiresAt = new Date(Date.now() + retainUntilSeconds * 1000).toISOString();
    const row = {
      name: String(name || 'Ephemeral asset').slice(0, 160),
      storage_path: path, public_url: pub?.publicUrl || null,
      mime_type: mimeType || 'application/octet-stream', file_size_bytes: buffer.length,
      content_hash: hash, retained_for: retainedFor, request_context: requestContext || {},
      expires_at: expiresAt, last_used_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('visual_ephemeral_assets').insert(row).select('id, storage_path, public_url, expires_at').single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
      return { stored: false, reason: error.message };
    }
    return { stored: true, reused: false, ...data };
  } catch (error) {
    return { stored: false, reason: error?.message || 'ephemeral staging failed' };
  }
}

export async function listEphemeral({ includeExpired = false, limit = 100 } = {}) {
  const supabase = getStorageClient();
  if (!supabase) return { ok: false, reason: 'supabase-not-configured', items: [] };
  try {
    let q = supabase.from('visual_ephemeral_assets')
      .select('*').order('created_at', { ascending: false }).limit(limit);
    if (!includeExpired) q = q.gt('expires_at', new Date().toISOString());
    const { data, error } = await q;
    if (error) return { ok: false, reason: error.message, items: [] };
    return { ok: true, items: data || [] };
  } catch (error) {
    return { ok: false, reason: error?.message || 'list failed', items: [] };
  }
}

/** Purge expired ephemeral rows + their bytes. Called by the cron route. */
export async function purgeExpiredEphemeral({ dryRun = false } = {}) {
  const supabase = getStorageClient();
  if (!supabase) return { ok: false, reason: 'supabase-not-configured', purged: [] };
  try {
    const { data: expired, error } = await supabase.from('visual_ephemeral_assets')
      .select('id, storage_path').lt('expires_at', new Date().toISOString()).limit(200);
    if (error) return { ok: false, reason: error.message, purged: [] };
    if (!expired?.length) return { ok: true, purged: [] };
    if (dryRun) return { ok: true, purged: expired.map((e) => e.storage_path), dryRun: true };
    const paths = expired.map((e) => e.storage_path).filter(Boolean);
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    await supabase.from('visual_ephemeral_assets').delete()
      .in('id', expired.map((e) => e.id));
    return { ok: true, purged: paths };
  } catch (error) {
    return { ok: false, reason: error?.message || 'purge failed', purged: [] };
  }
}

// ── TIER C — permanent library (existing visual_assets table) ───────────────
/**
 * Store a file permanently. Dedup by content hash mirrors the existing
 * upload route: same bytes → return the existing asset with reused:true.
 * Only call this for assets that passed inspection AND (for external sources)
 * admin approval.
 */
export async function storePermanent({ buffer, mimeType, name, description = '', subject = 'General', category = 'object', assetType = 'image', keywords = [], source = 'upload', sourceRef = null, sourceUrl = null, creator = null, license = 'Unspecified — verify before external use', licenseUrl = null, attributionRequired = false, attribution = null, provider = null, providerAssetId = null, inspection = null, tier = 'library', generationParams = {} }) {
  const supabase = getStorageClient();
  if (!supabase) return { stored: false, reason: 'supabase-not-configured' };
  try {
    const hash = sha256(buffer);
    const { data: duplicate } = await supabase.from('visual_assets')
      .select('id, name, slug, public_url, storage_path, mime_type, file_size_bytes, license, usage_count')
      .eq('content_hash', hash).maybeSingle();
    if (duplicate) return { stored: true, reused: true, asset: duplicate };

    const extMap = { 'image/svg+xml': 'svg', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'model/gltf-binary': 'glb' };
    const ext = extMap[mimeType] || (mimeType || '').split('/')[1] || 'bin';
    const slug = `${slugify(name)}-${hash.slice(0, 8)}`;
    const storagePath = `${PREFIX.library}/${slug}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimeType || 'application/octet-stream', upsert: false,
    });
    if (upErr) return { stored: false, reason: 'storage upload failed: ' + upErr.message };
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (!pub?.publicUrl) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return { stored: false, reason: 'could not resolve public URL' };
    }

    const payload = {
      name: String(name || 'Visual asset').slice(0, 160), slug,
      description: String(description || '').slice(0, 1000),
      subject: String(subject || 'General').slice(0, 80),
      category: String(category || 'object').slice(0, 60),
      asset_type: ['svg', 'image', '3d', 'gif', 'video'].includes(assetType) ? assetType : 'image',
      keywords: (keywords || []).slice(0, 30),
      storage_path: storagePath, public_url: pub.publicUrl,
      mime_type: mimeType || 'application/octet-stream',
      file_size_bytes: buffer.length,
      source: String(source || 'upload').slice(0, 60),
      source_ref: sourceRef, source_url: sourceUrl, creator,
      license: String(license || 'Unspecified — verify before external use').slice(0, 180),
      license_url: licenseUrl,
      attribution_required: Boolean(attributionRequired),
      attribution: attribution ? String(attribution).slice(0, 500) : null,
      content_hash: hash,
      generation_params: generationParams || {},
      approval_status: 'approved',
      provider, provider_asset_id: providerAssetId,
      inspection: inspection || {},
      tier: ['library', 'procedural'].includes(tier) ? tier : 'library',
    };
    const { data: asset, error } = await supabase.from('visual_assets').insert(payload)
      .select('*').single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
      return { stored: false, reason: 'library insert failed: ' + error.message };
    }
    return { stored: true, reused: false, asset };
  } catch (error) {
    return { stored: false, reason: error?.message || 'permanent store failed' };
  }
}

/** Bump usage_count when an engine actually consumes a library asset. */
export async function recordUsage(assetId) {
  const supabase = getStorageClient();
  if (!supabase || !assetId) return { ok: false };
  try {
    const { error } = await supabase.rpc('increment_visual_asset_usage', { p_asset_id: assetId });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error?.message || 'usage record failed' };
  }
}

// ── TIER C search — reuse-before-fetch ──────────────────────────────────────
export async function searchLibrary({ subject, keywords = [], kinds = [], limit = 5 }) {
  const supabase = getStorageClient();
  if (!supabase) return { ok: false, reason: 'supabase-not-configured', assets: [] };
  try {
    let q = supabase.from('visual_assets')
      .select('*').eq('is_active', true).eq('approval_status', 'approved')
      .order('usage_count', { ascending: false }).limit(limit);
    if (subject) q = q.or(`subject.ilike.%${subject}%,name.ilike.%${subject}%,description.ilike.%${subject}%`);
    if (keywords.length) q = q.overlaps('keywords', keywords.slice(0, 8));
    if (kinds.length) {
      const typeMap = { photo: ['image'], svg: ['svg'], illustration: ['svg', 'image'], video: ['video'], '3d': ['3d'], texture: ['image', '3d'], diagram: ['svg', 'image'], icon: ['svg'], background: ['image'], character: ['svg', 'image'] };
      const types = [...new Set(kinds.flatMap((k) => typeMap[k] || []))];
      if (types.length) q = q.in('asset_type', types);
    }
    const { data, error } = await q;
    if (error) return { ok: false, reason: error.message, assets: [] };
    return { ok: true, assets: data || [] };
  } catch (error) {
    return { ok: false, reason: error?.message || 'library search failed', assets: [] };
  }
}

// ── stats for the admin panel ───────────────────────────────────────────────
export async function storageStats() {
  const supabase = getStorageClient();
  if (!supabase) return { ok: false, reason: 'supabase-not-configured' };
  try {
    const [library, ephemeral, cache] = await Promise.all([
      supabase.from('visual_assets').select('id, file_size_bytes, asset_type, source, approval_status, tier').eq('is_active', true),
      supabase.from('visual_ephemeral_assets').select('id, file_size_bytes, expires_at').gt('expires_at', new Date().toISOString()),
      supabase.from('visual_search_cache').select('cache_key, expires_at').gt('expires_at', new Date().toISOString()),
    ]);
    const libRows = library.data || [];
    const ephRows = ephemeral.data || [];
    const sum = (rows, f) => rows.reduce((acc, r) => acc + (Number(r[f]) || 0), 0);
    return {
      ok: true,
      library: {
        count: libRows.length,
        bytes: sum(libRows, 'file_size_bytes'),
        byType: libRows.reduce((acc, r) => { acc[r.asset_type] = (acc[r.asset_type] || 0) + 1; return acc; }, {}),
        bySource: libRows.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc; }, {}),
        byTier: libRows.reduce((acc, r) => { acc[r.tier || 'library'] = (acc[r.tier || 'library'] || 0) + 1; return acc; }, {}),
        pendingApproval: libRows.filter((r) => r.approval_status === 'pending_review').length,
      },
      ephemeral: { count: ephRows.length, bytes: sum(ephRows, 'file_size_bytes') },
      searchCache: { activeEntries: (cache.data || []).length },
    };
  } catch (error) {
    return { ok: false, reason: error?.message || 'stats failed' };
  }
}
