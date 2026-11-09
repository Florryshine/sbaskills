import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getOrGenerateComponent, listAssetComponents } from '@/lib/ka-package';

export const runtime = 'nodejs';
const ALLOWED = ['master_script','short_script','carousel_slides','caption_base','seo_meta','mcq_set','visual_instructions'];

async function requireAdmin() {
  const authClient = createServerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: profile, error } = await authClient.from('profiles').select('role').eq('id', user.id).single();
  if (error || profile?.role !== 'admin') return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export async function GET(request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const assetId = new URL(request.url).searchParams.get('assetId');
    if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    return NextResponse.json(await listAssetComponents(assetId));
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Could not load package' }, {
      status: error.message === 'Knowledge Asset not found' ? 404 : 500,
    });
  }
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const assetId = body && body.assetId;
    const types = body && body.componentTypes;
    if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    if (!Array.isArray(types) || !types.length || types.length > ALLOWED.length || types.some((type) => !ALLOWED.includes(type))) {
      return NextResponse.json({ error: 'Select valid component types' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: asset, error } = await admin.from('knowledge_assets').select('id').eq('id', assetId).single();
    if (error || !asset) return NextResponse.json({ error: 'Knowledge Asset not found' }, { status: 404 });

    // Sequential generation avoids launching seven simultaneous paid LLM calls.
    const results = [];
    for (const type of [...new Set(types)]) {
      try {
        const result = await getOrGenerateComponent(assetId, type, { force: Boolean(body.force), createdBy: auth.user.id });
        results.push({ componentType: type, status: result.component.status, reused: result.reused });
      } catch (error) {
        results.push({ componentType: type, status: 'failed', error: error.message || 'Generation failed' });
      }
    }
    return NextResponse.json({ success: results.every((item) => item.status === 'ready'), results });
  } catch (error) {
    console.error('KA package generation error:', error);
    return NextResponse.json({ error: error.message || 'Package generation failed' }, { status: 500 });
  }
}
