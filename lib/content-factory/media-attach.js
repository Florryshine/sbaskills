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
import { readFile, unlink } from 'fs/promises';
import { generateCarouselMarkdown } from '@/lib/carousel-engine/generate';
import { renderCarousel } from '@/lib/carousel-engine/render';

const CAROUSEL_BUCKET = 'carousel-slides';

/**
 * Renders an Instagram (or any) carousel's slide images using the existing
 * Marp-based carousel-engine, uploads each slide to Supabase storage, and
 * inserts one media_files row per slide (role='carousel_slide', ordered by
 * position) against the given content_asset_id.
 *
 * @param {string} contentAssetId - the already-inserted content_assets row id
 * @param {{ title: string, summary?: string, slides: Array<{position:number, headline:string, body:string}> }} carouselInput
 */
export async function attachCarouselMedia(contentAssetId, carouselInput) {
  const supabase = createAdminClient();

  // carousel-engine/generate.js expects { title, summary, sections: [{heading, content}] }
  const asset = {
    title: carouselInput.title,
    summary: carouselInput.summary,
    sections: (carouselInput.slides || []).map((s) => ({
      heading: s.headline,
      content: s.body,
    })),
  };

  const markdown = generateCarouselMarkdown(asset);
  const { files } = await renderCarousel(markdown, 'png');

  if (!files || files.length === 0) {
    throw new Error('Carousel render produced no image files');
  }

  const mediaRows = [];

  for (let i = 0; i < files.length; i++) {
    const localPath = files[i];
    const buffer = await readFile(localPath);
    const storagePath = `${contentAssetId}/slide-${i}.png`;

    const { error: uploadError } = await supabase.storage
      .from(CAROUSEL_BUCKET)
      .upload(storagePath, buffer, { contentType: 'image/png', upsert: true });

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

    await unlink(localPath).catch(() => {});
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
