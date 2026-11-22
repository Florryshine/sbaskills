import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { requireAdminApi } from '@/lib/require-admin-api';
import { refetchSelected } from '@/lib/visual-intelligence/discover';
import { storePermanent, stageEphemeral } from '@/lib/visual-intelligence/storage';
import { evaluateLicense } from '@/lib/visual-intelligence/license-policy';
import { fetchCandidateBytes } from '@/lib/visual-intelligence/providers/index';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Approve & store a discovered candidate into the permanent library (tier C).
 *
 * Body: {
 *   request: { ...discoverRequest },          // same body as the discover call
 *   select:  { provider, providerAssetId },   // the candidate the admin approved
 *   name?, subject?, category?, keywords?, description?,
 *   licenseOverride?, approveUncertainLicense?
 * }
 *
 * License policy is a hard gate: rejected licenses can never be stored.
 * Unknown licenses require the admin to pass approveUncertainLicense:true
 * after manually verifying the source page.
 */
export async function POST(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const discoveryRequest = body.request || {};
    const selection = body.select || {};
    if (!discoveryRequest.subject && !discoveryRequest.query) {
      return NextResponse.json({ error: 'A subject or query is required.' }, { status: 400 });
    }
    if (!selection.provider || !selection.providerAssetId) {
      return NextResponse.json({ error: 'A provider selection (provider + providerAssetId) is required.' }, { status: 400 });
    }

    const refetch = await refetchSelected(discoveryRequest, selection);
    if (!refetch.ok) {
      return NextResponse.json({ error: refetch.error, candidates: refetch.decisions || [] }, { status: 409 });
    }
    const chosen = refetch.decision;
    const candidate = chosen.candidate;

    // License gate — hard rule.
    const licenseCheck = evaluateLicense(candidate.license, {
      allowNonCommercial: Boolean(discoveryRequest.allowNonCommercial),
      allowNoDerivs: Boolean(discoveryRequest.allowNoDerivs),
    });
    if (licenseCheck.status === 'rejected') {
      return NextResponse.json({
        error: `License policy blocks permanent storage: ${licenseCheck.reasons.join(' ')}`,
      }, { status: 403 });
    }
    if (licenseCheck.status === 'unknown' && !body.approveUncertainLicense) {
      return NextResponse.json({
        error: 'License could not be verified automatically. Confirm it on the source page, then resend with approveUncertainLicense: true.',
        license: candidate.license,
        pageUrl: candidate.pageUrl,
      }, { status: 422 });
    }

    // Fetch bytes for the chosen asset.
    const bytesRes = await fetchCandidateBytes(candidate);
    if (!bytesRes.ok) {
      return NextResponse.json({ error: bytesRes.error }, { status: 502 });
    }

    const licenseText = body.licenseOverride || candidate.license;
    const assetType = candidate.kind === 'svg' ? 'svg'
      : candidate.kind === 'video' ? 'video'
      : candidate.kind === '3d' ? '3d'
      : 'image';

    const stored = await storePermanent({
      buffer: bytesRes.buffer,
      mimeType: bytesRes.contentType || candidate.mimeType || 'image/jpeg',
      name: body.name || candidate.title || `${discoveryRequest.subject || discoveryRequest.query} (${candidate.provider})`,
      description: body.description || `Externally sourced via visual intelligence from ${candidate.provider}. ${discoveryRequest.sceneDescription || ''}`.trim(),
      subject: body.subject || discoveryRequest.subject || 'General',
      category: body.category || 'object',
      assetType,
      keywords: body.keywords || discoveryRequest.keywords || [],
      source: candidate.provider,
      sourceRef: candidate.providerAssetId,
      sourceUrl: candidate.pageUrl,
      creator: candidate.creator,
      license: licenseText,
      licenseUrl: candidate.meta?.licenseUrl || null,
      attributionRequired: chosen.licenseCheck.rule?.attribution === 'required',
      attribution: chosen.attribution,
      provider: candidate.provider,
      providerAssetId: candidate.providerAssetId,
      inspection: {
        approvedBy: user.id,
        approvedAt: new Date().toISOString(),
        licenseStatus: licenseCheck.status,
        sha256: createHash('sha256').update(bytesRes.buffer).digest('hex'),
        inspectionVerdict: chosen.inspection?.verdict || null,
        subjectMatch: chosen.inspection?.vision?.subjectMatch ?? null,
      },
      tier: 'library',
    });

    if (!stored.stored) {
      return NextResponse.json({ error: stored.reason }, { status: 500 });
    }
    return NextResponse.json(
      { asset: stored.asset, reused: stored.reused, license: licenseCheck },
      { status: stored.reused ? 200 : 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not save the asset.' }, { status: 500 });
  }
}

/**
 * Stage the chosen candidate as ephemeral (tier B) for preview or a render
 * without permanently storing it.
 */
export async function PUT(request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const discoveryRequest = body.request || {};
    const selection = body.select || {};
    if (!discoveryRequest.subject && !discoveryRequest.query) {
      return NextResponse.json({ error: 'A subject or query is required.' }, { status: 400 });
    }
    const refetch = await refetchSelected(
      { ...discoveryRequest, allowCreate: false },
      selection.provider ? selection : {}
    );
    if (!refetch.ok || !refetch.decision?.bytes) {
      return NextResponse.json(
        { error: refetch.error || 'No qualifying candidate with downloadable bytes for this request.', candidates: refetch.decisions || [] },
        { status: 409 }
      );
    }
    const chosen = refetch.decision;
    const staged = await stageEphemeral({
      buffer: chosen.bytes,
      mimeType: chosen.mimeType || chosen.candidate.mimeType,
      name: `${discoveryRequest.subject || discoveryRequest.query}-${chosen.candidate.providerAssetId}`,
      retainUntilSeconds: body.retainHours ? body.retainHours * 3600 : 24 * 3600,
      retainedFor: 'admin-preview',
      requestContext: { engine: 'admin', decision: chosen.decision },
    });
    return NextResponse.json({
      staged,
      decision: chosen.decision,
      license: chosen.licenseCheck,
      attribution: chosen.attribution,
      adaptations: chosen.adaptations,
      explanation: chosen.explanation,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not stage the asset.' }, { status: 500 });
  }
}
