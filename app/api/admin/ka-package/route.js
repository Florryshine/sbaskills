import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getOrGenerateComponent, listAssetComponents } from '@/lib/ka-package';

const ALLOWED = ['master_script','short_script','carousel_slides','caption_base','seo_meta','mcq_set','visual_instructions'];

export async function GET(request) {
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
  try {
    const body = await request.json();
    const assetId = body && body.assetId;
    const types = body && body.componentTypes;
    if (!assetId) return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
    if (!Array.isArray(types) || !types.length || types.some((type) => !ALLOWED.includes(type))) {
      return NextResponse.json({ error: 'Select valid component types' }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: asset, error } = await admin.from('knowledge_assets').select('id').eq('id', assetId).single();
    if (error || !asset) return NextResponse.json({ error: 'Knowledge Asset not found' }, { status: 404 });

    const results = await Promise.allSettled(types.map((type) =>
      getOrGenerateComponent(assetId, type, { force: Boolean(body.force) })
    ));
    return NextResponse.json({
      success: results.every((item) => item.status === 'fulfilled'),
      results: results.map((item, index) => item.status === 'fulfilled'
        ? { componentType: types[index], status: item.value.component.status, reused: item.value.reused }
        : { componentType: types[index], status: 'failed', error: item.reason && item.reason.message || 'Generation failed' }),
    });
  } catch (error) {
    console.error('KA package generation error:', error);
    return NextResponse.json({ error: error.message || 'Package generation failed' }, { status: 500 });
  }
}
