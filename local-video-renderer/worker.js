// ─── Local Video Render Worker ─────────────────────────────────────────
// Runs standalone on your laptop. Polls Supabase for pending video_scripts,
// renders them with Remotion, uploads the MP4, and marks them completed.
//
// PATCHED: on success, if the script row has a content_asset_id (set by
// lib/content-factory/media-attach.js -> queueVideoScript), this now also
// inserts a media_files row so the finished video shows up against the
// right draft in the review dashboard — closing the loop that was missing
// before. If content_asset_id is null (a script queued some other way),
// behavior is unchanged: video_scripts.video_url is still set.
//
// NOTE: worker.mjs in this same folder was an exact byte-for-byte duplicate
// of this file — delete it, don't maintain two copies of the same worker.
//
// Run with: node local-video-renderer/worker.js

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { synthesizeLessonNarration } from '../lib/video-engine/narration.js';
import { fetchStockImage, fetchStockVideo } from '../lib/image-engine.js';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// ─── Catch any unhandled errors early ────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('🔴 UNHANDLED REJECTION:', err);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('🔴 UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

const POLL_INTERVAL_MS = 30_000;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUBLIC_TEMP_AUDIO = path.join(PROJECT_ROOT, 'public', 'temp-audio');
const PUBLIC_TEMP_IMAGES = path.join(PROJECT_ROOT, 'public', 'temp-images');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'public', 'temp-video');

let cachedBundleLocation = null;
async function getBundleLocation() {
  if (cachedBundleLocation) return cachedBundleLocation;
  console.log('📦 Bundling Remotion project (first time only)...');
  cachedBundleLocation = await bundle({
    entryPoint: path.join(PROJECT_ROOT, 'remotion', 'index.js'),
  });
  return cachedBundleLocation;
}

async function uploadVideo(buffer, fileName) {
  const storagePath = `lesson-videos/${fileName}`;
  const { error } = await supabase.storage
    .from('lesson-videos')
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('lesson-videos').getPublicUrl(storagePath);
  return data.publicUrl;
}

// NEW: attach the finished video to its content_assets row, if it has one.
// Position 0, role 'primary' — matches how publish-engine.js reads media
// (ordered by position) for every other platform's publisher.
async function attachToContentAsset(contentAssetId, videoUrl) {
  if (!contentAssetId) return;
  const { error } = await supabase.from('media_files').insert({
    content_asset_id: contentAssetId,
    media_type: 'video',
    role: 'primary',
    position: 0,
    url: videoUrl,
    source: 'render',
  });
  if (error) {
    // Don't fail the whole render over this — the video did render and
    // video_scripts.video_url is already set, so nothing is lost; log it
    // loudly so it gets noticed and fixed (e.g. content_asset was deleted).
    console.error('  ⚠️  Rendered video but failed to attach media_files row:', error.message);
  } else {
    console.log('  🔗 Linked video to content_asset:', contentAssetId);
  }
}

