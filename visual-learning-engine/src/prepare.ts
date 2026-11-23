// src/prepare.ts — episode preparation: narration, imagery, music.
//
// Takes a validated script + job spec and materializes every asset the
// renderer needs into the job's public dir:
//   public/narration/scene-XXX.mp3|wav   (normalized, measured)
//   public/images/scene-XXX-sN.jpg       (one file per <=3s shot)
//   public/images/scene-XXX-a|b.jpg      (compare scenes: left/right)
//   public/music/bed.wav                 (procedural, when music enabled)
// and returns the manifests. Each step is resumable: existing files are kept,
// so an interrupted job re-runs only the missing pieces.

import type {
  EpisodeScript,
  ImageManifest,
  NarrationManifest,
  VLJobSpec,
} from './types';
import { synthesizeSceneNarration, probeDurationSeconds, VOICE_PRESETS } from './narration/providers';
import { normalizeNarrationClip, generateSilence } from './audio/mix';
import { resolveSceneImages } from './imagery/providers';
import { generateMusicFile } from './music/generator';
import { access, mkdir, copyFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PrepareOptions {
  publicDir: string;
  narrationProvider?: VLJobSpec['narrationProvider'];
  imageProvider?: VLJobSpec['imageProvider'];
  proxyEndpoint?: string;
  /** Silent clips are disabled unless explicitly requested for a preview/test. */
  allowSilent?: boolean;
  /** parallel image resolution (default 3) */
  imageConcurrency?: number;
  /** max seconds a single image stays on screen (default 3) */
  maxShotSeconds?: number;
  onProgress?: (stage: string, message: string) => void;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Estimated scene duration from narration text (mirrors timeline pacing). */
function estimateSceneSeconds(narration: string, sceneType: string): number {
  const words = narration.trim().split(/\s+/).filter(Boolean).length;
  const speech = (words / 150) * 60;
  const leadTail = (8 + 14) / 30;
  const floors: Record<string, number> = { hook: 2.4, compare: 2.8, process: 2.8, title: 2.4 };
  return Math.max(speech + leadTail, floors[sceneType] ?? 2.2);
}

/** How many shots a scene needs so no image lasts longer than maxSeconds. */
function shotCountFor(narration: string, sceneType: string, maxSeconds: number): number {
  const est = estimateSceneSeconds(narration, sceneType);
  return Math.max(1, Math.min(8, Math.ceil(est / Math.max(1, maxSeconds))));
}

/** Narration for every scene (resumable per scene). */
export async function prepareNarration(
  script: EpisodeScript,
  spec: VLJobSpec,
  opts: PrepareOptions,
): Promise<NarrationManifest> {
  const narrDir = join(opts.publicDir, 'narration');
  await mkdir(narrDir, { recursive: true });
  const preset = VOICE_PRESETS[spec.voice] ? spec.voice : 'warm_male';
  const clips: NarrationManifest['clips'] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    let cachedExt = existsSync(join(narrDir, `scene-${String(i).padStart(3, '0')}.mp3`))
      ? 'mp3'
      : existsSync(join(narrDir, `scene-${String(i).padStart(3, '0')}.wav`))
        ? 'wav'
        : null;
    const metaPath = join(narrDir, `scene-${String(i).padStart(3, '0')}.meta.json`);
    let cachedMeta: { provider?: NarrationManifest['provider']; voice?: string; ext?: 'wav' | 'mp3' } | null = null;
    if (cachedExt) {
      try {
        cachedMeta = JSON.parse(await (await import('node:fs/promises')).readFile(metaPath, 'utf8'));
        if (!cachedMeta?.provider || cachedMeta.provider === 'silent' || !cachedMeta.voice || cachedMeta.voice === 'none' || !cachedMeta.ext || cachedMeta.ext !== cachedExt) cachedExt = null;
      } catch {
        // Legacy cache entries have no trustworthy provider metadata: regenerate them.
        cachedExt = null;
      }
      if (!cachedExt) {
        await Promise.all(['mp3', 'wav'].map((ext) => unlink(join(narrDir, `scene-${String(i).padStart(3, '0')}.${ext}`)).catch(() => {})));
      }
    }
    if (cachedExt && cachedMeta) {
      const file = join(narrDir, `scene-${String(i).padStart(3, '0')}.${cachedExt}`);
      const duration = probeDurationSeconds(file);
      if (!duration || duration <= 0) {
        await unlink(file).catch(() => {});
        cachedExt = null;
      }
      if (!cachedExt || !duration) continue;
      opts.onProgress?.('narrating', `scene ${i + 1}/${script.scenes.length} (cached)`);
      clips.push({
        sceneIndex: i,
        provider: cachedMeta.provider!,
        file: join('narration', `scene-${String(i).padStart(3, '0')}.${cachedExt}`),
        duration,
        words: [],
        voice: cachedMeta.voice!,
      });
      // Word timings sidecar (saved on first run)
      try {
        const { readFile } = await import('node:fs/promises');
        const sidecar = await readFile(join(narrDir, `scene-${String(i).padStart(3, '0')}.words.json`), 'utf8');
        clips[clips.length - 1].words = JSON.parse(sidecar);
      } catch {
        const { proportionalWords } = await import('./narration/align');
        clips[clips.length - 1].words = proportionalWords(scene.narration, duration);
      }
      continue;
    }

    opts.onProgress?.('narrating', `scene ${i + 1}/${script.scenes.length}`);
    const result = await synthesizeSceneNarration(
      { text: scene.narration, preset, preferred: opts.narrationProvider },
      { proxyEndpoint: opts.proxyEndpoint, allowSilent: opts.allowSilent === true },
    );
    if (!result) throw new Error(`narration failed for scene ${i} (all providers failed)`);
    const ext = result.ext;
    let destFile = join(narrDir, `scene-${String(i).padStart(3, '0')}.${ext === 'wav' ? 'wav' : 'mp3'}`);
    const normalized = await normalizeNarrationClip(result.file, ext);
    await copyFile(normalized.file, destFile);
    const duration = probeDurationSeconds(destFile) ?? result.duration;
    if (result.provider === 'silent') {
      destFile = join(narrDir, `scene-${String(i).padStart(3, '0')}.wav`);
      await generateSilence(duration, destFile);
      clips.push({ sceneIndex: i, provider: 'silent', file: join('narration', `scene-${String(i).padStart(3, '0')}.wav`), duration, words: result.words, voice: 'none' });
    } else {
      clips.push({
        sceneIndex: i,
        provider: result.provider,
        file: join('narration', `scene-${String(i).padStart(3, '0')}.${ext === 'wav' ? 'wav' : 'mp3'}`),
        duration,
        words: result.words,
        voice: result.voice,
      });
    }
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(narrDir, `scene-${String(i).padStart(3, '0')}.words.json`), JSON.stringify(result.words));
    await writeFile(metaPath, JSON.stringify({ provider: result.provider, voice: result.voice, ext: result.ext }));
  }
  const provider = clips[0]?.provider ?? spec.narrationProvider ?? 'edge';
  return { provider, voice: clips[0]?.voice ?? preset, clips };
}

