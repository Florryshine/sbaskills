// app/api/admin/content-assets/[id]/carousel-background/route.js
//
// Re-skins an already-generated carousel's hook/CTA slides with a new
// background (solid color, curated gradient, curated pattern, or an
// uploaded image) WITHOUT touching the copy — the headline/body text for
// each slide is read back from content_assets.metadata.slides (written at
// generation time by the instagram/facebook generators) so this never
// calls the LLM again. Same "just re-render, don't regenerate" idea as the
// inline-edit feature, applied to the image side instead of the text side.
//
// Only carousels on the "bold" layout (Instagram, Facebook) actually
// support a custom background — see render-canvas.js for why LinkedIn and
// Telegram are intentionally left alone. Calling this on a non-carousel or
// editorial/plain-platform row returns a 400 rather than silently no-op'ing.
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { renderCarouselSlides } from '@/lib/carousel-engine/render-canvas';

const CAROUSEL_BUCKET = 'carousel-slides';
const BOLD_LAYOUT_PLATFORMS = ['instagram', 'facebook'];
// Vercel's serverless functions cap the request body at ~4.5MB by default
// (Hobby/Pro alike). Base64 inflates a file by ~33%, so we cap the raw
// image well below that — 3MB raw becomes ~4MB as base64, leaving headroom
// for the rest of the JSON payload.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export async function POST(request, { params }) {
  const { id } = params;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { background } = body || {};
  if (!background?.type) {
    return NextResponse.json({ error: 'background.type is required (solid | gradient | pattern | image)' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: asset, error: fetchError } = await supabase
    .from('content_assets')
    .select('id, platform, metadata')
    .eq('id', id)
    .single();
  if (fetchError || !asset) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  if (!BOLD_LAYOUT_PLATFORMS.includes(asset.platform)) {
    return NextResponse.json(
      { error: `Custom backgrounds are only supported on ${BOLD_LAYOUT_PLATFORMS.join('/')} carousels, not ${asset.platform}.` },
      { status: 400 }
    );
  }

  const slides = asset.metadata?.slides;
  if (!slides || slides.length === 0) {
    return NextResponse.json({ error: 'This draft has no carousel slides to re-skin.' }, { status: 400 });
  }

  // Build the renderer-facing background object. Presets pass straight
  // through; a custom image arrives as a data URL from the browser and gets
  // decoded to a Buffer here (renderCarouselSlides loads it into an Image
  // internally).
  let rendererBackground = { type: background.type, value: background.value };
  if (background.type === 'image') {
    const dataUrl = background.imageBase64 || '';
    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: 'imageBase64 must be a data URL (png/jpeg/webp)' }, { status: 400 });
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image too large — please use one under 8MB.' }, { status: 400 });
    }
    rendererBackground = { type: 'image', imageBuffer: buffer };
  }

  let buffers;
  try {
    buffers = await renderCarouselSlides(slides, asset.platform, rendererBackground);
  } catch (err) {
    console.error('Carousel background render error:', err);
    return NextResponse.json({ error: `Render failed: ${err.message}` }, { status: 500 });
  }

  // Re-upload each slide over its existing storage path (upsert), then
  // append a cache-busting query param to the URL we save back to
  // media_files — the storage path is unchanged so the old public URL would
  // otherwise be served stale from browser/CDN cache.
  const version = Date.now();
  const updatedRows = [];
  for (let i = 0; i < buffers.length; i++) {
    const storagePath = `${id}/slide-${i}.png`;
    const { error: uploadError } = await supabase.storage
      .from(CAROUSEL_BUCKET)
      .upload(storagePath, buffers[i], { contentType: 'image/png', upsert: true });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { data: publicUrl } = supabase.storage.from(CAROUSEL_BUCKET).getPublicUrl(storagePath);
    const versionedUrl = `${publicUrl.publicUrl}?v=${version}`;

    const { data: updated, error: updateError } = await supabase
      .from('media_files')
      .update({ url: versionedUrl })
      .eq('content_asset_id', id)
      .eq('role', 'carousel_slide')
      .eq('position', i)
      .select()
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    updatedRows.push(updated);
  }

  // Remember the chosen background so a future full regenerate could reuse
  // it (not read anywhere yet, but cheap to keep and avoids losing the
  // admin's choice silently).
  await supabase
    .from('content_assets')
    .update({ metadata: { ...asset.metadata, background: { type: background.type, value: background.value || null } } })
    .eq('id', id);

  return NextResponse.json({ success: true, media_files: updatedRows });
}
