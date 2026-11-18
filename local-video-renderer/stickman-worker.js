#!/usr/bin/env bun
// local-video-renderer/stickman-worker.js
//
// Stickman Animation Engine worker — durable pipeline modeled on
// whiteboard-worker.js. Free toolchain only:
//   - scripts:  AI SceneScript generation (lib/stickman/planner.js, same
//     multi-provider fallback chain as every other engine) with a validator
//     reflect loop. Jobs created with useAI store only the topic.
//   - narration: lib/podcastTTS.js synthesizeLine() (Gemini TTS -> free
//     edge-tts fallback), retried + normalized (PCM wrapped into RIFF/WAV).
//   - timeline: stickman-engine deterministic compiler (no AI).
//   - render:   Remotion via stickman-engine/src/render/cli.ts (bun + Chrome),
//     narration served from the job's own publicDir (no cross-job collisions).
//   - save:     knowledge_assets -> content_assets -> media_files contract
//     (idempotent, safe to retry) + optional publish_jobs auto-queueing.
//
// Reliability: atomic claim via claim_stickman_job() (SKIP LOCKED, stale-lease
// takeover, 3-strike poison pill), heartbeat lease with assertLease() guards,
// and resume from saved narration/timeline so an interrupted job continues at
// the stage that actually failed instead of starting over.
//
// Run:  bun local-video-renderer/stickman-worker.js
// Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//       (optional) STICKMAN_WORKER_POLL_MS, STICKMAN_WORKER_HEARTBEAT_MS,
//                  STICKMAN_AUTO_PUBLISH=0 to disable social auto-queueing,
//                  CHROME_PATH

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(REPO_ROOT, 'stickman-engine');

// Load these after dotenv so podcastTTS captures the configured keys.
const { synthesizeLine } = await import('../lib/podcastTTS.js');
const { withRetry, normalizeAudio } = await import('../lib/whiteboard/audio.js');
const { generateScriptWithAI, validateSceneScript } = await import('../lib/stickman/planner.js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[stickman-worker] NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WORKER_ID = `${hostname()}-stickman-${process.pid}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Math.max(3000, Number(process.env.STICKMAN_WORKER_POLL_MS || 15000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.STICKMAN_WORKER_HEARTBEAT_MS || 30000));
const RUN_ONCE = process.env.STICKMAN_RUN_ONCE === '1';
const VIDEO_BUCKET = 'lesson-videos';
const AUDIO_BUCKET = 'stickman-assets';
const AUTO_PUBLISH = process.env.STICKMAN_AUTO_PUBLISH !== '0';
// Voice mapping for the podcastTTS voice presets (host_a/host_b; falls back
// gracefully if a preset is missing).
const VOICE_BY_WHO = { narr: 'host_a', ben: 'host_a', maya: 'host_b' };
const MAX_ATTEMPTS = 3;
const STALE_LEASE_MS = 5 * 60 * 1000;

let stopping = false;
let currentJobId = null;
let registryWarned = false;
let lastClaimError = null;
const STARTED_AT = new Date().toISOString();

console.log(`[stickman-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);

// Liveness beacon: lets the admin UI tell "no worker online" from "worker busy".
async function registerWorker() {
  const { error } = await supabase.from('stickman_workers').upsert({
    worker_id: WORKER_ID,
    started_at: STARTED_AT,
    last_seen_at: new Date().toISOString(),
    current_job_id: currentJobId,
    info: { node: process.version, bun: typeof Bun !== 'undefined' ? Bun.version : null, last_error: lastClaimError },
  });
  if (error && !registryWarned) {
    registryWarned = true;
    console.warn('[stickman-worker] could not write worker liveness (is migration 20261118210000 applied?):', error.message);
  }
}

// Report real progress. Guarded by claim_token so a worker that lost its lease
// cannot overwrite state.
async function setStage(job, stage, message) {
  const { error } = await supabase.from('stickman_jobs')
    .update({ stage, stage_message: message || null, stage_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token);
  if (error) console.warn(`[stickman-worker] stage update (${stage}) failed:`, error.message);
}

function assertLease(job) {
  if (job.leaseLost) throw new Error('Job lease was lost while the worker was processing the job.');
}

async function heartbeat(job) {
  const { data, error } = await supabase
    .from('stickman_jobs')
    .update({ heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    // AI jobs sit in 'queued' while the script is being written.
    .in('status', ['queued', 'narrating', 'rendering'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Job heartbeat failed: ${error.message}`);
  if (!data) throw new Error('Job lease was lost while the worker was processing the job.');
}

