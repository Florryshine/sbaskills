import { NextResponse } from 'next/server';
import { discoverVisual } from '@/lib/visual-intelligence/discover';
import { recordUsage } from '@/lib/visual-intelligence/storage';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Shared visual discovery service for the video engines (whiteboard,
 * stickman, cartoon, notebook, music learning, visual learning) and for the
 * local renderer workers.
 *
 * AUTH (fail closed):
 *   - Same-origin admin session (cookie) → allowed.
 *   - Service callers send `Authorization: Bearer <VISUAL_INTELLIGENCE_API_KEY>`
 *     (preferred) or `Bearer <CRON_SECRET>` (worker boxes that already have it).
 *   - Everyone else → 401/403. No anonymous access.
 *
 * CONTRACT (engines call this OPTIONALY):
 *   POST { subject, query?, sceneDescription?, kinds?, kind?, style?, format?,
 *          transparent?, scientificAccuracy?, animated?, license?,
 *          minWidth?, minHeight?, keywords?, providerAllow?, providerDeny?,
 *          targetEngine?, renderJobRef?, persist?('ephemeral'|'none'),
 *          allowCreate?, maxCandidates? }
 *   → 200 ALWAYS (even on internal failure) with a structured result:
 *     { ok, decision: 'use'|'adapt'|'created'|'no-match', asset, license,
 *       storage, adaptations, explanation, fallback? }
 *
 * Engines must treat this as best-effort: on !ok or decision==='no-match'
 * they continue with their existing pipeline (text fallback etc.).
 */
export async function POST(request) {
  // 1. Service-token auth (workers / engines on other boxes).
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const serviceKey = process.env.VISUAL_INTELLIGENCE_API_KEY || process.env.CRON_SECRET;
  const tokenValid = Boolean(serviceKey) && token.length > 0 && token === serviceKey;

  // 2. Admin session auth (in-app engines / admin tooling).
  let adminAllowed = false;
  if (!tokenValid) {
    try {
      const { createServerClient } = await import('@/lib/supabase-server');
      const supabase = createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        adminAllowed = profile?.role === 'admin';
      }
    } catch {
      adminAllowed = false;
    }
  }

  if (!tokenValid && !adminAllowed) {
    return NextResponse.json(
      { ok: false, decision: 'no-match', error: 'Unauthorized: supply Bearer VISUAL_INTELLIGENCE_API_KEY (or an admin session).' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    // Fail-safe defaults for engines: no permanent writes from this route.
    const result = await discoverVisual(
      { ...body, persist: body.persist === 'none' ? 'none' : 'ephemeral' },
      { useCache: body.useCache !== false, wantVision: body.wantVision !== false }
    );
    // Record reuse when the engine confirms consumption of a library asset.
    if (result.decision === 'use' && result.reuse === 'library' && body.markUsed && result.asset?.id) {
      await recordUsage(result.asset.id);
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Contract: never throw at engines.
    return NextResponse.json({
      ok: false,
      decision: 'no-match',
      error: error?.message || 'discovery failed',
      explanation: 'Visual discovery failed internally; continue with your existing pipeline.',
      fallback: 'text',
    }, { status: 200 });
  }
}

/** Lightweight readiness probe for worker boxes. */
export async function GET() {
  const serviceKey = process.env.VISUAL_INTELLIGENCE_API_KEY || process.env.CRON_SECRET;
  return NextResponse.json({
    service: 'sba-visual-intelligence',
    version: 1,
    auth: serviceKey ? 'bearer-token-configured' : 'admin-session-only',
    workflow: 'FETCH → INSPECT → DECIDE → USE/ADAPT/CREATE → STORE IF WORTH KEEPING',
  });
}
