// app/api/asset-images/[id]/host/route.js
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { downloadImageBuffer } from '@/lib/image-search';

const BUCKET = 'asset-images';

export async function POST(request, { params }) {
  const { id } = params;

  try {
    const supabase = createAdminClient();

    const { data: image, error: fetchError } = await supabase
      .from('asset_images')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Already hosted — nothing to do, just return it
    if (image.hosted) {
      return NextResponse.json({ success: true, image });
    }

    const buffer = await downloadImageBuffer(image.url);
    const ext = image.url.split('.').pop().split('?')[0].slice(0, 4) || 'jpg';
    const path = `${image.knowledge_asset_id}/${image.source}-${id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    const { data: updated, error: updateError } = await supabase
      .from('asset_images')
      .update({ url: urlData.publicUrl, storage_path: path, hosted: true })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, image: updated });
  } catch (error) {
    console.error('❌ Image hosting error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
