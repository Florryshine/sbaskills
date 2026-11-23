#!/usr/bin/env bun
// Dynamic Motion Graphics Engine — durable worker.
// Claims motion_jobs atomically (claim_motion_job RPC), heartbeats the lease,
// builds the creative direction, synthesizes narration + music + SFX, renders
// with the existing SBA Remotion install and registers the MP4 in the shared
// content_assets/media_files library. Same contract as cartoon-worker.js.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[motion-worker] Supabase URL and service-role key are required.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REPO_ROOT = process.cwd();
const WORKER_ID = `${hostname()}-motion-${process.pid}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Math.max(3000, Number(process.env.MOTION_WORKER_POLL_MS || 12000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.MOTION_WORKER_HEARTBEAT_MS || 25000));
const RUN_ONCE = process.env.MOTION_RUN_ONCE === '1';
const ASSET_BUCKET = 'motion-assets';
const VIDEO_BUCKET = 'lesson-videos';
const MAX_RUN_MS = Number(process.env.MOTION_RUN_ONCE_MAX_MS || 40 * 60 * 1000);
let stopping = false;
let currentJobId = null;
let lastClaimError = null;

const { buildCreativeDirection } = await import('../lib/motion/direction-engine.js');
const { wordsFor, estimateDurationSeconds } = await import('../lib/motion/estimate.js');
const { renderMusicBed } = await import('../lib/motion/audio/music.js');
const { buildSfxKit } = await import('../lib/motion/audio/sfx.js');
const { synthesizeLine, getAudioMimeType, getAudioExtension } = await import('../lib/podcastTTS.js');
const { normalizeAudio } = await import('../lib/whiteboard/audio.js');

function log(...args) { console.log('[motion-worker]', ...args); }

function assertLease(job) {
  if (job.leaseLost) throw new Error('Motion job lease was lost; this worker will not save stale results.');
}

// ---------------------------------------------------------------------------
// Job plumbing (same shape as the Cartoon worker)
async function registerWorker() {
  const { error } = await supabase.from('motion_workers').upsert({
    worker_id: WORKER_ID, last_seen_at: new Date().toISOString(),
    current_job_id: currentJobId,
    info: { node: process.version, bun: typeof Bun !== 'undefined' ? Bun.version : null, last_error: lastClaimError },
  });
  if (error) log('worker liveness update failed:', error.message);
}

async function heartbeat(job) {
  const { data, error } = await supabase.rpc('motion_job_heartbeat', {
    p_job_id: job.id, p_claim_token: job.claim_token,
    p_stage: job.stage || null, p_progress: job.progress ?? null,
    p_message: job.stage_message || null,
  });
  if (error) throw new Error('Heartbeat failed: ' + error.message);
  if (data !== true) throw new Error('Motion job lease was lost.');
}

async function setStage(job, stage, progress, message) {
  assertLease(job);
  job.stage = stage;
  job.progress = Math.max(0, Math.min(100, Math.round(progress)));
  job.stage_message = String(message || '').slice(0, 300);
  const { data: ownedJob, error } = await supabase.from('motion_jobs').update({
    stage, progress: job.progress, stage_message: job.stage_message, updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token).eq('status', 'processing').select('id').maybeSingle();
  if (error) throw new Error('Could not update job progress: ' + error.message);
  if (!ownedJob) { job.leaseLost = true; throw new Error('Motion job lease was lost.'); }
  const { error: projectError } = await supabase.from('motion_projects').update({
    stage, progress: job.progress, stage_message: job.stage_message, updated_at: new Date().toISOString(),
  }).eq('id', job.project_id);
  if (projectError) throw new Error('Could not update project progress: ' + projectError.message);
}

async function failJob(job, error) {
  const message = String(error?.message || error || 'Unknown Motion Graphics worker error').slice(0, 1800);
  const { data: failedJob, error: failError } = await supabase.from('motion_jobs').update({
    status: 'failed', stage: 'failed', stage_message: 'Job failed',
    error_message: message, claim_token: null, worker_id: null,
    claimed_at: null, heartbeat_at: null, updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token).select('id').maybeSingle();
  if (failError) log('could not record job failure:', failError.message);
  if (!failedJob) return; // lease was reclaimed by another worker; never overwrite
  const projectStatus = job.job_type === 'direction' ? 'queued' : 'failed';
  await supabase.from('motion_projects').update({
    status: projectStatus, stage: 'failed',
    stage_message: job.job_type === 'direction'
      ? 'Direction failed — you can retry it from the studio.'
      : 'Production failed',
    error_message: message, updated_at: new Date().toISOString(),
  }).eq('id', job.project_id);
  log('job failed:', job.id, message);
}

async function loadProject(job) {
  const { data, error } = await supabase.from('motion_projects').select('*').eq('id', job.project_id).maybeSingle();
  if (error) throw new Error('Project lookup failed: ' + error.message);
  if (!data) throw new Error('Motion project no longer exists.');
  return data;
}

async function ensureKnowledgeAsset(project, spec, subject) {
  if (project.knowledge_asset_id) return project.knowledge_asset_id;
  const keyword = String(spec.title || project.custom_topic || project.title).trim().slice(0, 200);
  const { data: found, error: findError } = await supabase.from('knowledge_assets')
    .select('id').eq('keyword', keyword).eq('subject', subject).limit(1).maybeSingle();
  if (findError) throw new Error('Knowledge Asset reuse lookup failed: ' + findError.message);
  if (found?.id) return found.id;
  const { data, error } = await supabase.from('knowledge_assets').insert({
    keyword, topic_type: 'creator_video', subject,
    summary: String(spec.direction?.id ? `${spec.direction.label} motion graphics treatment of ${keyword}` : keyword).slice(0, 1800),
    raw_content: JSON.stringify(spec).slice(0, 16000),
    sub_topics: spec.scenes.slice(0, 8).map((scene) => ({ title: scene.heading, explanation: scene.narration })),
    key_concepts: spec.scenes.map((s) => s.heading).slice(0, 12),
    definitions: [], examples: [], facts: [], common_mistakes: [],
    learning_objectives: [], status: 'draft', source: 'motion_graphics_engine',
  }).select('id').single();
  if (error) throw new Error('Could not create linked Knowledge Asset: ' + error.message);
  return data.id;
}

// ---------------------------------------------------------------------------
// LLM script generation with a deterministic fallback (source = 'topic').
function fallbackScript(topic, subject) {
  const t = String(topic || subject || 'this idea').trim().replace(/\.$/, '');
  return [
    `Here is what nobody tells you about ${t}.`,
    `Most people get ${t} wrong from day one, and it costs them more than they realize.`,
    `Why does it matter? Because the students who master ${t} move twice as fast as everyone else.`,
    `First: learn the core idea. Next: practice it daily. Finally: teach someone else what you learned.`,
    `Numbers do not lie — the top 10 percent spend 30 minutes every single day on ${t}.`,
    `Start today. Your future self will thank you for it.`,
  ].join(' ');
}

async function generateScript(project, subject) {
  const topic = String(project.custom_topic || project.title || subject).trim();
  if (project.script_text && project.script_text.trim().length > 40) return { script: project.script_text, usedAI: false, error: null };
  try {
    const { generateWithFallback } = await import('../lib/llmFallbackChain.js');
    const prompt = `Write a short, punchy motion graphics video script about "${topic}" (subject: ${subject}).
