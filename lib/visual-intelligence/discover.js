// lib/visual-intelligence/discover.js
//
// The orchestrator implementing the shared workflow:
//
//   FETCH   → library (tier C) reuse first, then search cache (tier A), then
//             live provider queries (skipping providers without credentials)
//   INSPECT → bytes downloaded, magic-number validated, sharp-probed, and
//             (when a vision key exists) judged by a Gemini vision model for
//             subject match, scientific accuracy, watermarks and style
//   DECIDE  → use / adapt / create / no-match with explicit reasons; license
//             policy is a hard gate, never advisory
//   USE/ADAPT/CREATE → returns the winning candidate (staged to tier B for
//             renders) with adaptation instructions when needed
//   STORE IF WORTH KEEPING → search results cached with per-provider TTLs
//             (Pixabay capped at 24h by their terms); permanent storage of
//             external files happens ONLY through explicit approval, while
//             procedural outputs (tier D, SBA Original CC0) may be persisted
//             immediately because we own them outright.
//
// Engines call this module directly (same process) or via the HTTP service.
// The service contract NEVER throws: any internal failure degrades to a
// structured { ok:false } / no-match result so existing render pipelines keep
// running untouched.

import { runProviderSearch, fetchCandidateBytes, getProvider } from './providers/index.js';
import { inspectCandidates, visionAvailable } from './inspect.js';
import { decideBatch, aggregateDecision } from './decide.js';
import { generateProcedural } from './procedural.js';
import {
  cacheSearchResults, readSearchCache, effectiveTtl,
  searchLibrary, stageEphemeral, storePermanent, storageConfigured,
} from './storage.js';

export const SERVICE_VERSION = 1;

function normalizeRequest(input = {}) {
  const kinds = Array.isArray(input.kinds) && input.kinds.length
    ? input.kinds
    : (input.kind ? [input.kind] : ['photo', 'illustration', 'svg']);
  return {
    subject: String(input.subject || input.query || '').trim(),
    sceneDescription: String(input.sceneDescription || '').trim(),
    query: String(input.query || input.subject || '').trim(),
    kinds,
    kind: kinds[0],
    style: input.style || null,
    format: input.format || null,
    transparent: Boolean(input.transparent),
    scientificAccuracy: ['strict', 'normal', 'relaxed'].includes(input.scientificAccuracy) ? input.scientificAccuracy : 'normal',
    animated: Boolean(input.animated) || null,
    allowNonCommercial: Boolean(input.allowNonCommercial),
    allowNoDerivs: Boolean(input.allowNoDerivs),
    allowCreate: input.allowCreate !== false,
    minWidth: Number(input.minWidth) || 480,
    minHeight: Number(input.minHeight) || 360,
    keywords: Array.isArray(input.keywords) ? input.keywords.slice(0, 10) : [],
    providerAllow: Array.isArray(input.providerAllow) ? input.providerAllow : null,
    providerDeny: Array.isArray(input.providerDeny) ? input.providerDeny : [],
    targetEngine: String(input.targetEngine || 'any').slice(0, 60),
    renderJobRef: input.renderJobRef ? String(input.renderJobRef).slice(0, 120) : null,
    persist: ['none', 'ephemeral'].includes(input.persist) ? input.persist : 'ephemeral',
    thresholds: input.thresholds || {},
    maxCandidates: Math.min(Number(input.maxCandidates) || 12, 24),
    inspectionLimit: Math.min(Number(input.inspectionLimit) || 6, 12),
    skipLibrary: Boolean(input.skipLibrary),
  };
}

/** Full per-candidate info for the admin UI (never includes raw bytes). */
function decisionToCandidateView(d) {
  return {
    provider: d.candidate.provider,
    providerAssetId: d.candidate.providerAssetId,
    title: d.candidate.title,
    kind: d.candidate.kind,
    previewUrl: d.candidate.previewUrl,
    pageUrl: d.candidate.pageUrl,
    width: d.candidate.width,
    height: d.candidate.height,
    creator: d.candidate.creator || null,
    licenseText: d.candidate.license,
    licenseUrl: d.candidate.meta?.licenseUrl || null,
    url: d.candidate.url || null,
    decision: d.decision,
    licenseStatus: d.licenseCheck.status,
    license: { status: d.licenseCheck.status, text: d.licenseCheck.license, rule: d.licenseCheck.rule },
    attribution: d.attribution,
    attributionRequired: d.licenseCheck.rule?.attribution === 'required',
    subjectMatch: d.inspection.vision?.available ? d.inspection.vision.subjectMatch : null,
    scientificAccuracy: d.inspection.vision?.scientificAccuracy || null,
    watermark: Boolean(d.inspection.vision?.watermark),
    visionModel: d.inspection.vision?.model || null,
    visionNote: d.inspection.vision && !d.inspection.vision.available ? d.inspection.vision.note : null,
    checks: d.inspection.checks || {},
    adaptations: d.adaptations,
    reasons: d.reasons || [],
    explanation: d.explanation,
    score: d.score,
    contentSha256: d.inspection.contentSha256 || null,
  };
}

