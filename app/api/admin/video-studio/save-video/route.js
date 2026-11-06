import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('video');
    const contentAssetId = String(form.get('contentAssetId') || '');
    const title = String(form.get('title') || 'SBA Video').slice(0, 160);
    const metadataRaw = String(form.get('metadata') || '{}');
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Video file is required.' }, { status: 400 });
    if (!contentAssetId) return NextResponse.json({ error: 'Load a saved Knowledge Asset script before saving the rendered video.' }, { status: 400 });
    if (file.size > 200 * 1024 * 1024) return NextResponse.json({ error: 'Video exceeds the 200MB upload limit.' }, { status: 400 });

    const admin = createAdminClient();
    const { data: asset, error: assetError } = await admin.from('content_assets').select('id, knowledge_asset_id').eq('id', contentAssetId).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Saved content draft not found.' }, { status: 404 });

    let metadata = {};
    try { metadata = JSON.parse(metadataRaw); } catch { return NextResponse.json({ error: 'Video metadata is invalid.' }, { status: 400 }); }
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'sba-video';
    const path = `${asset.knowledge_asset_id}/${Date.now()}-${safeTitle}.mp4`;
    const bucket = 'lesson-videos';
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, buffer, {
      contentType: 'video/mp4', upsert: true, cacheControl: '31536000',
    });
    if (uploadError) throw new Error(`Video upload failed: ${uploadError.message}`);
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(path);
    const videoUrl = urlData.publicUrl;

    const { error: updateError } = await admin.from('content_assets').update({
      title,
      body: String(metadata.body || '').slice(0, 30000),
      metadata: { ...(metadata || {}), video_url: videoUrl, video_storage_path: path, rendered_at: new Date().toISOString() },
      format: 'video',
      status: 'draft',
    }).eq('id', contentAssetId);
    if (updateError) throw updateError;

    await admin.from('media_files').delete().eq('content_asset_id', contentAssetId).eq('media_type', 'video').eq('role', 'primary');

    const { data: media, error: mediaError } = await admin.from('media_files').insert({
      content_asset_id: contentAssetId,
      media_type: 'video',
      role: 'primary',
      position: 0,
      url: videoUrl,
      storage_path: path,
      mime_type: 'video/mp4',
      file_size_bytes: file.size,
      duration_seconds: Number(metadata.durationSeconds) || null,
      source: 'render',
      alt_text: title,
    }).select().single();
    if (mediaError) throw mediaError;
    return NextResponse.json({ success: true, videoUrl, mediaFileId: media.id, contentAssetId });
  } catch (error) {
    console.error('Video Studio save failed:', error);
    return NextResponse.json({ error: error.message || 'Could not save the video.' }, { status: 500 });
  }
}