async function renderOneScript(script) {
  console.log(`\n🎬 Rendering: "${script.title}" (${script.format}) [${script.id}]`);

  await mkdir(PUBLIC_TEMP_AUDIO, { recursive: true });
  await mkdir(PUBLIC_TEMP_IMAGES, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  console.log('  🎙️  Generating narration...');
  const { segmentAudio } = await synthesizeLessonNarration(script.script_segments);

  const audioFileNames = [];
  const imageFileNames = [];
  const segmentsWithAudio = [];

  for (let i = 0; i < segmentAudio.length; i++) {
    const seg = segmentAudio[i];

    const audioFileName = `${script.id}-segment-${i}.mp3`;
    await writeFile(path.join(PUBLIC_TEMP_AUDIO, audioFileName), seg.buffer);
    audioFileNames.push(audioFileName);

    const searchQuery = seg.stock_search || seg.visual_cue || script.title;
    const orientation = script.format === 'short' ? 'portrait' : 'landscape';

    let imageSrc = null;
    let videoSrc = null;

    try {
      console.log(`  🎥 Searching stock video for: "${searchQuery}"`);
      const stockVideo = await fetchStockVideo(searchQuery, orientation);
      if (stockVideo) {
        const videoFileName = `${script.id}-segment-${i}.mp4`;
        await writeFile(path.join(PUBLIC_TEMP_IMAGES, videoFileName), stockVideo.buffer);
        imageFileNames.push(videoFileName);
        videoSrc = `http://localhost:3000/temp-images/${videoFileName}`;
        console.log(`  ✅ Found video (${stockVideo.provider})`);
      }
    } catch (vidErr) {
      console.log(`  ⚠️  Video search failed: ${vidErr.message}`);
    }

    if (!videoSrc) {
      try {
        console.log(`  🖼️  Falling back to stock image for: "${searchQuery}"`);
        const stockImage = await fetchStockImage(searchQuery);
        if (stockImage) {
          const imageFileName = `${script.id}-segment-${i}.jpg`;
          await writeFile(path.join(PUBLIC_TEMP_IMAGES, imageFileName), stockImage.buffer);
          imageFileNames.push(imageFileName);
          imageSrc = `http://localhost:3000/temp-images/${imageFileName}`;
        } else {
          console.log(`  ⚠️  No stock image found either, using plain background`);
        }
      } catch (imgErr) {
        console.log(`  ⚠️  Image fetch failed: ${imgErr.message}, using plain background`);
      }
    }

    segmentsWithAudio.push({
      text: seg.text,
      visual_cue: seg.visual_cue,
      durationSeconds: seg.durationSeconds,
      audioSrc: `http://localhost:3000/temp-audio/${audioFileName}`,
      imageSrc,
      videoSrc,
    });
  } // closes the for loop

  console.log('  🎨 Rendering video with Remotion...');
  const bundleLocation = await getBundleLocation();

  const inputProps = {
    title: script.title,
    orientation: script.format === 'short' ? 'vertical' : 'horizontal',
    segments: segmentsWithAudio,
  };

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'LessonVideo',
    inputProps,
  });

  const outputFileName = `${script.id}.mp4`;
  const outputLocation = path.join(OUTPUT_DIR, outputFileName);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
  });

  console.log('  ☁️  Uploading to Supabase storage...');
  const videoBuffer = await readFile(outputLocation);
  const videoUrl = await uploadVideo(videoBuffer, outputFileName);

  for (const fileName of audioFileNames) {
    await unlink(path.join(PUBLIC_TEMP_AUDIO, fileName)).catch(() => {});
  }
  for (const fileName of imageFileNames) {
    await unlink(path.join(PUBLIC_TEMP_IMAGES, fileName)).catch(() => {});
  }
  await unlink(outputLocation).catch(() => {});

  await supabase
    .from('video_scripts')
    .update({ render_status: 'completed', video_url: videoUrl })
    .eq('id', script.id);

  // NEW: close the loop into the review dashboard.
  await attachToContentAsset(script.content_asset_id, videoUrl);

  console.log(`  ✅ Done: ${videoUrl}`);
}

async function pollOnce() {
  const { data: pendingJobs, error } = await supabase
    .from('video_scripts')
    .select('*')
    .eq('render_status', 'pending')
    .limit(1);

  if (error) {
    console.error('❌ Error polling for jobs:', error.message);
    return;
  }

  if (!pendingJobs || pendingJobs.length === 0) {
    process.stdout.write('.');
    return;
  }

  const script = pendingJobs[0];

  await supabase.from('video_scripts').update({ render_status: 'rendering' }).eq('id', script.id);

  try {
    await renderOneScript(script);
  } catch (err) {
    console.error(`  ❌ Render failed for ${script.id}:`, err.message);
    await supabase
      .from('video_scripts')
      .update({ render_status: 'failed', render_error: err.message })
      .eq('id', script.id);
  }
}

async function main() {
  console.log('🚀 SBA Video Render Worker started.');
  console.log(`   Polling every ${POLL_INTERVAL_MS / 1000}s for pending videos...`);
  console.log('   (Press Ctrl+C to stop)\n');

  await pollOnce();
  setInterval(pollOnce, POLL_INTERVAL_MS);
}

// ─── Start the worker ──────────────────────────────────────────────────
main();
