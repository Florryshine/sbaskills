import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { listProviders } from '@/lib/visual-intelligence/providers/index';
import { visionAvailable } from '@/lib/visual-intelligence/inspect';
import { storageConfigured } from '@/lib/visual-intelligence/storage';
import { listProceduralTemplates } from '@/lib/visual-intelligence/procedural';

export const runtime = 'nodejs';

/** Provider configuration status for the admin panel. */
export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;
  return NextResponse.json({
    providers: listProviders(),
    vision: {
      available: visionAvailable(),
      credentials: ['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY']
        .map((env) => ({ env, configured: Boolean(process.env[env]) })),
      note: visionAvailable()
        ? 'Vision inspection active — subject match and scientific accuracy are visually verified.'
        : 'No Gemini key configured: subject accuracy is reported as UNCERTAIN, never guessed.',
    },
    storage: {
      configured: storageConfigured(),
      credentials: [
        { env: 'NEXT_PUBLIC_SUPABASE_URL', configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
        { env: 'SUPABASE_SERVICE_ROLE_KEY', configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
      ],
    },
    proceduralTemplates: listProceduralTemplates(),
  });
}