interface ImageJob {
  sceneIndex: number;
  subject: string;
  slot?: 'a' | 'b';
  count: number;
}

/** Images for every scene that wants one — multiple shots per scene. */
export async function prepareImages(
  script: EpisodeScript,
  spec: VLJobSpec,
  opts: PrepareOptions,
): Promise<ImageManifest> {
  const maxShotSeconds = Math.max(1.5, Math.min(10, opts.maxShotSeconds ?? spec.maxShotSeconds ?? 3));
  const jobs: ImageJob[] = [];
  script.scenes.forEach((s, i) => {
    if (s.type === 'compare') {
      // Compare scenes hold one image per side (the A/B is the point).
      jobs.push({ sceneIndex: i, subject: s.left.image_prompt, slot: 'a', count: 1 });
      jobs.push({ sceneIndex: i, subject: s.right.image_prompt, slot: 'b', count: 1 });
    } else if ('image_prompt' in s && Boolean((s as { image_prompt?: string }).image_prompt)) {
      const count = shotCountFor(s.narration, s.type, maxShotSeconds);
      jobs.push({ sceneIndex: i, subject: (s as { image_prompt: string }).image_prompt, count });
    }
  });
  const concurrency = Math.max(1, Math.min(6, opts.imageConcurrency ?? 3));
  const assets: ImageManifest['assets'] = [];

  let cursor = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      opts.onProgress?.('imagery', `scene ${job.sceneIndex + 1}/${script.scenes.length} (${job.count} shot${job.count > 1 ? 's' : ''}${job.slot ? `, ${job.slot === 'b' ? 'right' : 'left'}` : ''})`);
      const resolved = await resolveSceneImages({
        sceneIndex: job.sceneIndex,
        subject: job.subject,
        style: spec.style,
        aspect: spec.aspect,
        seed: spec.seed,
        publicDir: opts.publicDir,
        preferred: opts.imageProvider,
        count: job.count,
        slot: job.slot,
      });
      assets.push(...resolved);
    }
  });
  await Promise.all(workers);

  assets.sort((a, b) => a.sceneIndex - b.sceneIndex || a.shot - b.shot || a.file.localeCompare(b.file));
  return { style: spec.style, assets };
}

/** Procedural music bed (skipped when music is disabled). */
export async function prepareMusic(spec: VLJobSpec, script: EpisodeScript, narration: NarrationManifest, opts: PrepareOptions): Promise<string | null> {
  if (!spec.music) return null;
  const rel = join('music', 'bed.wav');
  const abs = join(opts.publicDir, rel);
  if (await exists(abs)) return rel;
  const totalSeconds = narration.clips.reduce((a, c) => a + c.duration, 0) + 6;
  opts.onProgress?.('music', `generating ${Math.round(totalSeconds)}s bed`);
  await generateMusicFile(abs, totalSeconds, spec.seed);
  return rel;
}