/**
 * Core pipeline. Returns the full internal state (including bytes on each
 * decision) for other internal helpers, and is wrapped by discoverVisual.
 */
async function runPipeline(rawRequest, { useCache, wantVision }) {
  const startedAt = new Date().toISOString();
  const request = normalizeRequest(rawRequest);
  const audit = { steps: [], providers: null, cache: null, libraryHit: null };

  // 1. FETCH — permanent library first (reuse before fetching).
  if (!request.skipLibrary) {
    const libSearch = await searchLibrary({
      subject: request.subject, keywords: request.keywords, kinds: request.kinds, limit: 4,
    });
    if (libSearch.ok && libSearch.assets.length) {
      const libAsset = libSearch.assets[0];
      audit.libraryHit = { reused: true, assetId: libAsset.id, name: libAsset.name };
      audit.steps.push('library-reuse');
      return { request, audit, startedAt, libraryHit: libAsset };
    }
  }

  // 2. FETCH — search cache (tier A), then live providers.
  let candidates = [];
  if (useCache && storageConfigured()) {
    const cached = await readSearchCache('multi', request.query, {
      kinds: request.kinds, allow: request.providerAllow,
    });
    if (cached.hit) {
      candidates = cached.results || [];
      audit.cache = { hit: true, expiresAt: cached.expiresAt };
      audit.steps.push('search-cache-hit');
    }
  }
  if (!candidates.length) {
    const search = await runProviderSearch({
      query: request.query,
      kinds: request.kinds,
      kind: request.kind,
      style: request.style,
      limit: Math.max(4, Math.ceil(request.maxCandidates / 2)),
      providerAllow: request.providerAllow,
      providerDeny: request.providerDeny,
    });
    audit.providers = { skipped: search.skipped, errors: search.errors, found: search.results.length };
    audit.steps.push('provider-fetch');
    candidates = search.results;
    if (useCache && storageConfigured() && candidates.length) {
      // Cache with the shortest relevant provider TTL (Pixabay stays ≤ 24h).
      const providerTtls = [...new Set(candidates.map((c) => c.provider))]
        .map((id) => effectiveTtl(getProvider(id)));
      const ttl = providerTtls.length ? Math.min(...providerTtls) : 24 * 3600;
      const stored = await cacheSearchResults('multi', request.query, {
        kinds: request.kinds, allow: request.providerAllow,
      }, ttl, candidates);
      audit.cache = { hit: false, stored: stored.stored, reason: stored.reason, ttlSeconds: ttl };
    }
  }

  if (!candidates.length) {
    return { request, audit, startedAt, candidatesEmpty: true, inspected: [], decisions: [] };
  }

  // 3. INSPECT — bytes + probe + optional vision judgement.
  const inspected = await inspectCandidates(candidates, request, { limit: request.inspectionLimit });
  audit.steps.push('inspected:' + inspected.length);

  // 4. DECIDE — hard gates, ranking, explanations.
  const decisions = decideBatch(inspected, request);
  const outcome = aggregateDecision(decisions, request);
  audit.steps.push('decided:' + outcome.decision);

  return { request, audit, startedAt, inspected, decisions, outcome };
}

/**
 * Main entry point. Never throws.
 */
