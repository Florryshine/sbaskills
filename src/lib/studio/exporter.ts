/**
 * Exporter — renders the synchronized music video entirely in the browser.
 *
 * Primary path: WebCodecs VideoEncoder (H.264) + AudioEncoder (AAC) muxed
 * into MP4 via mp4-muxer. Frames are drawn deterministically from the shared
 * timeline (faster than realtime on most machines).
 *
 * Fallback path: MediaRecorder over canvas.captureStream() + live audio —
 * realtime but universally supported.
 */
import { Muxer as Mp4Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { Timeline } from './types';
import { drawFrame } from './typography';
import type { TypographyStyle } from './typography';
import { audioBufferToWav } from './dsp';

export interface ExportOptions {
  fps: number;
  bitrate?: number;
  aspect: '9:16' | '1:1' | '16:9';
  onProgress?: (percent: number, stage: string) => void;
}

export interface ExportResult {
  blob: Blob;
  format: 'mp4' | 'webm';
}

export const ASPECT_SIZES: Record<string, [number, number]> = {
  '9:16': [720, 1280],
  '1:1': [1080, 1080],
  '16:9': [1280, 720],
};

export function webCodecsAvailable(): boolean {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'AudioEncoder' in window;
}

/* ------------------------------------------------------------------ */
/* MP4 via WebCodecs                                                    */
/* ------------------------------------------------------------------ */

export async function exportMp4(
  timeline: Timeline,
  audio: AudioBuffer,
  style: TypographyStyle,
  opts: ExportOptions,
): Promise<ExportResult> {
  const [W, H] = ASPECT_SIZES[opts.aspect] ?? ASPECT_SIZES['9:16'];
  const fps = opts.fps ?? 30;
  const duration = timeline.durationSec + 1.6; // match mix tail
  const totalFrames = Math.ceil(duration * fps);
  opts.onProgress?.(0, 'Preparing MP4 encoder…');

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;

  // pick supported video codec
  const codecCandidates = ['avc1.640033', 'avc1.4D0033', 'avc1.42E033', 'avc1.42003c'];
  let videoCodec: string | null = null;
  for (const codec of codecCandidates) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec, width: W, height: H, bitrate: 5_000_000, framerate: fps,
      });
      if (support.supported) { videoCodec = codec; break; }
    } catch { /* try next */ }
  }
  if (!videoCodec) throw new Error('No supported H.264 encoder in this browser.');

  // pick supported audio codec
  let audioCodec: 'aac' | 'opus' | null = null;
  const audioCandidates: Array<'aac' | 'opus'> = ['aac', 'opus'];
  for (const codec of audioCandidates) {
    const testCodec = codec === 'aac' ? 'mp4a.40.2' : 'opus';
    try {
      const support = await AudioEncoder.isConfigSupported({
        codec: testCodec, sampleRate: audio.sampleRate,
        numberOfChannels: Math.min(2, audio.numberOfChannels), bitrate: 128_000,
      });
      if (support.supported) { audioCodec = codec; break; }
    } catch { /* try next */ }
  }

  const muxer = new Mp4Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: audioCodec ? { codec: audioCodec, numberOfChannels: Math.min(2, audio.numberOfChannels), sampleRate: audio.sampleRate } : undefined,
    fastStart: 'in-memory',
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  videoEncoder.configure({
    codec: videoCodec, width: W, height: H,
    bitrate: opts.bitrate ?? 5_000_000, framerate: fps,
  });

  let audioEncoder: AudioEncoder | null = null;
  if (audioCodec) {
    audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => { throw e; },
    });
    audioEncoder.configure({
      codec: audioCodec === 'aac' ? 'mp4a.40.2' : 'opus',
      sampleRate: audio.sampleRate,
      numberOfChannels: Math.min(2, audio.numberOfChannels),
      bitrate: 128_000,
    });
  }

  /* ---- video frames (deterministic; draws are pure functions of time) ---- */
  for (let i = 0; i < totalFrames; i++) {
    const t = i / fps;
    drawFrame(ctx, W, H, Math.min(t, timeline.durationSec + 1.5), timeline, style);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round(i * 1_000_000 / fps),
      duration: Math.round(1_000_000 / fps),
    });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (i % 12 === 0) {
      opts.onProgress?.(Math.round((i / totalFrames) * 70), `Rendering frames ${i}/${totalFrames}`);
      await drain(videoEncoder);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await videoEncoder.flush();
  videoEncoder.close();
  opts.onProgress?.(75, 'Encoding audio…');

  /* ---- audio chunks (planar f32 -> AudioData) ---- */
  if (audioEncoder) {
    const numCh = Math.min(2, audio.numberOfChannels);
    const chunkFrames = Math.floor(audio.sampleRate * 0.5);
    let pos = 0;
    let ptsUs = 0;
    while (pos < audio.length) {
      const n = Math.min(chunkFrames, audio.length - pos);
      const data = new Float32Array(n * numCh);
      for (let ch = 0; ch < numCh; ch++) {
        const src = audio.getChannelData(Math.min(ch, audio.numberOfChannels - 1));
        data.set(src.subarray(pos, pos + n), ch * n);
      }
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate: audio.sampleRate,
        numberOfFrames: n,
        numberOfChannels: numCh,
        timestamp: ptsUs,
        data,
      });
      audioEncoder.encode(ad);
      ad.close();
      pos += n;
      ptsUs += Math.round(n * 1_000_000 / audio.sampleRate);
      await new Promise((r) => setTimeout(r, 0));
    }
    await audioEncoder.flush();
    audioEncoder.close();
  }

  opts.onProgress?.(95, 'Finalizing MP4…');
  muxer.finalize();
  const { buffer } = muxer.target as ArrayBufferTarget;
  opts.onProgress?.(100, 'Done');
  return { blob: new Blob([buffer], { type: 'video/mp4' }), format: 'mp4' };
}

