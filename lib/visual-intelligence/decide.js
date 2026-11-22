// lib/visual-intelligence/decide.js
//
// DECIDE stage — turn inspection verdicts into an explained action:
//
//   use      → excellent match: hard rules pass, subject confirmed, quality ok
//   adapt    → right subject, needs rework (crop, recolour, background removal,
//              resize); returns concrete adaptation instructions
//   create   → nothing external qualifies; generate procedurally (tier D)
//   no-match → nothing usable; caller falls back to text/its own pipeline
//
// Every decision carries the WHY (score breakdown + reasons), so the admin UI
// and engine logs can always explain a selection or rejection.

import { evaluateLicense, buildAttribution } from './license-policy.js';

export const DEFAULT_THRESHOLDS = {
  useSubjectMatch: 80,      // vision-confirmed subject score for a direct "use"
  adaptSubjectMatch: 60,    // below this the subject itself is wrong → discard
  minResolution: 480,       // enforced in inspect; mirrored here for clarity
};

/**
 * Decide for ONE inspected candidate.
 * inspected: { candidate, inspection, bytes?, mimeType? }
 * request: original discovery request (license opts, thresholds overrides)
 */
export function decideCandidate(inspected, request = {}) {
  const { candidate, inspection } = inspected;
  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(request.thresholds || {}),
  };
  const licenseCheck = evaluateLicense(candidate.license, {
    allowNonCommercial: Boolean(request.allowNonCommercial),
    allowNoDerivs: Boolean(request.allowNoDerivs),
  });

  const score = { subject: null, quality: 0, license: 0, transparency: 0, resolution: 0 };
  const reasons = [];
  const adaptations = [];

  // License is a hard gate.
  if (licenseCheck.status === 'rejected') {
    return {
      decision: 'discard', candidate, inspection, licenseCheck, score, adaptations,
      bytes: inspected.bytes, mimeType: inspected.mimeType,
      explanation: `License rejected: ${licenseCheck.reasons.join(' ')}`,
    };
  }
  score.license = licenseCheck.status === 'allowed' ? (licenseCheck.rule?.attribution === 'required' ? 8 : 10) : 4;

  // Format / inspection failures are hard gates.
  if (inspection.verdict === 'fail') {
    return {
      decision: 'discard', candidate, inspection, licenseCheck, score, adaptations,
      bytes: inspected.bytes, mimeType: inspected.mimeType,
      explanation: `Inspection failed: ${inspection.reasons.join(' ') || 'unusable file'}`,
    };
  }

  // Subject match
  const vision = inspection.vision;
  const subjectMatch = vision?.available ? Number(vision.subjectMatch) : null;
  score.subject = subjectMatch;
  if (subjectMatch !== null && subjectMatch < thresholds.adaptSubjectMatch) {
    return {
      decision: 'discard', candidate, inspection, licenseCheck, score, adaptations,
      bytes: inspected.bytes, mimeType: inspected.mimeType,
      explanation: `Vision check says this does not show the requested subject (match ${subjectMatch}/100): ${vision.notes || 'no notes'}`,
    };
  }

  // Quality signals → adapt notes
  const img = inspection.checks?.image;
  if (img) {
    if (img.width >= 1200) score.resolution += 6;
    else if (img.width >= 800) score.resolution += 4;
    else score.resolution += 2;
    if (request.transparent && img.format !== 'svg' && !img.usesTransparency) {
      adaptations.push('Remove/replace the background (no real alpha in the source raster).');
    } else if (img.usesTransparency || img.format === 'svg') {
      score.transparency += 5;
    }
    if (img.width / (img.height || 1) < 0.5 || img.width / (img.height || 1) > 2.5) {
      adaptations.push('Extreme aspect ratio — crop or pad before use in the scene.');
    }
  }
  if (inspection.checks?.video) adaptations.push('Trim and normalize the video to the timeline format at render time.');
  if (inspection.checks?.model3d) adaptations.push('Convert/optimise the 3D payload (gltf → engine format) before use.');

  if (vision?.available) {
    if (vision.watermark) adaptations.push('Crop or inpaint the watermark before use.');
    if (vision.scientificAccuracy?.verdict === 'concern') adaptations.push(`Verify the scientific detail flagged by review: ${vision.scientificAccuracy.note || 'accuracy concern'}`);
    if (vision.composition === 'cluttered') adaptations.push('Composition is cluttered — consider a tighter crop.');
    score.quality += (vision.scientificAccuracy?.verdict === 'ok' ? 4 : 2);
  }

  // Uncertain subject (no vision) → can only ever be an uncertain candidate.
  const subjectConfirmed = subjectMatch !== null && subjectMatch >= thresholds.useSubjectMatch;
  const subjectAdaptable = subjectMatch !== null && subjectMatch >= thresholds.adaptSubjectMatch;
  const licenseUncertain = licenseCheck.status === 'unknown';
  const blockingAdaptations = adaptations.some((a) => /watermark|background removal|Verify the scientific/i.test(a));

  let decision;
  if (subjectConfirmed && !licenseUncertain && adaptations.length === 0) decision = 'use';
  else if (subjectConfirmed && !licenseUncertain && adaptations.length > 0 && !blockingAdaptations) decision = 'adapt';
  else if (subjectConfirmed && blockingAdaptations) decision = 'adapt';
  else if (subjectAdaptable) decision = 'adapt';
  else if (licenseUncertain) decision = 'adapt'; // subject may be fine; license needs admin confirmation
  else decision = 'uncertain';

  if (decision === 'use') reasons.push('Subject visually confirmed, license passes policy, resolution and format checks passed.');
  if (decision === 'adapt') reasons.push(adaptations.length ? `Usable after adaptation: ${adaptations.join(' ')}` : 'Usable after manual/admin confirmation.');
  if (licenseUncertain) reasons.push('License is not machine-verifiable — requires admin approval before permanent storage.');
  if (subjectMatch === null) reasons.push('Subject accuracy could not be visually confirmed (no vision model) — treat as uncertain.');

  const attribution = buildAttribution({
    creator: candidate.creator, source: candidate.provider,
    license: licenseCheck.license, pageUrl: candidate.pageUrl,
  });

  const totalScore = (score.subject ?? 0) + score.quality + score.license + score.transparency + score.resolution;
  return {
    decision, candidate, inspection, licenseCheck, score: { ...score, total: totalScore },
    adaptations, reasons, attribution,
    bytes: inspected.bytes, mimeType: inspected.mimeType,
    explanation: reasons.join(' '),
  };
}

