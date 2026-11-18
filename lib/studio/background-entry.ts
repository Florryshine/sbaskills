import { generateSong } from './pipeline';
import { drawFrame } from './typography';
import { audioBufferToWav } from './dsp';
import type { SongSpec, StudioSettings, Timeline } from './types';

declare global {
  interface Window {
    __SBA_MUSIC_JOB__?: { spec: SongSpec; settings: StudioSettings };
    __SBA_MUSIC_RESULT__?: { timeline: Timeline; wavBase64: string; usedTts: boolean; warnings: string[]; frameCount: number; width: number; height: number; fps: number };
    __SBA_MUSIC_RENDER__?: () => Promise<{ durationSec: number; frameCount: number; width: number; height: number; fps: number; usedTts: boolean; warnings: string[]; wavBase64Length: number }>;
  __SBA_MUSIC_RENDER_BATCH__?: (start: number, count: number) => string[];
  }
}

window.__SBA_MUSIC_RENDER__ = async () => {
  const job = window.__SBA_MUSIC_JOB__;
  if (!job) throw new Error('Missing music render payload.');
  const settings = { ...job.settings, vocalMode: 'synth' as const };
  const result = await generateSong(job.spec, {
    settings,
    onProgress: (message, percent) => window.parent.postMessage({ type: 'SBA_MUSIC_PROGRESS', message, percent }, '*'),
  });
  const wav = audioBufferToWav(result.audio);
  const wavBytes = new Uint8Array(await wav.arrayBuffer());
  let binary = '';
  const stride = 0x8000;
  for (let i = 0; i < wavBytes.length; i += stride) binary += String.fromCharCode(...wavBytes.subarray(i, i + stride));
  const wavBase64 = btoa(binary);
  const sizes: Record<string, [number, number]> = {
    '9:16': [720, 1280], '1:1': [1080, 1080], '16:9': [1280, 720],
  };
  const [width, height] = sizes[settings.aspect] ?? sizes['9:16'];
  const fps = 30;
  const frameCount = Math.ceil((result.timeline.durationSec + 1.6) * fps);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not create video canvas.');
  window.__SBA_MUSIC_RESULT__ = {
    timeline: result.timeline, wavBase64, usedTts: result.usedTts,
    warnings: [...result.warnings, ...(job.spec.vocal.mode === 'tts' ? ['Background worker currently uses the built-in synth voice; server-side TTS migration is pending.'] : [])],
    frameCount, width, height, fps,
  };
  window.__SBA_MUSIC_RENDER_BATCH__ = (start, count) => {
    const frames: string[] = [];
    for (let i = start; i < Math.min(frameCount, start + count); i++) {
      const t = i / fps;
      drawFrame(ctx, width, height, Math.min(t, result.timeline.durationSec + 1.5), result.timeline, {
        typography: settings.typography, background: settings.background,
      });
      frames.push(canvas.toDataURL('image/jpeg', 0.88).split(',')[1]);
    }
    return frames;
  };
  return {
    durationSec: result.timeline.durationSec, frameCount, width, height, fps,
    usedTts: result.usedTts, warnings: window.__SBA_MUSIC_RESULT__.warnings,
    wavBase64Length: wavBase64.length,
  };
};
