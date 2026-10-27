import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request) {
  const authClient = createRouteHandlerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please sign in before saving videos.' }, { status: 401 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const { videoUrl, publicId, title, topic, script, durationSeconds, caption } = body || {};
  if (!videoUrl || !publicId) return NextResponse.json({ error: 'Cloudinary video URL and public ID are required.' }, { status: 400 });
  if (!/^https:\/\/res\.cloudinary\.com\//.test(videoUrl)) return NextResponse.json({ error: 'Invalid Cloudinary URL.' }, { status: 400 });
  const supabase = createAdminClient();
  const assetTitle = String(title || 'SBA Bold Text Video').trim().slice(0, 180);
  const searchTerm = String(topic || title || '').trim();
  let knowledgeQuery = supabase.from('knowledge_assets').select('id').limit(1);
  if (searchTerm) knowledgeQuery = knowledgeQuery.ilike('keyword', '%' + searchTerm.slice(0, 100) + '%');
  const { data: knowledgeAsset, error: knowledgeError } = await knowledgeQuery.maybeSingle();
  if (knowledgeError || !knowledgeAsset) return NextResponse.json({ error: 'Video uploaded to Cloudinary, but no matching SBA knowledge topic was found to attach it to. Use a topic that exists in the SBA knowledge library.' }, { status: 400 });
  const metadata = { source: 'bold_text_video_studio', cloudinary_public_id: publicId, script: String(script || '').slice(0, 10000), duration_seconds: Number(durationSeconds) || null, caption: String(caption || '').slice(0, 5000), created_by: user.id };
  const { data: asset, error: assetError } = await supabase.from('content_assets').insert({ knowledge_asset_id: knowledgeAsset.id, format: 'video', title: assetTitle, body: String(caption || script || assetTitle).slice(0, 5000), asset_type: 'bold_text_video', platform: null, status: 'approved', metadata }).select('id,title').single();
  if (assetError || !asset) return NextResponse.json({ error: assetError?.message || 'Could not save video to the content library.' }, { status: 500 });
  const { error: mediaError } = await supabase.from('media_files').insert({ content_asset_id: asset.id, media_type: 'video', role: 'primary', position: 0, url: videoUrl, source: 'cloudinary', alt_text: assetTitle, duration_seconds: Number(durationSeconds) || null });
  if (mediaError) { await supabase.from('content_assets').delete().eq('id', asset.id); return NextResponse.json({ error: mediaError.message }, { status: 500 }); }
  return NextResponse.json({ success: true, contentAssetId: asset.id, title: asset.title, videoUrl });
}