export async function discoverVisual(rawRequest, opts = {}) {
  const { useCache = true, wantVision = true, includeCandidates = false } = opts;
  try {
    const pipeline = await runPipeline(rawRequest, { useCache, wantVision });
    const { request, audit, startedAt } = pipeline;

    if (!request.query && !request.subject) {
      return noMatch(request, startedAt, audit, 'No subject or query provided.');
    }

    // Library reuse path.
    if (pipeline.libraryHit) {
      const libAsset = pipeline.libraryHit;
      return {
        ok: true, decision: 'use', reuse: 'library', serviceVersion: SERVICE_VERSION,
        request: { subject: request.subject, kinds: request.kinds, targetEngine: request.targetEngine },
        asset: {
          id: libAsset.id, name: libAsset.name, url: libAsset.public_url,
          storagePath: libAsset.storage_path, mimeType: libAsset.mime_type,
          assetType: libAsset.asset_type, width: libAsset.width, height: libAsset.height,
          source: libAsset.source, license: libAsset.license,
          attribution: libAsset.attribution_required ? libAsset.attribution : null,
          usageCount: libAsset.usage_count,
        },
        license: { status: 'allowed', text: libAsset.license },
        storage: { tier: 'C', mode: 'permanent-library' },
        explanation: `Reused existing approved library asset "${libAsset.name}" — no external fetch needed.`,
        audit, startedAt, finishedAt: new Date().toISOString(),
      };
    }

    if (pipeline.candidatesEmpty) {
      if (request.allowCreate) {
        return await createPath(request, startedAt, audit, 'All providers returned zero results (credentials missing, rate limits, or no matches).');
      }
      return noMatch(request, startedAt, audit, 'All providers returned zero results and procedural generation is disabled.');
    }

    const outcome = pipeline.outcome;
    if (outcome.decision === 'no-match') {
      const result = noMatch(request, startedAt, audit, outcome.summary, pipeline.decisions);
      if (includeCandidates) result.candidates = pipeline.decisions.map(decisionToCandidateView);
      return result;
    }
    if (outcome.decision === 'create') {
      const result = await createPath(request, startedAt, audit, outcome.summary, pipeline.decisions);
      if (includeCandidates) result.candidates = pipeline.decisions.map(decisionToCandidateView);
      return result;
    }

    // USE / ADAPT — stage bytes to tier B for the caller (render window).
    const chosen = outcome.selected;
    const result = {
      ok: true,
      decision: outcome.decision,
      serviceVersion: SERVICE_VERSION,
      request: { subject: request.subject, kinds: request.kinds, targetEngine: request.targetEngine },
      asset: {
        provider: chosen.candidate.provider,
        providerAssetId: chosen.candidate.providerAssetId,
        title: chosen.candidate.title,
        previewUrl: chosen.candidate.previewUrl,
        pageUrl: chosen.candidate.pageUrl,
        width: chosen.candidate.width,
        height: chosen.candidate.height,
        kind: chosen.candidate.kind,
      },
      license: {
        status: chosen.licenseCheck.status,
        text: chosen.licenseCheck.license,
        attributionRequired: chosen.licenseCheck.rule?.attribution === 'required',
        attribution: chosen.attribution,
        licenseUrl: chosen.candidate.meta?.licenseUrl || null,
      },
      inspection: {
        verdict: chosen.inspection.verdict,
        subjectMatch: chosen.inspection.vision?.available ? chosen.inspection.vision.subjectMatch : null,
        scientificAccuracy: chosen.inspection.vision?.scientificAccuracy || null,
        visionModel: chosen.inspection.vision?.model || null,
        checks: chosen.inspection.checks,
        contentSha256: chosen.inspection.contentSha256,
      },
      adaptations: chosen.adaptations,
      explanation: outcome.summary,
      rejectedCount: outcome.rejected,
      audit,
      startedAt,
      finishedAt: null,
    };
    if (includeCandidates) result.candidates = pipeline.decisions.map(decisionToCandidateView);

    if (request.persist === 'ephemeral' && chosen.bytes && storageConfigured()) {
      const staged = await stageEphemeral({
        buffer: chosen.bytes,
        mimeType: chosen.mimeType || chosen.candidate.mimeType,
        name: `${request.subject}-${chosen.candidate.providerAssetId}`,
        retainedFor: request.renderJobRef,
        requestContext: { engine: request.targetEngine, decision: outcome.decision },
      });
      result.storage = {
        tier: 'B', mode: 'ephemeral',
        stored: staged.stored, reused: staged.reused || false,
        url: staged.public_url || null, storagePath: staged.storage_path || null,
        expiresAt: staged.expires_at || null,
        reason: staged.stored ? undefined : staged.reason,
      };
      if (staged.stored) result.asset.url = staged.public_url;
      audit.steps.push('staged-ephemeral');
    } else if (request.persist !== 'none') {
      result.storage = {
        tier: 'B', mode: 'ephemeral', stored: false,
        reason: storageConfigured() ? 'no downloadable bytes for the selected candidate' : 'supabase-not-configured',
      };
    }

    result.finishedAt = new Date().toISOString();
    return result;
  } catch (error) {
    // Absolute last resort: the service contract never throws to engines.
    return {
      ok: false,
      decision: 'no-match',
      error: error?.message || 'unknown discovery failure',
      explanation: 'Visual discovery failed internally; the engine should continue with its own pipeline (text fallback allowed).',
      audit: { steps: [] },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }
}

/**
 * Internal helper for the admin save flow: re-run the pipeline restricted to
 * one provider and return the FULL decision (with bytes) for the selected
 * asset. Used by app/api/admin/visual-intelligence/save.
 */
export async function refetchSelected(rawRequest, selection) {
  const pipeline = await runPipeline(
    { ...rawRequest, providerAllow: [selection.provider], skipLibrary: true },
    { useCache: false, wantVision: false }
  );
  const decisions = pipeline.decisions || [];
  const match = decisions.find(
    (d) => ['use', 'adapt'].includes(d.decision) && String(d.candidate.providerAssetId) === String(selection.providerAssetId)
  );
  if (match) return { ok: true, decision: match };
  const any = decisions.find((d) => ['use', 'adapt'].includes(d.decision));
  if (any) return { ok: true, decision: any, note: 'Exact asset no longer listed; returning the best available from the same provider.' };
  return {
    ok: false,
    error: pipeline.candidatesEmpty
      ? 'Provider returned no candidates on re-fetch.'
      : 'No qualifying candidate from this provider on re-fetch.',
    decisions: decisions.map((d) => ({ provider: d.candidate.provider, id: d.candidate.providerAssetId, decision: d.decision, why: d.explanation?.slice(0, 200) })),
  };
}

/** CREATE path — procedural generation (tier D). */
async function createPath(request, startedAt, audit, summary) {
  const generated = generateProcedural({
    subject: request.subject,
    keywords: request.keywords.length ? request.keywords : request.query.split(/\s+/).slice(0, 4),
    kind: request.kinds[0],
    width: request.format === '9:16' ? 720 : 1280,
    height: request.format === '9:16' ? 1280 : 720,
    templateId: request.proceduralTemplateId || null,
  });
  audit.steps.push('procedural-generate');
  if (!generated.ok) {
    return noMatch(request, startedAt, audit, `${summary} Procedural generation also failed: ${generated.error}`);
  }

  const result = {
    ok: true,
    decision: 'created',
    serviceVersion: SERVICE_VERSION,
    request: { subject: request.subject, kinds: request.kinds, targetEngine: request.targetEngine },
    asset: {
      provider: 'procedural',
      providerAssetId: `${generated.templateId}:${generated.seedHex}`,
      title: `Procedural ${generated.templateLabel} for "${request.subject}"`,
      kind: 'svg',
      svg: generated.svg,
      width: generated.width,
      height: generated.height,
    },
    license: { status: 'allowed', text: 'SBA Original (CC0)', attributionRequired: false, attribution: null },
    inspection: { verdict: 'pass', note: 'Procedurally generated by SBA — no external provenance.', contentSha256: generated.sha256 },
    adaptations: [],
    explanation: `${summary} Created a procedural asset instead: ${generated.templateLabel}.`,
    audit,
    startedAt,
    finishedAt: new Date().toISOString(),
  };

  // Procedural outputs are ours (CC0) — safe to persist immediately when asked.
  if (storageConfigured() && request.persist !== 'none') {
    const stored = await storePermanent({
      buffer: Buffer.from(generated.svg, 'utf8'),
      mimeType: 'image/svg+xml',
      name: `${request.subject} (procedural ${generated.templateId})`,
      description: `Procedurally generated ${generated.templateLabel} for subject "${request.subject}".`,
      subject: request.subject.slice(0, 80) || 'General',
      category: request.kinds[0] === 'background' ? 'background' : 'object',
      assetType: 'svg',
      keywords: request.keywords,
      source: 'procedural',
      creator: 'SBA Procedural Library',
      license: 'SBA Original (CC0)',
      inspection: { verdict: 'pass', procedural: true, templateId: generated.templateId, seed: generated.seedHex },
      tier: 'procedural',
      generationParams: { templateId: generated.templateId, seedHex: generated.seedHex, width: generated.width, height: generated.height },
    });
    result.storage = {
      tier: stored.stored ? 'D→C' : null,
      mode: 'permanent-library',
      stored: stored.stored, reused: stored.reused || false,
      assetId: stored.asset?.id || null,
      url: stored.asset?.public_url || null,
      reason: stored.stored ? undefined : stored.reason,
    };
    if (stored.stored) result.asset.url = stored.asset.public_url;
    audit.steps.push('stored-procedural');
  } else {
    result.storage = { tier: null, mode: 'generated-in-memory', stored: false, reason: storageConfigured() ? 'persist disabled for this request' : 'supabase-not-configured' };
  }
  return result;
}

/** Explicit no-match result — engines get a clear, structured refusal. */
function noMatch(request, startedAt, audit, reason, decisions = null) {
  return {
    ok: true,
    decision: 'no-match',
    serviceVersion: SERVICE_VERSION,
    request: { subject: request.subject, kinds: request.kinds, targetEngine: request.targetEngine },
    asset: null,
    explanation: reason,
    fallback: 'text',
    visionAvailable: visionAvailable(),
    storageConfigured: storageConfigured(),
    decisions: decisions
      ? decisions.slice(0, 6).map((d) => ({
          provider: d.candidate.provider,
          title: d.candidate.title,
          decision: d.decision,
          licenseStatus: d.licenseCheck.status,
          score: d.score,
          explanation: d.explanation?.slice(0, 300),
        }))
      : [],
    audit,
    startedAt,
    finishedAt: new Date().toISOString(),
  };
}

export { fetchCandidateBytes };
