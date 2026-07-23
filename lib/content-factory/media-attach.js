// lib/content-factory/media-attach.js
//
// The missing link between the content-factory generators (text/JSON from
// the LLM) and the real, already-built carousel-engine and video-engine.
// Nothing in here re-implements rendering — it calls the existing engines
// and writes the results into media_files against a real content_asset_id.
//
// Called from lib/content-factory/index.js AFTER a content_assets row has
// been inserted (so we have a real id to attach media to).

import { createAdminClient } from '@/lib/supabase-admin';
import { renderCarouselSlides } from '@/lib/carousel-engine/render-canvas';
import { searchPexelsMulti, searchPixabayMulti, searchWikimediaMulti, downloadImageBuffer } from '@/lib/image-search';
import { createBrandedThumbnail, createFallbackThumbnail, IMAGE_PRESETS } from '@/lib/image-engine';

const CAROUSEL_BUCKET = 'carousel-slides';
const HERO_BUCKET = 'hero-images';

/**
 * Renders a carousel's slide images with @napi-rs/canvas (in-memory, no
 * subprocess/headless browser — see render-canvas.js), uploads each slide
 * to Supabase storage, and inserts one media_files row per slide
 * (role='carousel_slide', ordered by position) against the given
 * content_asset_id.
 *
 * @param {string} contentAssetId - the already-inserted content_assets row id
 * @param {{ title: string, summary?: string, slides: Array<{position:number, headline:string, body:string}>, platform?: string }} carouselInput
 */
export async function attachCarouselMedia(contentAssetId, carouselInput) {
  const supabase = createAdminClient();

  const slides = carouselInput.slides || [];
  if (slides.length === 0) {
    throw new Error('No slides provided for carousel');
  }

  // Renders entirely in-memory — no Marp CLI subprocess, no headless
  // Chromium, no temp files. See render-canvas.js for why: Marp CLI's
  // Puppeteer dependency can't run inside Vercel's serverless functions.
  // `platform` picks the visual style (dimensions/palette/layout) so each
  // platform's carousel looks distinct instead of all reusing Instagram's.
  const buffers = renderCarouselSlides(slides, carouselInput.platform || 'instagram');

  const mediaRows = [];

  for (let i = 0; i < buffers.length; i++) {
    const storagePath = `${contentAssetId}/slide-${i}.png`;

    const { error: uploadError } = await supabase.storage
      .from(CAROUSEL_BUCKET)
      .upload(storagePath, buffers[i], { contentType: 'image/png', upsert: true });

    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from(CAROUSEL_BUCKET).getPublicUrl(storagePath);

    mediaRows.push({
      content_asset_id: contentAssetId,
      media_type: 'image',
      role: 'carousel_slide',
      position: i,
      url: publicUrl.publicUrl,
      storage_path: storagePath,
      source: 'render',
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('media_files')
    .insert(mediaRows)
    .select();

  if (insertError) throw insertError;
  return inserted;
}

/**
 * Queues a video render job in video_scripts, linked to a content_asset_id.
 * Does NOT render anything itself — rendering is slow (TTS + stock lookups +
 * Remotion render) and doesn't belong inside a request/response cycle.
 * Either the standalone local-video-renderer/worker.js (patched in this same
 * update to write media_files on completion) or an in-process call to
 * lib/video-engine/render.js picks this row up.
 *
 * @param {string} contentAssetId
 * @param {{ title: string, format: 'short'|'long', segments: Array<{text:string, visual_cue?:string, stock_search?:string, durationSeconds?:number}> }} videoInput
 */
export async function queueVideoScript(contentAssetId, videoInput) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('video_scripts')
    .insert({
      content_asset_id: contentAssetId,
      title: videoInput.title,
      format: videoInput.format || 'short',
      script_segments: videoInput.segments || [],
      render_status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Finds a real stock photo (Pexels → Pixabay → Wikimedia, first source that
 * returns a downloadable candidate wins), brands it with the SBA overlay via
 * the existing lib/image-engine.js, uploads it to Supabase storage, and
 * inserts one media_files row (role='hero_image') against the given
 * content_asset_id. Used by platforms that pair a caption with a single
 * static image (Facebook, Telegram, LinkedIn, Pinterest, X) — the same slot
 * Instagram fills with a rendered carousel instead.
 *
 * If every provider misses (rare, but happens for very narrow/local search
 * terms), falls back to a photo-less branded graphic instead of failing the
 * whole content_assets row — same "never block the draft" philosophy as
 * attachCarouselMedia.
 *
 * @param {string} contentAssetId
 * @param {{ title: string, category?: string, searchQuery?: string, preset?: 'hero'|'og'|'square'|'pin' }} opts
 */
export async function attachHeroImage(contentAssetId, { title, category, searchQuery, preset = 'hero' }) {
  const supabase = createAdminClient();
  const query = searchQuery || title;
  const dims = IMAGE_PRESETS[preset] || IMAGE_PRESETS.hero;

  let photoBuffer = null;
  let providerUsed = null;

  for (const search of [searchPexelsMulti, searchPixabayMulti, searchWikimediaMulti]) {
    let candidates = [];
    try {
      candidates = await search(query, 3);
    } catch (err) {
      console.warn(`Hero image search failed (${search.name}):`, err.message);
      continue;
    }
    if (candidates.length === 0) continue;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    try {
      photoBuffer = await downloadImageBuffer(pick.url);
      providerUsed = pick.source;
      break;
    } catch (err) {
      console.warn(`Hero image download failed from ${pick.source}:`, err.message);
    }
  }

  const finalBuffer = photoBuffer
    ? await createBrandedThumbnail(photoBuffer, title, category, dims)
    : await createFallbackThumbnail(title, category, dims);

  const storagePath = `${contentAssetId}/hero.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(HERO_BUCKET)
    .upload(storagePath, finalBuffer, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data: publicUrl } = supabase.storage.from(HERO_BUCKET).getPublicUrl(storagePath);

  const { data: inserted, error: insertError } = await supabase
    .from('media_files')
    .insert({
      content_asset_id: contentAssetId,
      media_type: 'image',
      role: 'hero_image',
      position: 0,
      url: publicUrl.publicUrl,
      storage_path: storagePath,
      width: dims.width,
      height: dims.height,
      source: photoBuffer ? 'stock' : 'branded_fallback',
      alt_text: title,
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return { ...inserted, provider: providerUsed };
}
