// app/api/content-factory/generate/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { runContentFactory } from '@/lib/content-factory';

export async function POST(request) {
  // This route uses privileged server-side generation, so require a real
  // signed-in admin instead of relying on page middleware (which excludes /api).
  const authClient = createRouteHandlerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await authClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  }

  try {
    const { knowledgeAssetId, platforms, voiceMode, founderContext } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }
    if (platforms !== undefined && (!Array.isArray(platforms) || platforms.some((p) => typeof p !== 'string'))) {
      return NextResponse.json({ error: 'platforms must be an array of platform names' }, { status: 400 });
    }
    const options = {};
    if (platforms?.includes('founder')) {
      options.founder = { voiceMode, founderContext };
    }
    const results = await runContentFactory(knowledgeAssetId, platforms, options);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Content factory generate error:', error);
    return NextResponse.json({ error: error.message || 'Content generation failed' }, { status: 500 });
  }
}
