import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { contentAssetId, title } = await request.json();
    if (!contentAssetId) return NextResponse.json({ error: 'Saved content draft is required.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: asset, error } = await admin.from('content_assets').select('id, knowledge_asset_id').eq('id', contentAssetId).single();
    if (error || !asset) return NextResponse.json({ error: 'Saved content draft not found.' }, { status: 404 });
    const safeTitle = String(title || 'sba-video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'sba-video';
    const bucket = 'lesson-videos';
    const path = `${asset.knowledge_asset_id}/${Date.now()}-${safeTitle}.mp4`;
    const { data, error: signError } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
    if (signError || !data?.token) throw new Error(signError?.message || 'Could not prepare the video upload.');
    return NextResponse.json({ success: true, bucket, path, token: data.token });
  } catch (error) {
    console.error('Video upload preparation failed:', error);
    return NextResponse.json({ error: error.message || 'Could not prepare video upload.' }, { status: 500 });
  }
}
