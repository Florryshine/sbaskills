// ─── Video render pipeline ────────────────────────────────────────────
// Script (from video_scripts table) -> narration audio per segment ->
// Remotion render -> final MP4 saved to Supabase storage.

import { synthesizeLessonNarration } from './narration.js';
import { writeFile, mkdir, unlink } from 'fs/promises';
import os from 'os';
import { findVisualForCue } from './visuals.js';
import path from 'path';

const PUBLIC_TEMP_DIR = path.join(process.cwd(), 'public', 'temp-audio');
const PUBLIC_VISUALS_DIR = path.join(process.cwd(), 'public', 'temp-visuals');
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'temp-video');

/**
 * Render a full lesson video from a video_scripts row.
 * @param {object} script - a row from video_scripts (must include script_segments, format, title)
 * @param {string} baseUrl - e.g. 'http://localhost:3000' during render (Remotion needs a real URL to fetch audio from)
 * @returns {Promise<{ videoPath: string, audioFileNames: string[] }>}
 */
export async function renderLessonVideo(script, baseUrl = 'http://localhost:3000') {
  // ✅ Dynamic imports – these are loaded only when this function runs
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  await mkdir(PUBLIC_TEMP_DIR, { recursive: true });
  await mkdir(PUBLIC_VISUALS_DIR, { recursive: true });
  await mkdir(OUTPUT_DIR, { recursive: true });

  // 1. Generate narration audio for every segment
  const { segmentAudio } = await synthesizeLessonNarration(script.script_segments);

  // 2. Save each segment's audio into public/temp-audio so Remotion can fetch it by URL.
  //    This MUST happen before bundle() runs, since bundle() snapshots public/.
  const audioFileNames = [];
  const segmentsWithAudio = [];

  for (let i = 0; i < segmentAudio.length; i++) {
    const seg = segmentAudio[i];
    const fileName = `${script.id}-segment-${i}.mp3`;
    const filePath = path.join(PUBLIC_TEMP_DIR, fileName);
    await writeFile(filePath, seg.buffer);
    audioFileNames.push(fileName);

    // Find and download a real visual (video or image) for this segment
    const visual = await findVisualForCue(seg.visual_cue);
    let visualSrc = null;
    let visualType = 'none';

    if (visual.url) {
      try {
        const ext = visual.type === 'video' ? 'mp4' : 'jpg';
        const visualFileName = `${script.id}-visual-${i}.${ext}`;
        const visualPath = path.join(PUBLIC_VISUALS_DIR, visualFileName);
        const res = await fetch(visual.url);
        const buffer = Buffer.from(await res.arrayBuffer());
        await writeFile(visualPath, buffer);
        visualSrc = `${baseUrl}/public/temp-visuals/${visualFileName}`;
        visualType = visual.type;
      } catch (e) {
        console.error(`Failed to download visual for segment ${i}:`, e.message);
      }
    }

    segmentsWithAudio.push({
      text: seg.text,
      visual_cue: seg.visual_cue,
      durationSeconds: seg.durationSeconds,
      audioSrc: `${baseUrl}/public/temp-audio/${fileName}`,
      visualSrc,
      visualType,
    });
  }

  // 3. Bundle the Remotion project — explicitly point at the live public
  //    folder so it always picks up the audio files we just wrote.
  const bundleLocation = await bundle({
    entryPoint: path.join(process.cwd(), 'remotion', 'index.js'),
    publicDir: path.join(process.cwd(), 'public'),
    outDir: path.join(os.tmpdir(), `remotion-bundle-${script.id}-${Date.now()}`),
  });

  // 4. Select the composition with our real props (this also calculates
  //    the correct duration based on real segment durations)
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

  // 5. Render the video
  const outputFileName = `${script.id}.mp4`;
  const outputLocation = path.join(OUTPUT_DIR, outputFileName);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
  });

  // 6. Clean up temp audio files (they're only needed during render)
  for (const fileName of audioFileNames) {
    await unlink(path.join(PUBLIC_TEMP_DIR, fileName)).catch(() => {});
  }

  return { videoPath: outputLocation, outputFileName };
}