import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  const authClient = createRouteHandlerClient();
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Please sign in before saving videos.' }, { status: 401 });

  let form;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Invalid upload request.' }, { status: 400 }); }
  const file = form.get('file');
  const { title, topic, script, durationSeconds, caption } = Object.fromEntries(
    ['title', 'topic', 'script', 'durationSeconds', 'caption'].map(key => [key, form.get(key) || ''])
  );
  if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Video file is required.' }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: 'The video file is empty.' }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Video exceeds the 50 MB upload limit. Record a shorter video and try again.' }, { status: 413 });
  const contentType = file.type || 'video/webm';
  if (!contentType.startsWith('video/')) return NextResponse.json({ error: 'Only video files can be uploaded.' }, { status: 400 });

  const supabase = createAdminClient();
  const assetTitle = String(title || 'SBA Bold Text Video').trim().slice(0, 180);
  const searchTerm = String(topic || title || '').trim();
  let knowledgeQuery = supabase.from('knowledge_assets').select('id, keyword').limit(1);
  if (searchTerm) knowledgeQuery = knowledgeQuery.ilike('keyword', '%' + searchTerm.slice(0, 100) + '%');
  const { data: knowledgeAsset, error: knowledgeError } = await knowledgeQuery.maybeSingle();
  if (knowledgeError || !knowledgeAsset) {
    return NextResponse.json({ error: 'No matching SBA knowledge topic was found. Enter a topic that matches an existing item in the SBA knowledge library.' }, { status: 400 });
  }

  const safeName = String(file.name || 'video.webm').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100);
  const storagePath = `bold-text-videos/${user.id}/${Date.now()}-${safeName}`;
  const { data: upload, error: uploadError } = await supabase.storage.from('quote-loops').upload(storagePath, file, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (uploadError || !upload) {
    return NextResponse.json({ error: uploadError?.message || 'Could not upload video to Supabase Storage.' }, { status: 500 });
  }
  const { data: publicData } = supabase.storage.from('quote-loops').getPublicUrl(upload.path);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) {
    await supabase.storage.from('quote-loops').remove([upload.path]);
    return NextResponse.json({ error: 'Video uploaded, but Supabase did not return a public URL.' }, { status: 500 });
  }

  const metadata = {
    source: 'bold_text_video_studio',
    storage_bucket: 'quote-loops',
    storage_path: upload.path,
    script: String(script || '').slice(0, 10000),
    duration_seconds: Number(durationSeconds) || null,
    caption: String(caption || '').slice(0, 5000),
    created_by: user.id,
  };
  const { data: asset, error: assetError } = await supabase.from('content_assets').insert({
    knowledge_asset_id: knowledgeAsset.id,
    format: 'video',
    title: assetTitle,
    body: String(caption || script || assetTitle).slice(0, 5000),
    asset_type: 'bold_text_video',
    platform: null,
    status: 'draft',
    generated_by: 'bold-text-video-studio',
    metadata,
  }).select('id,title').single();
  if (assetError || !asset) {
    await supabase.storage.from('quote-loops').remove([upload.path]);
    return NextResponse.json({ error: assetError?.message || 'Could not save video metadata to the content library.' }, { status: 500 });
  }

  const { error: mediaError } = await supabase.from('media_files').insert({
    content_asset_id: asset.id,
    media_type: 'video',
    role: 'primary',
    position: 0,
    url: videoUrl,
    storage_path: upload.path,
    source: 'supabase',
    alt_text: assetTitle,
    duration_seconds: Number(durationSeconds) || null,
    file_size_bytes: file.size,
    mime_type: contentType,
  });
  if (mediaError) {
    await supabase.from('content_assets').delete().eq('id', asset.id);
    await supabase.storage.from('quote-loops').remove([upload.path]);
    return NextResponse.json({ error: mediaError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, contentAssetId: asset.id, title: asset.title, videoUrl, storageBucket: 'quote-loops', storagePath: upload.path });
}