async function fail(job, message) {
  const { error } = await supabase.from('stickman_jobs')
    .update({
      status: 'failed',
      stage: 'failed',
      stage_message: 'Failed',
      stage_updated_at: new Date().toISOString(),
      error_message: String(message).slice(0, 2000),
      claim_token: null,
      worker_id: null,
      claimed_at: null,
      heartbeat_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token);
  if (error) console.error(`[stickman-worker] could not record failure for ${job.id}:`, error.message);
}

// ---------------- AI script generation ----------------

async function generateScriptForJob(job) {
  const topic = String(job.topic || job.title || '').trim();
  if (!topic) throw new Error('Job has neither a script nor a topic to generate one from.');
  await setStage(job, 'scripting', `Writing stickman script for "${topic}"`);

  // A selected lesson Knowledge Asset grounds the story in real course
  // content; without one the planner still teaches established facts.
  let kaSource = '';
  let knowledgeAssetId = job.knowledge_asset_id || null;
  if (knowledgeAssetId) {
    const { data: asset, error: kaErr } = await supabase.from('knowledge_assets')
      .select('id, keyword, subject, summary, raw_content, key_concepts')
      .eq('id', knowledgeAssetId).maybeSingle();
    if (kaErr) throw new Error(`Knowledge Asset lookup failed: ${kaErr.message}`);
    if (!asset) {
      console.warn(`[stickman-worker] job ${job.id}: selected Knowledge Asset disappeared; generating without it`);
      knowledgeAssetId = null;
    } else {
      const concepts = Array.isArray(asset.key_concepts) ? asset.key_concepts.join('; ') : '';
      kaSource = [asset.summary, concepts, asset.raw_content].filter(Boolean).join('\n\n');
    }
  }

  // Generate, then validate by really running the structural validator.
  // Validation failures are fed BACK into the next prompt (reflect loop)
  // instead of blind retries — the model learns exactly which rule it broke.
  let feedback = '';
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    assertLease(job);
    try {
      const script = await generateScriptWithAI(topic, job.subject || 'general', kaSource, feedback);
      const problems = validateSceneScript(script);
      if (problems.length) throw new Error(`SceneScript validation failed: ${problems.join(' | ')}`);

      // Resolve (or create) the shared Knowledge Asset for the generated
      // lesson. content_assets requires the FK, so this must exist before
      // the save step can register the video with the Social Engine.
      if (!knowledgeAssetId) {
        knowledgeAssetId = await resolveOrCreateKnowledgeAsset(script.title, job.subject || 'general', script, job.id);
      }

      const { data: saved, error: saveErr } = await supabase.from('stickman_jobs').update({
        title: String(script.title).slice(0, 200),
        subject: job.subject || 'general',
        script_text: JSON.stringify(script),
        knowledge_asset_id: knowledgeAssetId,
        stage_message: `Script ready: ${script.scenes.length} scenes, ${Object.keys(script.cast).length} characters`,
        stage_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('claim_token', job.claim_token).select('*').maybeSingle();
      if (saveErr) throw new Error(`Could not save generated script: ${saveErr.message}`);
      if (!saved) throw new Error('Job lease was lost while the script was being generated.');
      console.log(`[stickman-worker] script ready for ${job.id}: "${script.title}" (${script.scenes.length} scenes)`);
      return saved;
    } catch (err) {
      lastErr = err;
      console.warn(`[stickman-worker] script attempt ${attempt} rejected: ${err.message}`);
      feedback =
        `IMPORTANT — your previous script was REJECTED by the validator with this error:\n"${err.message}"\n` +
        'Fix exactly this problem and return the full corrected SceneScript JSON in the same shape as before.';
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function resolveOrCreateKnowledgeAsset(keyword, subject, script, jobId) {
  const cleanKeyword = String(keyword || 'Stickman lesson').trim().slice(0, 200);
  const cleanSubject = ['biology', 'chemistry', 'physics', 'mathematics', 'general'].includes(subject) ? subject : 'general';
  const { data: found, error: findErr } = await supabase.from('knowledge_assets')
    .select('id').eq('keyword', cleanKeyword).eq('subject', cleanSubject).limit(1);
  if (findErr) throw new Error(`Knowledge Asset lookup failed: ${findErr.message}`);
  if (found?.[0]?.id) return found[0].id;

  // Pull the teaching terms the script itself carries so the asset is a
  // real (small) learning asset, not a stub of empty arrays.
  const formulaTexts = (script.scenes || [])
    .flatMap((sc) => (sc.overlays || []))
    .filter((o) => o.type === 'formula' && o.text)
    .map((o) => o.text);
  const titleOverlays = (script.scenes || [])
    .flatMap((sc) => (sc.overlays || []))
    .filter((o) => o.type === 'title' && o.text)
    .map((o) => o.text);

  const { data: created, error: createErr } = await supabase.from('knowledge_assets').insert({
    keyword: cleanKeyword,
    topic_type: cleanSubject === 'general' ? 'creator_video' : 'curriculum_topic',
    subject: cleanSubject,
    summary: `Stickman animation: ${cleanKeyword}`,
    raw_content: JSON.stringify(script).slice(0, 12000),
    learning_objectives: [],
    key_concepts: [...new Set([...titleOverlays, ...formulaTexts])].slice(0, 12),
    definitions: [],
    examples: [],
    facts: [],
    common_mistakes: [],
    sub_topics: [],
    status: 'draft',
    source: 'stickman_animation_engine',
  }).select('id').single();
  if (createErr) throw new Error(`Knowledge Asset creation failed: ${createErr.message}`);
  console.log(`[stickman-worker] created Knowledge Asset ${created.id} for job ${jobId}`);
  return created.id;
}

// ---------------- narration ----------------

/** Total dialogue lines across the script — the narration checkpoint count. */
function countDialogueLines(script) {
  return (script.scenes || []).reduce((n, sc) => n + (Array.isArray(sc.dialogue) ? sc.dialogue.length : 0), 0);
}

function narrationEntriesComplete(job, script) {
  const entries = job.audio_files;
  if (!Array.isArray(entries) || !entries.length) return false;
  if (entries.length !== countDialogueLines(script)) return false;
  return entries.every((e) => e && typeof e === 'object' && typeof e.file === 'string' && typeof e.key === 'string');
}

/** Duration of a RIFF/WAVE buffer from its header; null when not WAV. */
function wavDurationSeconds(buffer) {
  try {
    if (buffer.length < 44 || buffer.toString('latin1', 0, 4) !== 'RIFF') return null;
    let offset = 12;
    let byteRate = null;
    let dataSize = null;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString('latin1', offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === 'fmt ') byteRate = buffer.readUInt32LE(offset + 16);
      else if (chunkId === 'data') { dataSize = chunkSize; break; }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    if (byteRate && dataSize) {
      const seconds = dataSize / byteRate;
      if (isFinite(seconds) && seconds > 0.2 && seconds < 600) return seconds;
    }
    return null;
  } catch {
    return null;
  }
}

/** ffprobe for mp3 durations (never imported — spawned), else a word estimate. */
function probeDurationSeconds(file, text) {
  return new Promise((resolve) => {
    const proc = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    proc.stdout.on('data', (d) => { out += d; });
    const timer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 15000);
    proc.on('close', (code) => {
      clearTimeout(timer);
      const parsed = code === 0 ? parseFloat(out.trim()) : NaN;
      if (isFinite(parsed) && parsed > 0) resolve(Math.max(0.5, parsed));
      else resolve(Math.max(1.6, (text || '').split(/\s+/).filter(Boolean).length / 2.6 + 0.6));
    });
    proc.on('error', () => {
      clearTimeout(timer);
      resolve(Math.max(1.6, (text || '').split(/\s+/).filter(Boolean).length / 2.6 + 0.6));
    });
  });
}

/** Narrate every dialogue line; returns [{ key, file, publicUrl, dur }]. */
async function narrateScript(job, script, workDir) {
  const publicDir = path.join(workDir, 'public');
  await mkdir(path.join(publicDir, 'narration'), { recursive: true });
  const entries = [];

  for (let si = 0; si < script.scenes.length; si++) {
    const lines = script.scenes[si].dialogue || [];
    for (let li = 0; li < lines.length; li++) {
      assertLease(job);
      const line = lines[li];
      await setStage(job, 'narrating', `Narrating scene ${si + 1}, line ${li + 1} of ${lines.length}`);
      const voice = VOICE_BY_WHO[line.who] || 'host_a';
      const raw = await withRetry(() => synthesizeLine(line.text, voice, 'neutral'), {
        label: `Narration for scene ${si + 1} line ${li + 1}`,
        onRetry: (err, n) => console.warn(`[stickman-worker] TTS ${si}:${li} attempt ${n} failed: ${err.message}`),
      });
      // synthesizeLine returns a Buffer (possibly pooled) with a mimeType.
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
      const { buffer, mimeType } = normalizeAudio(buf, buf.mimeType);
      const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3';
      const key = `${si}:${li}`;
      const fileName = `${si}-${li}.${ext}`;
      const storagePath = `${job.id}/${fileName}`;
      const { error: upErr } = await supabase.storage.from(AUDIO_BUCKET)
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
      if (upErr) throw new Error(`Audio upload failed (${storagePath}): ${upErr.message}`);
      const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);

      // Local copy under the job's own public dir: staticFile('narration/…')
      // resolves per-job, so concurrent jobs can never overwrite each other.
      const localPath = path.join(publicDir, 'narration', fileName);
      await writeFile(localPath, buffer);

      const wavDur = wavDurationSeconds(buffer);
      // WAV: exact from the header. MP3: ffprobe, falling back to a word
      // estimate when ffprobe is not installed.
      const dur = wavDur ?? await probeDurationSeconds(localPath, line.text);
      entries.push({
        key,
        file: `narration/${fileName}`,       // public-relative (compiler + preview)
        storagePath,                          // Storage path (resume re-download)
        publicUrl: data?.publicUrl || null,
        dur: Math.round(dur * 100) / 100,
      });
    }
  }
  return entries;
}

/** Download previously-narrated audio (resume path) into the job publicDir. */
async function restoreNarration(job, script, workDir) {
  const publicDir = path.join(workDir, 'public');
  await mkdir(path.join(publicDir, 'narration'), { recursive: true });
  const entries = [];
  for (const e of job.audio_files) {
    // New entries carry both paths; fall back to e.file for rows written by
    // the very first (broken) worker version.
    const storagePath = e.storagePath || e.file;
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).download(storagePath);
    if (error) throw new Error(`Audio download failed (${storagePath}): ${error.message}`);
    const buffer = Buffer.from(await data.arrayBuffer());
    const localPath = path.join(publicDir, 'narration', path.basename(e.file));
    await writeFile(localPath, buffer);
    const wavDur = wavDurationSeconds(buffer);
    const dur = wavDur ?? (e.dur && e.dur > 0.2 ? e.dur : await probeDurationSeconds(localPath, ''));
    entries.push({ key: e.key, file: e.file, storagePath, publicUrl: e.publicUrl || null, dur: Math.round(dur * 100) / 100 });
  }
  // The saved entries are keyed `${si}:${li}` in compile order; keep that.
  entries.sort((a, b) => {
    const [as, al] = a.key.split(':').map(Number);
    const [bs, bl] = b.key.split(':').map(Number);
    return as - bs || al - bl;
  });
  return entries;
}

// ---------------- timeline + render ----------------

async function compileTimeline(job, script, entries, leaseJob) {
  const mod = await import(path.join(ENGINE_DIR, 'src', 'scene', 'compiler.ts'));
  const narration = {};
  for (const e of entries) narration[e.key] = { file: e.file, dur: e.dur };
  const timeline = mod.compile(script, narration);
  const { error } = await supabase.from('stickman_jobs').update({
    timeline,
    duration_seconds: timeline.durationFrames / timeline.fps,
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', leaseJob.claim_token);
  if (error) throw new Error(`Could not save compiled timeline: ${error.message}`);
  return timeline;
}

async function renderVideo(job, script, entries, workDir) {
  const jobFile = path.join(workDir, 'job.json');
  const narration = {};
  for (const e of entries) narration[e.key] = { file: e.file, dur: e.dur };
  await writeFile(jobFile, JSON.stringify({
    script,
    narration,
    out: path.join(workDir, 'out.mp4'),
    publicDir: path.join(workDir, 'public'),
    browserExecutable: process.env.CHROME_PATH || undefined,
  }));
  const cli = path.join(ENGINE_DIR, 'src', 'render', 'cli.ts');
  const args = [cli, '--job', jobFile];
  if (process.env.CHROME_PATH) args.push('--browser', process.env.CHROME_PATH);
  const proc = spawn('bun', args, { cwd: ENGINE_DIR, env: { ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (d) => process.stdout.write(`[render] ${d}`));
  let errText = '';
  proc.stderr.on('data', (d) => { errText += d; process.stderr.write(`[render] ${d}`); });
  const timeout = setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 10000); }, 45 * 60 * 1000);
  await new Promise((res, rej) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) res();
      else rej(new Error(`Render failed (exit ${code}): ${errText.slice(-4000)}`));
    });
    proc.on('error', (e) => { clearTimeout(timeout); rej(new Error(`Could not start the renderer: ${e.message}`)); });
  });
  const outPath = path.join(workDir, 'out.mp4');
  if (!existsSync(outPath)) throw new Error('Renderer produced no MP4');
  return outPath;
}

