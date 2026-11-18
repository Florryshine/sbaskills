#!/usr/bin/env bun
// local-video-renderer/stickman-worker.js
//
// Stickman Animation Engine worker. Free toolchain only:
//   - narration: lib/podcastTTS.js synthesizeLine() (Gemini TTS -> free
//     edge-tts fallback, exactly the whiteboard engine's voice stack)
//   - timeline: stickman-engine deterministic compiler (no AI)
//   - render:   Remotion on this machine (bun), saved through the standard
//               lesson-videos -> content_assets -> media_files contract
//
// Run:  bun local-video-renderer/stickman-worker.js
// Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//       (optional) STICKMAN_WORKER_POLL_MS, CHROME_PATH

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(REPO_ROOT, 'stickman-engine');

const { synthesizeLine } = await import('../lib/podcastTTS.js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[stickman-worker] NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const WORKER_ID = `stickman-${process.pid}-${Date.now().toString(36)}`;
const POLL_MS = Math.max(3000, Number(process.env.STICKMAN_WORKER_POLL_MS || 15000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.STICKMAN_WORKER_HEARTBEAT_MS || 30000));
const RUN_ONCE = process.env.STICKMAN_RUN_ONCE === '1';
const VIDEO_BUCKET = 'lesson-videos';
const AUDIO_BUCKET = 'stickman-assets';
// Voice mapping for the podcastTTS voice presets (host_a/host_b; falls back
// gracefully if a preset is missing).
const VOICE_BY_WHO = { narr: 'host_a', ben: 'host_a', maya: 'host_b' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stopped = Symbol('stopped');

async function claimJob() {
  const { data, error } = await supabase.rpc('claim_stickman_job', { p_worker_id: WORKER_ID });
  if (error) throw new Error(`claim failed: ${error.message}`);
  return data && data[0] ? data[0] : null;
}

async function setStage(job, stage, message) {
  await supabase.from('stickman_jobs').update({
    status: stage === 'ready' ? 'ready' : stage === 'failed' ? 'failed' : stage,
    stage,
    stage_message: message,
    stage_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);
  console.log(`[stickman-worker] job ${job.id} -> ${stage}: ${message}`);
}

function startHeartbeat(job) {
  const t = setInterval(async () => {
    try {
      await supabase.rpc('stickman_heartbeat', { p_job_id: job.id, p_claim_token: job.claim_token, p_stage: null });
    } catch {
      /* heartbeat failures are retried on the next tick */
    }
  }, HEARTBEAT_MS);
  return () => clearInterval(t);
}

async function failJob(job, err) {
  console.error(`[stickman-worker] job ${job.id} failed:`, err.message);
  await supabase.from('stickman_jobs').update({
    status: 'failed',
    stage: 'failed',
    stage_message: err.message.slice(0, 200),
    error_message: err.message.slice(0, 2000),
    stage_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);
}

/** Narrate every dialogue line with the platform's free TTS stack. */
async function narrateScript(job, script) {
  const narration = {};
  const audioFiles = [];
  const workDir = path.join(ENGINE_DIR, 'out', 'jobs', job.id);
  await mkdir(workDir, { recursive: true });

  for (let si = 0; si < script.scenes.length; si++) {
    const lines = script.scenes[si].dialogue || [];
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const voice = VOICE_BY_WHO[line.who] || 'host_a';
      const raw = await synthesizeLine(line.text, voice, 'neutral');
      const buf = raw && raw.buffer ? Buffer.from(raw.buffer) : Buffer.from(raw);
      const key = `${si}:${li}`;
      const storagePath = `${job.id}/${key}.mp3`;
      const { error: upErr } = await supabase.storage.from(AUDIO_BUCKET)
        .upload(storagePath, buf, { contentType: 'audio/mpeg', upsert: true });
      if (upErr) throw new Error(`audio upload failed: ${upErr.message}`);

      // local copy for the Remotion public dir (staticFile)
      const localPath = path.join(ENGINE_DIR, 'public', 'narration', `${key}.mp3`);
      await writeFile(localPath, buf);

      // duration: WAV header says RIFF; mp3 durations are measured by the
      // render CLI through ffprobe when available, else estimated.
      narration[key] = { file: `narration/${key}.mp3`, dur: 0, _local: localPath };
      audioFiles.push(storagePath);
    }
  }
  return { narration, audioFiles, workDir };
}

/** Ask ffprobe for mp3 durations (falls back to character-count estimate). */
async function measureDurations(narration) {
  for (const [key, n] of Object.entries(narration)) {
    try {
      const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', n._local]);
      let out = '';
      proc.stdout.on('data', (d) => { out += d; });
      await new Promise((res, rej) => {
        proc.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffprobe exit ${code}`))));
        proc.on('error', rej);
      });
      n.dur = Math.max(0.5, parseFloat(out.trim()) || 2);
    } catch {
      n.dur = 2;
      console.warn(`[stickman-worker] ffprobe unavailable; estimating duration for ${key}`);
    }
  }
}

async function compileTimeline(job, script, narration) {
  // The compiler is TypeScript; under Bun we can import it directly.
  const mod = await import(path.join(ENGINE_DIR, 'src', 'scene', 'compiler.ts'));
  const clean = {};
  for (const [k, v] of Object.entries(narration)) clean[k] = { file: v.file, dur: v.dur };
  const timeline = mod.compile(script, clean);
  await supabase.from('stickman_jobs').update({
    timeline,
    duration_seconds: timeline.durationFrames / timeline.fps,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);
  return timeline;
}

async function renderVideo(job, script, narration, workDir) {
  const jobFile = path.join(workDir, 'job.json');
  await writeFile(jobFile, JSON.stringify({ script, narration: cleanNarration(narration), out: path.join(workDir, 'out.mp4') }));
  const cli = path.join(ENGINE_DIR, 'src', 'render', 'cli.ts');
  const env = { ...process.env };
  if (process.env.CHROME_PATH) env.STICKMAN_BROWSER = process.env.CHROME_PATH;
  const args = [cli, '--job', jobFile];
  if (process.env.CHROME_PATH) args.push('--browser', process.env.CHROME_PATH);
  const proc = spawn('bun', args, { cwd: ENGINE_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (d) => process.stdout.write(`[render] ${d}`));
  let errText = '';
  proc.stderr.on('data', (d) => { errText += d; process.stderr.write(`[render] ${d}`); });
  await new Promise((res, rej) => {
    proc.on('close', (code) => (code === 0 ? res() : rej(new Error(`renderer exited ${code}: ${errText.slice(-800)}`))));
    proc.on('error', rej);
  });
  const outPath = path.join(workDir, 'out.mp4');
  if (!existsSync(outPath)) throw new Error('renderer produced no MP4');
  return outPath;
}

function cleanNarration(narration) {
  const out = {};
  for (const [k, v] of Object.entries(narration)) out[k] = { file: v.file, dur: v.dur };
  return out;
}

async function saveToInfrastructure(job, outPath, timeline) {
  const buffer = await readFile(outPath);
  if (!buffer.length) throw new Error('Renderer produced an empty MP4.');

  // content_assets requires a knowledge_assets parent (same as whiteboard).
  let knowledgeAssetId = job.knowledge_asset_id || null;
  if (!knowledgeAssetId) {
    const { data: found, error: findErr } = await supabase.from('knowledge_assets')
      .select('id').eq('title', 'Stickman Animation Engine').limit(1);
    if (findErr) throw new Error(`Knowledge Asset lookup failed: ${findErr.message}`);
    knowledgeAssetId = found?.[0]?.id || null;
    if (!knowledgeAssetId) {
      const { data: created, error: createErr } = await supabase.from('knowledge_assets').insert({
        title: 'Stickman Animation Engine',
        description: 'Videos produced by the stickman animation engine',
        subject: 'stickman-animation',
        source_type: 'generated',
        body: 'Reusable stickman character cast, environments and motion library.',
      }).select('id').single();
      if (createErr) throw new Error(`Knowledge Asset creation failed: ${createErr.message}`);
      knowledgeAssetId = created.id;
    }
  }

  await setStage(job, 'uploading', 'Uploading video and registering it with the Social Engine');
  const slug = (job.title || 'stickman').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stickman';
  const storagePath = `stickman/${job.id}/${slug}.mp4`;
  const { error: upErr } = await supabase.storage.from(VIDEO_BUCKET)
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });
  if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
  const { data: publicData } = await supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Could not resolve the uploaded video URL.');

  const metadata = {
    stickman_job_id: job.id,
    title: job.title,
    caption: `${job.title} - stickman animation`,
    topic: job.topic,
    subject: 'stickman-animation',
    mime: 'video/mp4',
    video_url: videoUrl,
    video_storage_path: storagePath,
    durationSeconds: timeline.durationFrames / timeline.fps,
    rendered_at: new Date().toISOString(),
    engine: 'stickman-v1',
  };

  const { data: asset, error: assetErr } = await supabase.from('content_assets').insert({
    knowledge_asset_id: knowledgeAssetId,
    asset_type: 'creator_video',
    format: 'video',
    title: job.title,
    body: metadata.caption,
    status: 'draft',
    metadata,
  }).select('id').single();
  if (assetErr) throw new Error(`Content asset insert failed: ${assetErr.message}`);

  const mediaPayload = {
    content_asset_id: asset.id,
    media_type: 'video',
    role: 'primary',
    position: 0,
    url: videoUrl,
    storage_path: storagePath,
    mime_type: 'video/mp4',
    file_size_bytes: buffer.length,
    duration_seconds: timeline.durationFrames / timeline.fps,
    source: 'render',
    alt_text: job.title,
  };
  const { data: media, error: mediaErr } = await supabase.from('media_files')
    .insert(mediaPayload).select('id').single();
  if (mediaErr) throw new Error(`Media file insert failed: ${mediaErr.message}`);

  await supabase.from('stickman_jobs').update({
    status: 'ready',
    stage: 'ready',
    stage_message: 'Video is ready',
    stage_updated_at: new Date().toISOString(),
    video_url: videoUrl,
    storage_path: storagePath,
    content_asset_id: asset.id,
    media_file_id: media.id,
    knowledge_asset_id: knowledgeAssetId,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);
  console.log(`[stickman-worker] job ${job.id} ready: ${videoUrl}`);
}

async function processJob(job) {
  const stopHeartbeat = startHeartbeat(job);
  try {
    const script = JSON.parse(job.script_text);
    await setStage(job, 'narrating', 'Narrating dialogue lines (free TTS)');
    const { narration, audioFiles, workDir } = await narrateScript(job, script);
    await measureDurations(narration);
    await supabase.from('stickman_jobs').update({
      audio_files: audioFiles, updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('claim_token', job.claim_token);

    await setStage(job, 'rendering', 'Compiling deterministic timeline and rendering');
    const timeline = await compileTimeline(job, script, narration);
    const outPath = await renderVideo(job, script, narration, workDir);
    await saveToInfrastructure(job, outPath, timeline);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  } catch (err) {
    await failJob(job, err);
  } finally {
    stopHeartbeat();
  }
}

async function main() {
  console.log(`[stickman-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);
  const deadline = RUN_ONCE ? Date.now() + Number(process.env.STICKMAN_RUN_ONCE_MAX_MS || 40 * 60 * 1000) : Infinity;
  while (Date.now() < deadline) {
    let job = null;
    try {
      job = await claimJob();
    } catch (e) {
      console.error('[stickman-worker] claim error:', e.message);
    }
    if (job) {
      await processJob(job);
      if (RUN_ONCE) break;
      continue;
    }
    await sleep(POLL_MS);
  }
  void stopped;
}

main().then(() => {
  console.log('[stickman-worker] bye');
  process.exit(0);
}).catch((e) => {
  console.error('[stickman-worker] fatal:', e);
  process.exit(1);
});
