import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { contentAssetId, path, title, metadata = {}, fileSizeBytes } = await request.json();
    if (!contentAssetId || !path) return NextResponse.json({ error: 'Content draft and uploaded file path are required.' }, { status: 400 });
    const admin = createAdminClient();
    const { data: asset, error: assetError } = await admin.from('content_assets').select('id, knowledge_asset_id').eq('id', contentAssetId).single();
    if (assetError || !asset) return NextResponse.json({ error: 'Saved content draft not found.' }, { status: 404 });
    if (!String(path).startsWith(`${asset.knowledge_asset_id}/`) || !String(path).endsWith('.mp4')) {
      return NextResponse.json({ error: 'Uploaded file path does not match this Knowledge Asset.' }, { status: 400 });
    }
    const { data: publicData } = admin.storage.from('lesson-videos').getPublicUrl(path);
    const videoUrl = publicData.publicUrl;
    const safeMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
    const finalTitle = String(title || 'SBA Video').slice(0, 160);
    const { error: updateError } = await admin.from('content_assets').update({
      title: finalTitle,
      body: String(safeMetadata.body || '').slice(0, 30000),
      metadata: { ...safeMetadata, video_url: videoUrl, video_storage_path: path, rendered_at: new Date().toISOString() },
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
      file_size_bytes: Number(fileSizeBytes) || null,
      duration_seconds: Number(safeMetadata.durationSeconds) || null,
      source: 'render',
      alt_text: finalTitle,
    }).select().single();
    if (mediaError) throw mediaError;
    return NextResponse.json({ success: true, videoUrl, mediaFileId: media.id, contentAssetId });
  } catch (error) {
    console.error('Video Studio media attach failed:', error);
    return NextResponse.json({ error: error.message || 'Could not attach the rendered video to Social Engine.' }, { status: 500 });
  }
}
