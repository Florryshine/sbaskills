import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { searchWikimediaMulti, searchPexelsMulti, searchPixabayMulti, downloadImageBuffer } from '@/lib/image-search';

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
    const contentTypeFromUrl = (url) => {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith('.png')) return ['png', 'image/png'];
      if (pathname.endsWith('.webp')) return ['webp', 'image/webp'];
      if (pathname.endsWith('.gif')) return ['gif', 'image/gif'];
      return ['jpg', 'image/jpeg'];
    };
    const contentTypeFromBytes = (buffer) => {
      if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['png','image/png'];
      if (buffer.subarray(0, 3).equals(Buffer.from([255,216,255]))) return ['jpg','image/jpeg'];
      if (buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') return ['webp','image/webp'];
      if (buffer.toString('ascii',0,6)==='GIF87a' || buffer.toString('ascii',0,6)==='GIF89a') return ['gif','image/gif'];
      return null;
    };
    const contentType = request.headers.get('content-type') || '';
    let buffer, ext, mime, source, sourceUrl, photographer, license;
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const remote = new URL(String(body.url || ''));
      const allowed = ['upload.wikimedia.org','images.pexels.com','pixabay.com','cdn.pixabay.com'];
      if (remote.protocol !== 'https:' || !allowed.some(host => remote.hostname === host || remote.hostname.endsWith('.' + host))) {
        return NextResponse.json({ error: 'This image source is not supported.' }, { status: 400 });
      }
      buffer = await downloadImageBuffer(remote.toString());
      const detected = contentTypeFromBytes(buffer);
      if (!detected) return NextResponse.json({ error: 'The selected file is not a supported image.' }, { status: 415 });
      [ext,mime] = detected;
      source = String(body.source || 'image search').slice(0,40);
      sourceUrl = String(body.sourceUrl || '').slice(0,1000) || null;
      photographer = String(body.photographer || 'Unknown').slice(0,160);
      license = String(body.license || 'Check source page').slice(0,240);
    } else {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
      if (!String(file.type || '').startsWith('image/')) return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 });
      if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 400 });
      buffer = Buffer.from(await file.arrayBuffer());
      const detected = contentTypeFromBytes(buffer);
      if (!detected) return NextResponse.json({ error: 'The uploaded file is not a supported PNG, JPEG, WEBP or GIF image.' }, { status: 415 });
      [ext,mime] = detected;
      source = 'upload'; sourceUrl = null; photographer = 'Uploaded by user'; license = 'User-provided image';
    }
    if (buffer.length > 8 * 1024 * 1024) return NextResponse.json({ error: 'Image must be 8 MB or smaller.' }, { status: 413 });
    const path = 'video-studio/uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from('lesson-loops').upload(path, buffer, {
      contentType: mime, upsert: false, cacheControl: '31536000',
    });
    if (error) throw new Error('Image hosting failed: ' + error.message);
    const url = supabase.storage.from('lesson-loops').getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ image: { url, source, sourceUrl, photographer, license } });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Image upload failed.' }, { status: 500 });
  }
}