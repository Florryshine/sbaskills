import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { discoverVisual } from '@/lib/visual-intelligence/discover';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Admin external discovery: FETCH → INSPECT → DECIDE for any subject.
 * Returns every candidate decision (use / adapt / discard / created /
 * no-match) with license status and explanations so the admin can approve,
 * adapt or reject from the UI.
 */
export async function POST(request) {
  const { response } = await requireAdminApi();
  if (response) return response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await discoverVisual(body, { useCache: body.useCache !== false, wantVision: body.wantVision !== false });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, decision: 'no-match', error: error?.message || 'Discovery failed.' },
      { status: 200 } // structured failure, never a thrown 500 — matches service contract
    );
  }
}