// ---------------- persistence + publishing ----------------

async function saveToInfrastructure(job, outPath, entries, timeline) {
  const buffer = await readFile(outPath);
  if (!buffer.length) throw new Error('Renderer produced an empty MP4.');
  if (!job.knowledge_asset_id) {
    throw new Error('Job is missing knowledge_asset_id; refusing to create an orphan Social Engine asset.');
  }

  await setStage(job, 'uploading', 'Uploading video and registering it with the Social Engine');
  const slug = String(job.title || 'stickman').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stickman';
  // Stable path means a retry overwrites the same object instead of leaving
  // timestamped orphan MP4s in Storage.
  const storagePath = `stickman/${job.id}/${slug}.mp4`;
  const { error: upErr } = await supabase.storage.from(VIDEO_BUCKET)
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });
  if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
  const { data: publicData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Could not resolve the uploaded video URL.');

  const durationSeconds = timeline.durationFrames / timeline.fps;
  const metadata = {
    stickman_job_id: job.id,
    title: job.title,
    caption: `${job.title} — stickman lesson by Shiney Brain Academy`,
    topic: job.topic,
    subject: job.subject || 'general',
    mime: 'video/mp4',
    video_url: videoUrl,
    video_storage_path: storagePath,
    durationSeconds,
    rendered_at: new Date().toISOString(),
    engine: 'stickman-v1',
  };

  // metadata.stickman_job_id is the recovery key if the worker dies after
  // inserting an asset but before saving its id on stickman_jobs.
  let assetId = job.content_asset_id || null;
  if (!assetId) {
    const { data: existingAsset, error: findAssetError } = await supabase
      .from('content_assets')
      .select('id')
      .contains('metadata', { stickman_job_id: job.id })
      .limit(1)
      .maybeSingle();
    if (findAssetError) throw new Error(`Content asset lookup failed: ${findAssetError.message}`);
    assetId = existingAsset?.id || null;
  }

  if (assetId) {
    const { error } = await supabase.from('content_assets').update({
      title: job.title,
      body: metadata.caption,
      metadata,
      asset_type: 'creator_video',
      format: 'video',
      status: 'draft',
    }).eq('id', assetId);
    if (error) throw new Error(`Content asset update failed: ${error.message}`);
  } else {
    const { data: asset, error } = await supabase.from('content_assets').insert({
      knowledge_asset_id: job.knowledge_asset_id,
      asset_type: 'creator_video',
      format: 'video',
      title: job.title,
      body: metadata.caption,
      status: 'draft',
      metadata,
    }).select('id').single();
    if (error) throw new Error(`Content asset insert failed: ${error.message}`);
    assetId = asset.id;
  }

  // Persist the asset id before creating media, so subsequent retries reuse it.
  const { error: assetLinkError } = await supabase.from('stickman_jobs')
    .update({ content_asset_id: assetId, storage_path: storagePath, video_url: videoUrl, updated_at: new Date().toISOString() })
    .eq('id', job.id).eq('claim_token', job.claim_token);
  if (assetLinkError) throw new Error(`Could not link content asset to job: ${assetLinkError.message}`);

  const mediaPayload = {
    content_asset_id: assetId,
    media_type: 'video',
    role: 'primary',
    position: 0,
    storage_path: storagePath,
    mime_type: 'video/mp4',
    file_size_bytes: buffer.length,
    duration_seconds: durationSeconds,
    source: 'render',
    alt_text: job.title,
  };

  let mediaId = job.media_file_id || null;
  if (!mediaId) {
    const { data: existingMedia, error: findMediaError } = await supabase.from('media_files')
      .select('id')
      .eq('content_asset_id', assetId)
      .eq('media_type', 'video')
      .eq('role', 'primary')
      .maybeSingle();
    if (findMediaError) throw new Error(`Media lookup failed: ${findMediaError.message}`);
    mediaId = existingMedia?.id || null;
  }

  if (mediaId) {
    const { error } = await supabase.from('media_files').update(mediaPayload).eq('id', mediaId);
    if (error) throw new Error(`Media file update failed: ${error.message}`);
  } else {
    const { data: media, error } = await supabase.from('media_files').insert(mediaPayload).select('id').single();
    if (error) throw new Error(`Media file insert failed: ${error.message}`);
    mediaId = media.id;
  }

  // Social publishing: queue publish_jobs for the active video channels BEFORE
  // marking the job ready, so "ready" means the video also left the content
  // library (same contract as quote-loops auto-publish). Best-effort: a
  // publishing hiccup must not fail a successfully rendered video.
  if (AUTO_PUBLISH && job.auto_publish !== false) {
    try {
      // Idempotent: a retry that finds an already-registered asset must not
      // queue the same video for publishing twice.
      const { data: existingPublishJobs } = await supabase.from('publish_jobs')
        .select('id')
        .eq('content_asset_id', assetId)
        .eq('created_by', 'stickman-auto-publish')
        .limit(1);
      let queued = 0;
      if (!existingPublishJobs?.length) {
        const { data: channels } = await supabase.from('social_channels_v2')
          .select('id, platform')
          .eq('is_active', true)
          .in('platform', ['youtube', 'tiktok', 'instagram', 'facebook', 'linkedin', 'telegram']);
        const videoPlatforms = ['youtube', 'tiktok', 'instagram', 'facebook'];
        const jobsToCreate = (channels || [])
          .filter((channel) => videoPlatforms.includes(channel.platform))
          .map((channel) => ({
            content_asset_id: assetId,
            channel_id: channel.id,
            status: 'queued',
            created_by: 'stickman-auto-publish',
          }));
        if (jobsToCreate.length) {
          const { error: pubErr } = await supabase.from('publish_jobs').insert(jobsToCreate);
          if (pubErr) throw new Error(pubErr.message);
          queued = jobsToCreate.length;
          console.log(`[stickman-worker] queued ${queued} publish job(s) for asset ${assetId}`);
        }
      }
      await supabase.from('stickman_jobs').update({
        warnings: [`auto-publish: ${queued} publish job(s) queued`],
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    } catch (pubErr) {
      console.warn(`[stickman-worker] auto-publish queueing failed for job ${job.id}:`, pubErr.message);
      await supabase.from('stickman_jobs').update({
        warnings: [`auto-publish failed: ${String(pubErr.message).slice(0, 200)}`],
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
    }
  }

  const { data: completed, error: completeError } = await supabase.from('stickman_jobs')
    .update({
      status: 'ready',
      stage: 'completed',
      stage_message: 'Video is ready',
      stage_updated_at: new Date().toISOString(),
      video_url: videoUrl,
      storage_path: storagePath,
      content_asset_id: assetId,
      media_file_id: mediaId,
      knowledge_asset_id: job.knowledge_asset_id,
      error_message: null,
      claim_token: null,
      worker_id: null,
      claimed_at: null,
      heartbeat_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    .select('id')
    .maybeSingle();
  if (completeError) throw new Error(`Could not mark job ready: ${completeError.message}`);
  if (!completed) throw new Error('Job lease was lost before completion could be recorded.');

  await rm(path.dirname(outPath), { recursive: true, force: true }).catch(() => {});
  console.log(`[stickman-worker] job ${job.id} ready → ${videoUrl}`);
}

// ---------------- pipeline ----------------

async function processJob(job) {
  currentJobId = job.id;
  job.leaseLost = false;
  const heartbeatTimer = setInterval(() => {
    heartbeat(job).catch((err) => {
      console.error(`[stickman-worker] heartbeat error for ${job.id}:`, err.message);
      if (/lease was lost/i.test(err.message)) job.leaseLost = true;
    });
    registerWorker().catch(() => {});
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();

  const workDir = path.join(ENGINE_DIR, '.job-' + job.id);
  try {
    let prepared = job;
    // AI jobs arrive without a script: the web route only stores the topic so
    // the slow multi-provider LLM call never runs inside a serverless function.
    if (!String(job.script_text || '').trim()) {
      prepared = await generateScriptForJob(job);
    } else {
      const parsedScript = JSON.parse(job.script_text);
      const problems = validateSceneScript(parsedScript);
      if (problems.length) throw new Error(`Stored SceneScript is invalid: ${problems.join(' | ')}`);
      if (!prepared.knowledge_asset_id) {
        const kaId = await resolveOrCreateKnowledgeAsset(parsedScript.title, prepared.subject || 'general', parsedScript, job.id);
        await supabase.from('stickman_jobs').update({
          knowledge_asset_id: kaId, updated_at: new Date().toISOString(),
        }).eq('id', job.id).eq('claim_token', job.claim_token);
        prepared = { ...prepared, knowledge_asset_id: kaId };
      }
    }
    const script = JSON.parse(prepared.script_text);

    const hasTimeline = !!prepared.timeline && Array.isArray(prepared.timeline.audio);
    let entries;
    let timeline = null;
    if (hasTimeline && narrationEntriesComplete(prepared, script)) {
      // Resume: narration + timeline already survived a previous run.
      await setStage(prepared, 'rendering', 'Resuming with saved narration and timeline');
      entries = await restoreNarration(prepared, script, workDir);
      timeline = prepared.timeline;
      console.log(`[stickman-worker] job ${prepared.id}: resuming from saved narration (${entries.length} clips)`);
    } else {
      await setStage(prepared, 'narrating', 'Narrating dialogue lines (free TTS)');
      entries = await narrateScript(prepared, script, workDir);
      await supabase.from('stickman_jobs').update({
        audio_files: entries,
        status: 'rendering',
        updated_at: new Date().toISOString(),
      }).eq('id', prepared.id).eq('claim_token', prepared.claim_token);
      await setStage(prepared, 'rendering', 'Compiling deterministic timeline');
      timeline = await compileTimeline(prepared, script, entries, prepared);
    }

    assertLease(job);
    const outPath = await renderVideo(prepared, script, entries, workDir);
    assertLease(job);
    await saveToInfrastructure(prepared, outPath, entries, timeline);
  } catch (err) {
    console.error(`[stickman-worker] job ${job.id} failed:`, err);
    await fail(job, err?.message || String(err));
  } finally {
    clearInterval(heartbeatTimer);
    currentJobId = null;
    registerWorker().catch(() => {});
    // Remove temporary narration, job file and rendered MP4 after processing.
    await rm(workDir, { recursive: true, force: true }).catch((err) => {
      console.warn(`[stickman-worker] cleanup failed for ${job.id}:`, err.message);
    });
  }
}

async function tick() {
  await registerWorker();
  let job = null;
  try {
    const { data, error } = await supabase.rpc('claim_stickman_job', { p_worker_id: WORKER_ID });
    if (error) {
      lastClaimError = error.message; // surfaced in the admin UI via stickman_workers.info
      console.error('[stickman-worker] claim error:', error.message);
      return 'error';
    }
    lastClaimError = null;
    job = Array.isArray(data) ? (data[0] || null) : (data || null);
  } catch (e) {
    lastClaimError = e.message;
    console.error('[stickman-worker] claim error:', e.message);
    return 'error';
  }
  if (!job) return 'idle';
  console.log(`[stickman-worker] claimed ${job.id} "${job.title}" (attempt ${job.attempt_count})`);
  await processJob(job);
  return 'processed';
}

// RUN_ONCE mode (GitHub Actions): drain the queue, then exit so no always-on
// server is needed.
const RUN_ONCE_MAX_MS = Number(process.env.STICKMAN_RUN_ONCE_MAX_MS || 40 * 60 * 1000);

async function runOnce() {
  const startedAt = Date.now();
  let processed = 0;
  let exitCode = 0;
  while (!stopping && Date.now() - startedAt < RUN_ONCE_MAX_MS) {
    let result;
    try {
      result = await tick();
    } catch (err) {
      console.error('[stickman-worker] tick error:', err);
      result = 'error';
    }
    if (result === 'error') { exitCode = 1; break; }
    if (result === 'idle') break;
    processed += 1;
  }
  console.log(`[stickman-worker] run-once finished: ${processed} job(s) processed`);
  process.exit(exitCode);
}

async function loop() {
  if (stopping) return;
  try {
    await tick();
  } catch (err) {
    console.error('[stickman-worker] tick error:', err);
  }
  if (!stopping) setTimeout(loop, POLL_MS);
}

process.on('SIGINT', () => { stopping = true; console.log('[stickman-worker] stopping after current job'); });
process.on('SIGTERM', () => { stopping = true; console.log('[stickman-worker] stopping after current job'); });

if (RUN_ONCE) runOnce();
else loop();