Rules:
- 5 to 8 short sentences, each under 20 words.
- Every sentence must stand alone as a screen beat.
- Include at least one concrete number or percentage.
- Include one question and one imperative call to action.
- No markdown, no headings, no scene labels — plain sentences only.`;
    const script = await generateWithFallback(prompt, { maxTokens: 700, temperature: 0.8 });
    const text = String(script || '').trim();
    if (text.split(/(?<=[.!?])\s/).length >= 4) return { script: text, usedAI: true, error: null };
    throw new Error('Script too short');
  } catch (error) {
    log('script generation fallback:', error.message.slice(0, 200));
    return { script: fallbackScript(topic, subject), usedAI: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// Creative direction stage
async function makeDirection(job, project) {
  await setStage(job, 'direction', 6, 'Analyzing the script and choosing a visual direction...');
  const subject = String(job.payload?.subject || 'General').slice(0, 80);
  let script = project.script_text || '';
  if (project.source === 'topic' && (!script || script.trim().length < 40)) {
    await setStage(job, 'direction', 10, 'Writing the script with AI...');
    const generated = await generateScript(project, subject);
    script = generated.script;
    if (generated.error) log('script provider fallback used:', generated.error.slice(0, 200));
  }

  const spec = buildCreativeDirection({
    scriptText: script,
    topic: project.custom_topic || project.title,
    seed: job.payload?.regenSeed ? Number(job.payload.regenSeed) >>> 0 : undefined,
    intensity: project.visual_intensity || 'balanced',
    musicStyle: project.music_style || null,
    maxScenes: 10,
  });
  if (!spec.scenes?.length) throw new Error('Direction engine produced no scenes.');

  const knowledgeAssetId = await ensureKnowledgeAsset(project, spec, subject);
  assertLease(job);
  const { error } = await supabase.from('motion_projects').update({
    title: spec.title || project.title,
    script_text: script,
    knowledge_asset_id: knowledgeAssetId,
    direction: { direction: spec.direction, analysis: spec.analysis, musicPlan: spec.musicPlan, seed: spec.seed, version: spec.version },
    scenes: spec.scenes,
    status: 'direction_ready',
    stage: 'direction_ready',
    progress: 100,
    stage_message: 'Creative direction ready — review the scenes, then render.',
    error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  if (error) throw new Error('Could not save the creative direction: ' + error.message);
  return { spec, knowledgeAssetId, subject };
}

// ---------------------------------------------------------------------------
// Narration stage (per-scene TTS with checkpointing; supports uploaded track)
function wavDuration(buffer) {
  try {
    if (buffer.length < 44 || buffer.toString('latin1', 0, 4) !== 'RIFF') return null;
    let offset = 12, byteRate = null, dataSize = null;
    while (offset + 8 <= buffer.length) {
      const id = buffer.toString('latin1', offset, offset + 4);
      const size = buffer.readUInt32LE(offset + 4);
      if (id === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
      if (id === 'data') { dataSize = size; break; }
      offset += 8 + size + (size % 2);
    }
    const seconds = byteRate && dataSize ? dataSize / byteRate : NaN;
    return Number.isFinite(seconds) && seconds > 0.2 ? seconds : null;
  } catch { return null; }
}

function probeDuration(file, text, buffer) {
  const exactWav = wavDuration(buffer);
  if (exactWav) return Promise.resolve(exactWav);
  return new Promise((resolve) => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const n = code === 0 ? Number.parseFloat(out.trim()) : NaN;
      resolve(Number.isFinite(n) && n > 0 ? n : estimateDurationSeconds(text));
    });
    child.on('error', () => { clearTimeout(timer); resolve(estimateDurationSeconds(text)); });
  });
}

async function uploadAsset(buffer, storagePath, contentType) {
  const { error } = await supabase.storage.from(ASSET_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Upload failed (${storagePath}): ${error.message}`);
  const { data } = supabase.storage.from(ASSET_BUCKET).getPublicUrl(storagePath);
  if (!data?.publicUrl) throw new Error(`Supabase did not return a public URL for ${storagePath}.`);
  return data.publicUrl;
}