/** Rank + decide a whole inspected batch. Returns sorted decisions. */
export function decideBatch(inspectedList, request = {}) {
  const decisions = inspectedList.map((item) => decideCandidate(item, request));
  const order = { use: 0, adapt: 1, uncertain: 2, discard: 3 };
  decisions.sort((a, b) => (order[a.decision] - order[b.decision]) || (b.score.total - a.score.total));
  return decisions;
}

/** Aggregate the batch into one orchestrator-level outcome. */
export function aggregateDecision(decisions, request = {}) {
  const best = decisions.find((d) => d.decision === 'use')
    || decisions.find((d) => d.decision === 'adapt')
    || null;
  const discards = decisions.filter((d) => d.decision === 'discard');
  const uncertain = decisions.filter((d) => d.decision === 'uncertain');

  if (best) {
    return {
      decision: best.decision,
      selected: best,
      rejected: discards.length + uncertain.length,
      summary: best.decision === 'use'
        ? `Selected "${best.candidate.title || best.candidate.providerAssetId}" from ${best.candidate.provider} — ${best.explanation}`
        : `Best candidate needs adaptation: ${best.explanation}`,
    };
  }

  const canCreate = request.allowCreate !== false; // engines opt out explicitly
  if (canCreate) {
    return {
      decision: 'create',
      selected: null,
      rejected: discards.length + uncertain.length,
      summary: `No external asset passed inspection (${discards.length} rejected, ${uncertain.length} uncertain); procedural generation is available and enabled.`,
    };
  }
  return {
    decision: 'no-match',
    selected: null,
    rejected: discards.length + uncertain.length,
    summary: `No usable external asset and procedural generation disabled. ${discards.length} rejected, ${uncertain.length} uncertain. Fallback: text.`,
    fallback: 'text',
  };
}
