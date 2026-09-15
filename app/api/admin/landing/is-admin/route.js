import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';

// Lightweight, client-callable check used by public pages to decide
// whether to render admin-only controls (e.g. the inline screenshot
// uploader on the JAMB playbook landing page). Never leaks anything
// beyond a boolean.
export async function GET() {
  const auth = await requireLandingAdmin();
  return NextResponse.json({ isAdmin: !!auth.ok });
}
