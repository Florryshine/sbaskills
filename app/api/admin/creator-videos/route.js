import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const BUCKET = 'lesson-videos';
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function clean(value, max = 160) {
  return String(value || '').trim().slice(0, max);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body?.action;
    const admin = createAdminClient();

    if (action === 'prepare') {
      const title = clean(body.title, 160) || 'SBA Creator Video';
      const caption = clean(body.caption, 30000);
      const mimeType = clean(body.mimeType, 100).toLowerCase();
      if (!VIDEO_TYPES.has(mimeType)) {
        return NextResponse.json({ error: 'Unsupported video format. Export MP4 or WebM.' }, { status: 400 });
      }

      const extension = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/quicktime' ? 'mov' : 'webm';
      const source = body.source === 'dance-content-studio' ? 'dance-content-studio' : 'overlay-video-studio';
      const topic = clean(body.topic, 160) || title;
      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};

      const { data: knowledgeAsset, error: knowledgeError } = await admin
        .from('knowledge_assets')
        .insert({
          keyword: topic,
          topic_type: 'creator_video',
          subject: 'General',
          summary: caption || title,
          status: 'active',
          source,
        })
        .select('id')
        .single();
      if (knowledgeError) throw knowledgeError;

      const { data: contentAsset, error: contentError } = await admin
        .from('content_assets')
        .insert({
          knowledge_asset_id: knowledgeAsset.id,
          asset_type: 'creator_video',
          platform: null,
          format: 'video',
          title,
          body: caption,
          status: 'draft',
          generated_by: source,
          metadata: { ...metadata, caption, creatorStudio: source, sourceFileMimeType: mimeType },
        })
        .select('id')
        .single();
      if (contentError) throw contentError;

      const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'sba-video';
      const path = `${knowledgeAsset.id}/${Date.now()}-${safeTitle}.${extension}`;
      const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
      if (signError || !signed?.token) throw new Error(signError?.message || 'Could not prepare video upload.');

      return NextResponse.json({
        success: true,
        bucket: BUCKET,
        path,
        token: signed.token,
        contentAssetId: contentAsset.id,
        mimeType,
      });
    }

    if (action === 'complete') {
      const contentAssetId = clean(body.contentAssetId, 80);
      const path = clean(body.path, 500);
      const title = clean(body.title, 160) || 'SBA Creator Video';
      const mimeType = clean(body.mimeType, 100).toLowerCase();
      const fileSizeBytes = Number(body.fileSizeBytes) || null;
      const durationSeconds = Number(body.durationSeconds) || null;
      const metadata = body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? body.metadata : {};

      if (!contentAssetId || !path || !VIDEO_TYPES.has(mimeType)) {
        return NextResponse.json({ error: 'A valid content asset, uploaded path and video format are required.' }, { status: 400 });
      }

      const { data: asset, error: assetError } = await admin
        .from('content_assets')
        .select('id, knowledge_asset_id, metadata')
        .eq('id', contentAssetId)
        .single();
      if (assetError || !asset) return NextResponse.json({ error: 'Creator video draft not found.' }, { status: 404 });
      if (!path.startsWith(`${asset.knowledge_asset_id}/`)) {
        return NextResponse.json({ error: 'Uploaded file path does not match this creator video.' }, { status: 400 });
      }

      const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
      const videoUrl = publicData.publicUrl;
      const mergedMetadata = {
        ...(asset.metadata || {}),
        ...metadata,
        caption: clean(body.caption, 30000),
        video_url: videoUrl,
        video_storage_path: path,
        mimeType,
        durationSeconds,
        rendered_at: new Date().toISOString(),
      };

      const { error: updateError } = await admin.from('content_assets').update({
        title,
        body: mergedMetadata.caption || '',
        metadata: mergedMetadata,
        format: 'video',
        status: 'draft',
      }).eq('id', contentAssetId);
      if (updateError) throw updateError;

      const mediaPayload = {
        content_asset_id: contentAssetId,
        media_type: 'video',
        role: 'primary',
        position: 0,
        url: videoUrl,
        storage_path: path,
        mime_type: mimeType,
        file_size_bytes: fileSizeBytes,
        duration_seconds: durationSeconds,
        source: 'render',
        alt_text: title,
      };
      const { data: existingMedia, error: lookupError } = await admin.from('media_files')
        .select('id').eq('content_asset_id', contentAssetId).eq('media_type', 'video').eq('role', 'primary').maybeSingle();
      if (lookupError) throw lookupError;

      if (existingMedia) {
        const { error } = await admin.from('media_files').update(mediaPayload).eq('id', existingMedia.id);
        if (error) throw error;
      } else {
        const { error } = await admin.from('media_files').insert(mediaPayload);
        if (error) throw error;
      }

      return NextResponse.json({ success: true, videoUrl, contentAssetId });
    }

    return NextResponse.json({ error: 'Unknown creator-video action.' }, { status: 400 });
  } catch (error) {
    console.error('Creator video save failed:', error);
    return NextResponse.json({ error: error.message || 'Could not save creator video.' }, { status: 500 });
  }
}