async function drain(encoder: VideoEncoder): Promise<void> {
  while (encoder.encodeQueueSize > 8) {
    await new Promise((r) => setTimeout(r, 8));
  }
}

/* ------------------------------------------------------------------ */
/* WebM realtime fallback                                               */
/* ------------------------------------------------------------------ */

export function exportWebm(
  timeline: Timeline,
  audio: AudioBuffer,
  style: TypographyStyle,
  opts: ExportOptions,
): Promise<ExportResult> {
  const [W, H] = ASPECT_SIZES[opts.aspect] ?? ASPECT_SIZES['9:16'];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const stream = canvas.captureStream(30);

  const actx = new AudioContext({ sampleRate: audio.sampleRate });
  const src = actx.createBufferSource();
  src.buffer = audio;
  const dest = actx.createMediaStreamDestination();
  src.connect(dest);

  const mimeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  (dest.stream.getAudioTracks()).forEach((t) => stream.addTrack(t));

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const duration = timeline.durationSec + 1.6;
  const totalMs = duration * 1000;
  const startedAt = performance.now();

  const drawLoop = () => {
    const t = Math.min((performance.now() - startedAt) / 1000, timeline.durationSec + 1.5);
    drawFrame(ctx, W, H, t, timeline, style);
    opts.onProgress?.(Math.round((t / duration) * 95), `Recording in realtime ${(t).toFixed(0)}s / ${duration.toFixed(0)}s`);
    if (t < duration) requestAnimationFrame(drawLoop);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = async () => {
      src.stop();
      await actx.close();
      resolve({ blob: new Blob(chunks, { type: 'video/webm' }), format: 'webm' });
    };
    recorder.onerror = (e) => reject(e);
    recorder.start(500);
    src.start();
    requestAnimationFrame(drawLoop);
    setTimeout(() => recorder.stop(), totalMs);
  });
}

/* ------------------------------------------------------------------ */
/* Audio-only                                                           */
/* ------------------------------------------------------------------ */

export function exportWav(audio: AudioBuffer): Blob {
  return audioBufferToWav(audio);
}
