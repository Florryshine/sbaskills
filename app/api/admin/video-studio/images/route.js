import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { searchWikimediaMulti, searchPexelsMulti, searchPixabayMulti } from '@/lib/image-search';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get('q') || '').trim().slice(0, 140);
    if (query.length < 2) return NextResponse.json({ error: 'Enter at least 2 characters.' }, { status: 400 });
    const [wikimedia, pexels, pixabay] = await Promise.all([
      searchWikimediaMulti(query, 8), searchPexelsMulti(query, 4), searchPixabayMulti(query, 4),
    ]);
    return NextResponse.json({ images: [...wikimedia, ...pexels, ...pixabay].filter(x => x.url).slice(0, 12) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Image search failed.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
    if (!String(file.type || '').startsWith('image/')) return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 400 });
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = 'video-studio/uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from('lesson-loops').upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type, upsert: false, cacheControl: '31536000',
    });
    if (error) throw new Error('Image upload failed: ' + error.message);
    const url = supabase.storage.from('lesson-loops').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ image: { url, source: 'upload', sourceUrl: null, photographer: 'Uploaded by user', license: 'User-provided image' } });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Image upload failed.' }, { status: 500 });
  }
}