async function narrateScenes(job, project, spec) {
  const scenes = spec.scenes || [];
  const existing = project.narration && typeof project.narration === 'object' ? { ...project.narration } : {};
  const workDir = path.join(tmpdir(), 'sba-motion', job.id);
  await mkdir(workDir, { recursive: true });
  const useSfx = project.use_sfx !== false;

  // Uploaded full-track narration: one audio file, scenes distributed by word share.
  if (project.narration_mode === 'uploaded' && project.narration_url) {
    if (Object.keys(existing).length === scenes.length) return existing;
    await setStage(job, 'narrating', 20, 'Probing the uploaded narration track...');
    const trackPath = path.join(workDir, 'track.mp3');
    const response = await fetch(project.narration_url);
    if (!response.ok) throw new Error(`Could not download narration track (${response.status}).`);
    const trackBuffer = Buffer.from(await response.arrayBuffer());
    await writeFile(trackPath, trackBuffer);
    const totalSeconds = await probeDuration(trackPath, '', trackBuffer);
    const totalWords = scenes.reduce((a, s) => a + wordsFor(s.narration, 1).length, 0);
    let cursor = 0;
    for (const scene of scenes) {
      const sceneWords = wordsFor(scene.narration, 1).length;
      const share = sceneWords / Math.max(1, totalWords);
      const duration = Math.max(1.4, totalSeconds * share);
      const words = wordsFor(scene.narration, duration);
      existing[scene.id] = { sceneId: scene.id, audioUrl: project.narration_url, storagePath: null, durationSeconds: Number(duration.toFixed(3)), words, sharedTrack: true };
      scene.durationSeconds = existing[scene.id].durationSeconds;
    }
    // The shared track plays once over the whole video instead of per scene.
    existing.__shared__ = { audioUrl: project.narration_url, durationSeconds: Number(totalSeconds.toFixed(3)) };
    await setStage(job, 'narrating', 30, 'Uploaded narration mapped to scenes.');
  } else {
    for (let i = 0; i < scenes.length; i++) {
      assertLease(job);
      const scene = scenes[i];
      if (existing[scene.id]?.audioUrl && existing[scene.id]?.durationSeconds) continue;
      await setStage(job, 'narrating', 18 + (i / scenes.length) * 32, `Narrating scene ${i + 1}/${scenes.length}: ${scene.heading}`);
      let buffer = null, mimeType = null, ext = 'mp3', durationSeconds = null;
      try {
        const raw = await synthesizeLine(scene.narration, 'host_a', 'neutral');
        const source = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
        const normalized = normalizeAudio(source, getAudioMimeType(source));
        buffer = normalized.buffer;
        mimeType = normalized.mimeType || getAudioMimeType(buffer);
        ext = mimeType === 'audio/wav' ? 'wav' : getAudioExtension(buffer);
      } catch (ttsError) {
        log(`TTS unavailable for scene ${scene.id} (${ttsError.message.slice(0, 120)}); continuing with timed silence.`);
        existing[scene.id] = {
          sceneId: scene.id, audioUrl: null, storagePath: null,
          durationSeconds: Number(estimateDurationSeconds(scene.narration).toFixed(3)),
          words: wordsFor(scene.narration, estimateDurationSeconds(scene.narration)),
          silent: true,
        };
        scene.durationSeconds = existing[scene.id].durationSeconds;
        continue;
      }
      const localFile = path.join(workDir, `${scene.id}.${ext}`);
      const storagePath = `narration/${project.id}/${scene.id}.${ext}`;
      await writeFile(localFile, buffer);
      durationSeconds = await probeDuration(localFile, scene.narration, buffer);
      const audioUrl = await uploadAsset(buffer, storagePath, mimeType);
      existing[scene.id] = {
        sceneId: scene.id, audioUrl, storagePath,
        durationSeconds: Number(durationSeconds.toFixed(3)),
        words: wordsFor(scene.narration, durationSeconds),
      };
      scene.durationSeconds = existing[scene.id].durationSeconds;
      assertLease(job);
      const { error: saveError } = await supabase.from('motion_projects')
        .update({ narration: existing, updated_at: new Date().toISOString() }).eq('id', project.id);
      if (saveError) throw new Error('Could not checkpoint narration: ' + saveError.message);
    }
  }

  // Music + SFX
  await setStage(job, 'audio', 52, 'Composing the music bed...');
  const totalSeconds = scenes.reduce((a, s) => a + (s.durationSeconds || 3), 0);
  const narrationWindows = scenes.map((s) => {
    const start = scenes.slice(0, scenes.indexOf(s)).reduce((a, x) => a + (x.durationSeconds || 3), 0);
    return { start, end: start + (s.durationSeconds || 3) * 0.92 };
  });
  const audioMeta = { ...(project.audio_meta && typeof project.audio_meta === 'object' ? project.audio_meta : {}) };
  if (!audioMeta.music?.url) {
    const music = renderMusicBed({
      musicPlan: spec.musicPlan || spec.direction?.musicPlan,
      totalDuration: totalSeconds,
      narrationWindows,
      seed: spec.seed || 7,
    });
    const musicPath = `music/${project.id}/bed.wav`;
    const musicUrl = await uploadAsset(music.wav, musicPath, 'audio/wav');
    audioMeta.music = { url: musicUrl, storagePath: musicPath, durationSeconds: music.durationSeconds, style: spec.musicPlan?.style, tempo: spec.musicPlan?.tempo };
    log('music bed rendered:', `${(music.wav.length / 1024 / 1024).toFixed(1)}MB`, `${music.durationSeconds.toFixed(1)}s`);
  }
  if (useSfx && !audioMeta.sfx) {
    await setStage(job, 'audio', 58, 'Building the sound-effects kit...');
    const kit = buildSfxKit(spec.direction.sfxKit, (spec.seed || 11) ^ 0x5f3);
    const sfxMap = {};
    for (const scene of scenes) {
      sfxMap[scene.id] = [];
      for (const event of scene.sfx || []) {
        const sound = kit[event.type] || kit.impact;
        if (!sound) continue;
        const sfxPath = `sfx/${project.id}/${scene.id}-${event.type}.wav`;
        const url = await uploadAsset(sound.buffer, sfxPath, 'audio/wav');
        sfxMap[scene.id].push({ type: event.type, url, at: event.at, strength: event.strength, durationSeconds: sound.durationSeconds });
      }
      // Whoosh into the next cut (riser in the last second of the scene).
      const next = scenes[scenes.indexOf(scene) + 1];
      if (next && kit.whoosh && scene.durationSeconds > 1.6) {
        const sfxPath = `sfx/${project.id}/${scene.id}-whoosh.wav`;
        const url = await uploadAsset(kit.whoosh.buffer, sfxPath, 'audio/wav');
        sfxMap[scene.id].push({ type: 'whoosh', url, at: Math.max(0.2, scene.durationSeconds - kit.whoosh.durationSeconds - 0.05), strength: 0.5, durationSeconds: kit.whoosh.durationSeconds });
      }
    }
    audioMeta.sfx = sfxMap;
  }

  assertLease(job);
  await setStage(job, 'audio', 64, 'Audio package ready.');
  const { error: audioSaveError } = await supabase.from('motion_projects').update({
    audio_meta: audioMeta, narration: existing,
    scenes,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  if (audioSaveError) throw new Error('Could not save the audio package: ' + audioSaveError.message);
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
  return { narration: existing, audioMeta };
}

// ---------------------------------------------------------------------------
// Render stage — same Remotion bundle path as the Cartoon engine.
async function renderVideo(job, project, spec) {
  const orientation = project.orientation || '9:16';
  const dims = orientation === '16:9' ? { width: 1920, height: 1080 }
    : orientation === '1:1' ? { width: 1080, height: 1080 }
    : { width: 1080, height: 1920 };
  const inputProps = {
    spec: {
      direction: spec.direction,
      scenes: spec.scenes,
      musicPlan: spec.musicPlan,
      title: spec.title,
      seed: spec.seed,
    },
    audio: {
      musicUrl: project.audio_meta?.music?.url || null,
      musicVolume: 0.9,
      narration: project.narration || {},
      sfx: project.use_sfx === false ? {} : (project.audio_meta?.sfx || {}),
      narrationVolume: 1,
    },
    orientation,
    subtitles: project.subtitles !== false,
    brandLine: project.brand_line || 'Shiney Brain Academy',
  };
  const outDir = path.join(tmpdir(), 'sba-motion-render');
  await mkdir(outDir, { recursive: true });
  const outputLocation = path.join(outDir, `${project.id}.mp4`);
  await setStage(job, 'rendering', 70, 'Bundling the Motion Graphics composition...');
  const { bundle } = await import('@remotion/bundler');
  const { selectComposition, renderMedia } = await import('@remotion/renderer');
  const entryPoint = path.join(REPO_ROOT, 'remotion', 'index.js');
  const serveUrl = await bundle({ entryPoint });
  assertLease(job);
  const composition = await selectComposition({
    serveUrl, id: 'MotionGraphicsVideo', inputProps,
    timeoutInMilliseconds: 120000,
  });
  await supabase.from('motion_projects').update({
    status: 'rendering', stage: 'rendering', stage_message: 'Rendering motion graphics...',
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  await setStage(job, 'rendering', 74, 'Rendering motion graphics...');
  let lastProgressWrite = 0;
  await renderMedia({
    composition: { ...composition, width: dims.width, height: dims.height },
    serveUrl, codec: 'h264', outputLocation, inputProps,
    concurrency: Math.max(1, Math.min(4, Number(process.env.MOTION_RENDER_CONCURRENCY || 2))),
    onProgress: ({ progress }) => {
      const now = Date.now();
      if (now - lastProgressWrite < 2500 && progress < 1) return;
      lastProgressWrite = now;
      const value = 74 + Math.round(progress * 20);
      setStage(job, 'rendering', value, `Rendering motion graphics: ${Math.round(progress * 100)}%`).catch((err) => log('progress update failed:', err.message));
    },
  });
  assertLease(job);
  const buffer = await readFile(outputLocation);
  if (!buffer.length) throw new Error('Remotion produced an empty MP4.');
  return { outputLocation, buffer, durationSeconds: composition.durationInFrames / composition.fps, dimensions: dims };
}

async function registerVideo(job, project, rendered) {
  if (!project.knowledge_asset_id) throw new Error('Project is missing its Knowledge Asset link.');
  await setStage(job, 'uploading', 95, 'Uploading the video and registering it in the SBA content library...');
  const slug = String(project.title || 'motion-graphics').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'motion-graphics';
  const storagePath = `motion-graphics/${project.id}/${slug}.mp4`;
  const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET)
    .upload(storagePath, rendered.buffer, { contentType: 'video/mp4', upsert: true });
  if (uploadError) throw new Error('Video upload failed: ' + uploadError.message);
  const { data: publicData } = await supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Uploaded video has no public URL; refusing to save media_files with a null URL.');

  assertLease(job);
  const spec = { direction: project.direction?.direction, scenes: project.scenes };
  const metadata = {
    engine: 'motion-graphics', motion_project_id: project.id, motion_job_id: job.id,
    title: project.title, caption: '', description: '', hashtags: [],
    video_url: videoUrl, video_storage_path: storagePath,
    durationSeconds: rendered.durationSeconds, orientation: project.orientation, mime: 'video/mp4',
    visual_direction: project.direction?.direction?.id,
    rendered_at: new Date().toISOString(),
  };
  let assetId = project.content_asset_id || null;
  if (!assetId) {
    const { data: existingAsset, error } = await supabase.from('content_assets').select('id')
      .contains('metadata', { motion_project_id: project.id }).limit(1).maybeSingle();
    if (error) throw new Error('Content asset recovery lookup failed: ' + error.message);
    assetId = existingAsset?.id || null;
  }
  if (assetId) {
    const { error } = await supabase.from('content_assets').update({
      title: project.title, body: '', metadata, asset_type: 'creator_video', format: 'video', status: 'draft',
    }).eq('id', assetId);
    if (error) throw new Error('Content asset update failed: ' + error.message);
  } else {
    const { data, error } = await supabase.from('content_assets').insert({
      knowledge_asset_id: project.knowledge_asset_id, asset_type: 'creator_video',
      format: 'video', title: project.title, body: '',
      metadata, status: 'draft',
    }).select('id').single();
    if (error) throw new Error('Content asset insert failed: ' + error.message);
    assetId = data.id;
  }
  assertLease(job);
  const mediaPayload = {
    content_asset_id: assetId, media_type: 'video', role: 'primary', position: 0,
    url: videoUrl, storage_path: storagePath, mime_type: 'video/mp4',
    width: rendered.dimensions.width, height: rendered.dimensions.height,
    duration_seconds: rendered.durationSeconds, file_size_bytes: rendered.buffer.length,
    source: 'render', alt_text: project.title,
  };
  let mediaId = project.media_file_id || null;
  if (!mediaId) {
    const { data: foundMedia, error } = await supabase.from('media_files').select('id')
      .eq('content_asset_id', assetId).eq('media_type', 'video').eq('role', 'primary').maybeSingle();
    if (error) throw new Error('Media recovery lookup failed: ' + error.message);
    mediaId = foundMedia?.id || null;
  }
  if (mediaId) {
    const { error } = await supabase.from('media_files').update(mediaPayload).eq('id', mediaId);
    if (error) throw new Error('Media file update failed: ' + error.message);
  } else {
    const { data, error } = await supabase.from('media_files').insert(mediaPayload).select('id').single();
    if (error) throw new Error('Media file insert failed: ' + error.message);
    mediaId = data.id;
  }
  assertLease(job);
  const { error: projectError } = await supabase.from('motion_projects').update({
    status: 'ready', stage: 'done', progress: 100, stage_message: 'Motion graphics video is ready.',
    video_url: videoUrl, video_storage_path: storagePath,
    video_size_bytes: rendered.buffer.length, duration_seconds: rendered.durationSeconds,
    content_asset_id: assetId, media_file_id: mediaId, error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  if (projectError) throw new Error('Could not mark project ready: ' + projectError.message);
  await rm(rendered.outputLocation, { force: true }).catch(() => {});
  return { assetId, mediaId, videoUrl, storagePath };
}

async function processJob(job) {
  currentJobId = job.id;
  job.leaseLost = false;
  const timer = setInterval(async () => {
    try { await heartbeat(job); }
    catch (error) { job.leaseLost = true; log('heartbeat:', error.message); }
    registerWorker().catch(() => {});
  }, HEARTBEAT_MS);
  timer.unref?.();
  try {
    let project = await loadProject(job);
    if (job.job_type === 'direction') {
      const generated = await makeDirection(job, project);
      log('direction ready:', generated.spec.direction.id, generated.spec.scenes.length, 'scenes');
    } else if (job.job_type === 'render') {
      if (!project.direction || !project.scenes?.length) throw new Error('Generate the creative direction first.');
      await narrateScenes(job, project, { scenes: project.scenes, musicPlan: project.direction?.musicPlan, direction: project.direction?.direction, seed: project.direction?.seed });
      assertLease(job);
      project = await loadProject(job);
      const rendered = await renderVideo(job, project, {
        direction: project.direction?.direction,
        scenes: project.scenes,
        musicPlan: project.direction?.musicPlan,
        seed: project.direction?.seed,
        title: project.title,
      });
      const saved = await registerVideo(job, project, rendered);
      log('render complete:', saved.videoUrl);
    } else {
      throw new Error('Unsupported Motion Graphics job type: ' + job.job_type);
    }
    assertLease(job);
    const { data: completedJob, error: completeError } = await supabase.from('motion_jobs').update({
      status: 'completed', stage: 'done', progress: 100, stage_message: 'Completed',
      result: { completedAt: new Date().toISOString() }, completed_at: new Date().toISOString(),
      claim_token: null, worker_id: null, claimed_at: null, heartbeat_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('claim_token', job.claim_token).select('id').maybeSingle();
    if (completeError) throw new Error('Could not mark job completed: ' + completeError.message);
    if (!completedJob) throw new Error('Motion job lease was lost before completion could be recorded.');
    log('completed', job.job_type, job.id);
  } catch (error) {
    await failJob(job, error);
  } finally {
    clearInterval(timer);
    currentJobId = null;
    await registerWorker().catch(() => {});
  }
}

async function tick() {
  await registerWorker();
  const { data, error } = await supabase.rpc('claim_motion_job', { p_worker_id: WORKER_ID });
  if (error) {
    lastClaimError = error.message;
    log('claim failed:', error.message);
    return 'error';
  }
  lastClaimError = null;
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return 'idle';
  log('claimed', job.job_type, job.id, 'attempt', job.attempt_count);
  await processJob(job);
  return 'processed';
}

async function runOnce() {
  const started = Date.now();
  let count = 0;
  while (!stopping && Date.now() - started < MAX_RUN_MS) {
    const result = await tick().catch((error) => { log('tick failed:', error.message); return 'error'; });
    if (result !== 'processed') break;
    count++;
  }
  log('run-once finished:', count, 'job(s)');
  if (lastClaimError) {
    console.error('[motion-worker] exiting non-zero because the queue claim failed:', lastClaimError);
    process.exit(1);
  }
  process.exit(0);
}

async function loop() {
  if (stopping) return;
  await tick().catch((error) => log('tick failed:', error.message));
  if (!stopping) setTimeout(loop, POLL_MS);
}

process.on('SIGINT', () => { stopping = true; log('stopping after current job'); });
process.on('SIGTERM', () => { stopping = true; log('stopping after current job'); });
log(WORKER_ID, 'polling every', POLL_MS, 'ms');
if (RUN_ONCE) runOnce();
else loop();
