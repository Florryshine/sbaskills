#!/usr/bin/env bun
// local-video-renderer/visual-learning-worker.js
//
// Visual Learning Video Production Engine worker — durable pipeline modeled on
// stickman-worker.js. Free toolchain only:
//   - scripts:  lib/visual-learning/planner.js (shared LLM fallback chain →
//               z-ai CLI in dev → deterministic engine architect). Jobs may
//               also carry a pasted script, which is used as-is.
//   - narration: visual-learning-engine providers (Gemini TTS → Edge → proxy
//               → z-ai dev), loudness-normalized, real
//               word timestamps when the provider exposes them.
//   - imagery:  visual-learning-engine providers — multi-shot scenes (no
//               image on screen longer than 3s) from pollinations, pexels,
//               pixabay, wikimedia, openverse and engine-drawn SVG cards.
//   - music:    procedural ambient bed generated in-process (no service).
//   - timeline: engine deterministic builder (no AI; preview == render).
//   - render:   Remotion via visual-learning-engine/src/render/cli.ts
//               (bun + Chrome), narration/music muxed by Remotion.
//   - save:     content_assets → media_files contract (idempotent) + optional
//               publish_jobs auto-queueing, same as the other engines.
//
// Reliability: atomic claim via claim_visual_learning_job() (SKIP LOCKED,
// stale-lease takeover, 3-strike poison pill), heartbeat lease with
// assertLease() guards, and resume from saved artifacts (script, image
// manifest, narration manifest, timeline) so an interrupted job continues at
// the stage that actually failed.
//
// Run:  bun local-video-renderer/visual-learning-worker.js
// Env:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//       (optional) VISUAL_LEARNING_WORKER_POLL_MS, VISUAL_LEARNING_RUN_ONCE=1,
//                  VISUAL_LEARNING_AUTO_PUBLISH=0, CHROME_PATH,
//                  TTS_ENDPOINT (free public edge-tts proxy),
//                  PEXELS_API_KEY, PIXABAY_API_KEY (free stock-image keys),
//                  VL_NARRATION_PROVIDER (gemini|edge|proxy), VL_IMAGE_PROVIDER,
//                  VL_MAX_SHOT_SECONDS (default 3), VL_WORK_CONCURRENCY

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { hostname } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ENGINE_DIR = path.join(REPO_ROOT, 'visual-learning-engine');

// Engine modules (TypeScript, executed by bun).
const { validateScript } = await import('../visual-learning-engine/src/script/schema');
const { buildTimeline } = await import('../visual-learning-engine/src/timeline/builder');
const { prepareNarration, prepareImages, prepareMusic } = await import('../visual-learning-engine/src/prepare');
const { generateVisualLearningScript } = await import('../lib/visual-learning/planner.js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[visual-learning-worker] NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const WORKER_ID = `${hostname()}-vislearn-${process.pid}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Math.max(3000, Number(process.env.VISUAL_LEARNING_WORKER_POLL_MS || 15000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.VISUAL_LEARNING_WORKER_HEARTBEAT_MS || 30000));
const RUN_ONCE = process.env.VISUAL_LEARNING_RUN_ONCE === '1';
const RUN_ONCE_MAX_MS = Number(process.env.VISUAL_LEARNING_RUN_ONCE_MAX_MS || 60 * 60 * 1000);
const VIDEO_BUCKET = 'lesson-videos';
const ASSETS_BUCKET = 'visual-learning-assets';
const AUTO_PUBLISH = process.env.VISUAL_LEARNING_AUTO_PUBLISH !== '0';

let stopping = false;
let currentJobId = null;
let registryWarned = false;
let lastClaimError = null;
const STARTED_AT = new Date().toISOString();

console.log(`[visual-learning-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);

// Liveness beacon: lets the admin UI tell "no worker online" from "worker busy".
async function registerWorker() {
  const { error } = await supabase.from('visual_learning_workers').upsert({
    worker_id: WORKER_ID,
    started_at: STARTED_AT,
    last_seen_at: new Date().toISOString(),
    current_job_id: currentJobId,
    info: {
      node: process.version,
      bun: typeof Bun !== 'undefined' ? Bun.version : null,
      last_error: lastClaimError,
      stock_keys: { pexels: Boolean(process.env.PEXELS_API_KEY), pixabay: Boolean(process.env.PIXABAY_API_KEY) },
    },
  });
  if (error && !registryWarned) {
    registryWarned = true;
    console.warn('[visual-learning-worker] could not write worker liveness (is migration 20261119_visual_learning_jobs.sql applied?):', error.message);
  }
}

async function setStage(job, stage, message) {
  const { error } = await supabase.from('visual_learning_jobs')
    .update({ stage, stage_message: message || null, stage_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token);
  if (error) console.warn(`[visual-learning-worker] stage update (${stage}) failed:`, error.message);
}

function assertLease(job) {
  if (job.leaseLost) throw new Error('Job lease was lost while the worker was processing the job.');
}

async function heartbeat(job) {
  const { data, error } = await supabase
    .from('visual_learning_jobs')
    .update({ heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    .in('status', ['queued', 'scripting', 'imagery', 'narrating', 'timeline', 'rendering', 'saving'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Job heartbeat failed: ${error.message}`);
  if (!data) throw new Error('Job lease was lost while the worker was processing the job.');
}

async function fail(job, message) {
  const { error } = await supabase.from('visual_learning_jobs')
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
  if (error) console.error(`[visual-learning-worker] could not record failure for ${job.id}:`, error.message);
}

// ---------------- spec ----------------

function specFromJob(job) {
  const raw = (job.spec && typeof job.spec === 'object') ? job.spec : {};
  const aspect = ['16:9', '9:16', '1:1'].includes(raw.aspect) ? raw.aspect : '16:9';
  const style = ['cartoon', 'photo', 'sketch'].includes(raw.style) ? raw.style : 'cartoon';
  const voice = typeof raw.voice === 'string' && raw.voice ? raw.voice : 'warm_male';
  const targetSeconds = Math.max(20, Math.min(900, Number(raw.targetSeconds) || 120));
  return {
    title: String(job.title || raw.title || job.topic || 'Visual learning episode').slice(0, 120),
    topic: String(job.topic || job.title || 'learning').slice(0, 300),
    audience: String(raw.audience || 'students').slice(0, 120),
    tone: String(raw.tone || 'warm and curious').slice(0, 120),
    targetSeconds,
    aspect,
    style,
    voice,
    accent: /^#[0-9a-fA-F]{6}$/.test(String(raw.accent)) ? String(raw.accent) : '',
    music: raw.music !== false,
    subtitles: raw.subtitles !== false,
    seed: Number(raw.seed) || Math.floor((Date.now() % 100000) + job.id.length),
    maxShotSeconds: Math.max(1.5, Math.min(10, Number(raw.maxShotSeconds ?? process.env.VL_MAX_SHOT_SECONDS) || 3)),
    narrationProvider: ['gemini', 'edge', 'proxy', 'zai'].includes(process.env.VL_NARRATION_PROVIDER) ? process.env.VL_NARRATION_PROVIDER : 'gemini',
    imageProvider: ['pollinations', 'pexels', 'pixabay', 'wikimedia', 'openverse', 'placeholder'].includes(process.env.VL_IMAGE_PROVIDER) ? process.env.VL_IMAGE_PROVIDER : (raw.imageProvider || undefined),
    watermark: String(raw.watermark ?? 'Shiney Brain Academy').slice(0, 60),
    keyPoints: Array.isArray(raw.keyPoints) ? raw.keyPoints.map((k) => String(k).slice(0, 200)).slice(0, 8) : undefined,
    script: undefined,
  };
}

// ---------------- scripting ----------------

async function resolveOrCreateKnowledgeAsset(keyword, subject, script, jobId) {
  const cleanKeyword = String(keyword || 'Visual learning lesson').trim().slice(0, 200);
  const cleanSubject = ['biology', 'chemistry', 'physics', 'mathematics', 'general'].includes(String(subject || '').toLowerCase()) ? String(subject).toLowerCase() : 'general';
  const { data: found, error: findErr } = await supabase.from('knowledge_assets')
    .select('id').eq('keyword', cleanKeyword).eq('subject', cleanSubject).limit(1);
  if (findErr) throw new Error(`Knowledge Asset lookup failed: ${findErr.message}`);
  if (found?.[0]?.id) return found[0].id;

  const concepts = (script.scenes || [])
    .map((s) => (s.headline || s.title || ''))
    .filter(Boolean)
    .slice(0, 12);

  const { data: created, error: createErr } = await supabase.from('knowledge_assets').insert({
    keyword: cleanKeyword,
    topic_type: cleanSubject === 'general' ? 'creator_video' : 'curriculum_topic',
    subject: cleanSubject,
    summary: `Visual learning episode: ${cleanKeyword}`,
    raw_content: JSON.stringify({ meta: script.meta, sceneCount: script.scenes?.length }).slice(0, 12000),
    learning_objectives: [],
    key_concepts: concepts,
    definitions: [],
    examples: [],
    facts: [],
    common_mistakes: [],
    sub_topics: [],
    status: 'draft',
    source: 'visual_learning_engine',
  }).select('id').single();
  if (createErr) throw new Error(`Knowledge Asset creation failed: ${createErr.message}`);
  console.log(`[visual-learning-worker] created Knowledge Asset ${created.id} for job ${jobId}`);
  return created.id;
}

async function scriptForJob(job, spec) {
  if (job.script && typeof job.script === 'object' && Array.isArray(job.script.scenes) && job.script.scenes.length > 0) {
    const script = validateScript(job.script, { title: spec.title, topic: spec.topic, audience: spec.audience, aspect: spec.aspect, accent: spec.accent });
    await setStage(job, 'scripting', `Using provided script: ${script.scenes.length} scenes`);
    return { script, provider: 'provided', fallback: false };
  }
  await setStage(job, 'scripting', `Writing script for "${spec.topic}"`);
  return generateVisualLearningScript(spec);
}

// ---------------- prep (narration + imagery + music) ----------------

async function prepareEpisodeAssets(job, spec, script, workDir) {
  const publicDir = path.join(workDir, 'public');
  await mkdir(publicDir, { recursive: true });

  // Imagery (resumable: existing files are kept). Multi-shot: no image stays
  // on screen longer than spec.maxShotSeconds (default 3s).
  await setStage(job, 'imagery', `Preparing shot illustrations (${script.scenes.length} scenes, <=${spec.maxShotSeconds}s per image)`);
  const images = await prepareImages(script, spec, {
    publicDir,
    imageProvider: spec.imageProvider,
    imageConcurrency: Math.max(1, Number(process.env.VL_WORK_CONCURRENCY || 3)),
    maxShotSeconds: spec.maxShotSeconds,
    proxyEndpoint: process.env.TTS_ENDPOINT,
    onProgress: async (stage, message) => {
      if (stage === 'imagery') await setStage(job, 'imagery', message);
    },
  });

  // Narration (resumable per scene).
  await setStage(job, 'narrating', 'Narrating scenes (Gemini TTS primary; fallbacks enabled)');
  const narration = await prepareNarration(script, spec, {
    publicDir,
    narrationProvider: spec.narrationProvider,
    proxyEndpoint: process.env.TTS_ENDPOINT,
    onProgress: async (stage, message) => {
      if (stage === 'narrating') await setStage(job, 'narrating', message);
    },
  });
  const silentClips = narration.clips.filter((clip) => clip.provider === 'silent' || clip.voice === 'none');
  if (silentClips.length > 0) {
    throw new Error(`Narration validation failed: ${silentClips.length} scene(s) have no spoken audio. Refusing to render a silent lesson.`);
  }
  if (!narration.clips.length || narration.clips.length !== script.scenes.length) {
    throw new Error(`Narration validation failed: expected ${script.scenes.length} spoken clips, received ${narration.clips.length}.`);
  }

  // Music bed.
  const musicFile = await prepareMusic(spec, script, narration, { publicDir });

  return { images, narration, musicFile, publicDir };
}

// ---------------- render ----------------

async function renderVideo(job, spec, script, prepared, workDir) {
  const outPath = path.join(workDir, 'out.mp4');
  const jobFile = path.join(workDir, 'render-job.json');
  await writeFile(jobFile, JSON.stringify({
    spec,
    script,
    narration: prepared.narration,
    images: prepared.images,
    musicFile: prepared.musicFile,
  }));

  // Persist artifacts for preview + resume before the slow render.
  await setStage(job, 'timeline', 'Building deterministic timeline');
  const timeline = buildTimeline({
    script,
    narration: prepared.narration,
    aspect: spec.aspect,
    musicFile: prepared.musicFile,
    subtitles: spec.subtitles,
    watermark: spec.watermark,
    images: prepared.images,
  });

  // Upload every preview asset (narration/images/music) to the public
  // visual-learning-assets bucket so the admin studio's @remotion/player can
  // resolve them without touching the render public dir.
  const assetBasePath = `visual-learning/${job.id}`;
  const mimeByExt = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
  const collectFiles = (dir) => {
    const out = [];
    const walk = (d) => {
      let entries = [];
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else out.push(full);
      }
    };
    walk(dir);
    return out;
  };
  try {
    const files = collectFiles(prepared.publicDir);
    for (const file of files) {
      const rel = path.relative(prepared.publicDir, file).split(path.sep).join('/');
      if (!/^(narration|images|music)\//.test(rel)) continue;
      const buf = await readFile(file);
      const { error: upErr } = await supabase.storage.from(ASSETS_BUCKET)
        .upload(`${assetBasePath}/${rel}`, buf, { contentType: mimeByExt[path.extname(file)] || 'application/octet-stream', upsert: true });
      if (upErr) throw new Error(upErr.message);
    }
    const { data: baseData } = supabase.storage.from(ASSETS_BUCKET).getPublicUrl(assetBasePath);
    if (baseData?.publicUrl) {
      timeline.previewBaseUrl = baseData.publicUrl.replace(/\/$/, '');
    }
  } catch (e) {
    console.warn(`[visual-learning-worker] preview asset upload failed (preview will fall back to artifacts URL): ${e.message}`);
  }

  await supabase.from('visual_learning_jobs').update({
    image_manifest: prepared.images,
    narration_manifest: prepared.narration,
    timeline,
    status: 'rendering',
    updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);

  const cli = path.join(ENGINE_DIR, 'src', 'render', 'cli.ts');
  const args = [cli, '--job', jobFile, '--public-dir', prepared.publicDir, '--out', outPath];
  const proc = spawn('bun', args, { cwd: ENGINE_DIR, env: { ...process.env, REMOTION_CONCURRENCY: String(process.env.REMOTION_CONCURRENCY || 2) }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', (d) => process.stdout.write(`[render] ${d}`));
  let errText = '';
  proc.stderr.on('data', (d) => { errText += d; process.stderr.write(`[render] ${d}`); });
  const timeout = setTimeout(() => { try { proc.kill('SIGTERM'); } catch {} setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 10000); }, 60 * 60 * 1000);
  await new Promise((res, rej) => {
    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) res();
      else rej(new Error(`Render failed (exit ${code}): ${errText.slice(-4000)}`));
    });
    proc.on('error', (e) => { clearTimeout(timeout); rej(new Error(`Could not start the renderer: ${e.message}`)); });
  });
  if (!existsSync(outPath)) throw new Error('Renderer produced no MP4');
  const info = await stat(outPath);
  if (!info.size) throw new Error('Renderer produced an empty MP4');
  return { outPath, timeline };
}

// ---------------- persistence + publishing ----------------

async function saveToInfrastructure(job, spec, outPath, timeline) {
  const buffer = await readFile(outPath);
  if (!buffer.length) throw new Error('Renderer produced an empty MP4.');

  await setStage(job, 'saving', 'Uploading video and registering it with the Social Engine');
  const slug = String(job.title || 'visual-learning').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'visual-learning';
  const storagePath = `visual-learning/${job.id}/${slug}.mp4`;
  const { error: upErr } = await supabase.storage.from(VIDEO_BUCKET)
    .upload(storagePath, buffer, { contentType: 'video/mp4', upsert: true });
  if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
  const { data: publicData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Could not resolve the uploaded video URL.');

  // Script + timeline artifacts for the studio preview.
  const artifactsPath = `visual-learning/${job.id}/timeline.json`;
  await supabase.storage.from(ASSETS_BUCKET).upload(artifactsPath, JSON.stringify(timeline), {
    contentType: 'application/json', upsert: true,
  }).catch((e) => console.warn(`[visual-learning-worker] artifact upload failed: ${e.message}`));

  const durationSeconds = timeline.totalFrames / timeline.fps;
  const metadata = {
    visual_learning_job_id: job.id,
    title: job.title,
    caption: `${job.title} — visual learning by Shiney Brain Academy`,
    topic: job.topic,
    audience: spec.audience,
    mime: 'video/mp4',
    video_url: videoUrl,
    video_storage_path: storagePath,
    durationSeconds,
    aspect: spec.aspect,
    style: spec.style,
    shot_seconds: spec.maxShotSeconds,
    engine: 'visual-learning-v1',
    rendered_at: new Date().toISOString(),
  };

  // metadata.visual_learning_job_id is the recovery key if the worker dies
  // after inserting an asset but before saving its id on the job row.
  let assetId = job.content_asset_id || null;
  if (!assetId) {
    const { data: existingAsset, error: findAssetError } = await supabase
      .from('content_assets')
      .select('id')
      .contains('metadata', { visual_learning_job_id: job.id })
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

  const { error: assetLinkError } = await supabase.from('visual_learning_jobs')
    .update({ content_asset_id: assetId, storage_path: storagePath, video_url: videoUrl, updated_at: new Date().toISOString() })
    .eq('id', job.id).eq('claim_token', job.claim_token);
  if (assetLinkError) throw new Error(`Could not link content asset to job: ${assetLinkError.message}`);

  const mediaPayload = {
    content_asset_id: assetId,
    media_type: 'video',
    role: 'primary',
    position: 0,
    url: videoUrl,
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

  // Social publishing (same contract as the other engines; best-effort).
  let queued = 0;
  if (AUTO_PUBLISH && job.spec?.auto_publish !== false) {
    try {
      const { data: existingPublishJobs } = await supabase.from('publish_jobs')
        .select('id')
        .eq('content_asset_id', assetId)
        .eq('created_by', 'visual-learning-auto-publish')
        .limit(1);
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
            created_by: 'visual-learning-auto-publish',
          }));
        if (jobsToCreate.length) {
          const { error: pubErr } = await supabase.from('publish_jobs').insert(jobsToCreate);
          if (pubErr) throw new Error(pubErr.message);
          queued = jobsToCreate.length;
          console.log(`[visual-learning-worker] queued ${queued} publish job(s) for asset ${assetId}`);
        }
      }
    } catch (pubErr) {
      console.warn(`[visual-learning-worker] auto-publish queueing failed for job ${job.id}:`, pubErr.message);
      await supabase.from('visual_learning_jobs').update({
        warnings: [`auto-publish failed: ${String(pubErr.message).slice(0, 200)}`],
        updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('claim_token', job.claim_token);
    }
  }

  const { data: completed, error: completeError } = await supabase.from('visual_learning_jobs')
    .update({
      status: 'ready',
      stage: 'completed',
      stage_message: queued > 0 ? `Video is ready (${queued} publish job(s) queued)` : 'Video is ready',
      stage_updated_at: new Date().toISOString(),
      video_url: videoUrl,
      storage_path: storagePath,
      content_asset_id: assetId,
      media_file_id: mediaId,
      duration_seconds: durationSeconds,
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
  console.log(`[visual-learning-worker] job ${job.id} ready → ${videoUrl}`);
}

// ---------------- pipeline ----------------

async function processJob(job) {
  currentJobId = job.id;
  job.leaseLost = false;
  const heartbeatTimer = setInterval(() => {
    heartbeat(job).catch((err) => {
      console.error(`[visual-learning-worker] heartbeat error for ${job.id}:`, err.message);
      if (/lease was lost/i.test(err.message)) job.leaseLost = true;
    });
    registerWorker().catch(() => {});
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();

  const workDir = path.join(ENGINE_DIR, '.job-' + job.id);
  try {
    const spec = specFromJob(job);

    // Script: provided script → planner (LLM chain → z-ai → architect). The
    // result is re-validated here; anything unusable falls back to the
    // deterministic architect so the pipeline never hard-fails on a script.
    const scriptResult = await scriptForJob(job, spec);
    let { script, provider, fallback } = scriptResult;
    try {
      script = validateScript(script, { title: spec.title, topic: spec.topic, audience: spec.audience, aspect: spec.aspect, accent: spec.accent });
    } catch (err) {
      console.warn(`[visual-learning-worker] planned script invalid (${String(err.message || err).slice(0, 200)}) — using deterministic architect`);
      const { architectScript } = await import('../visual-learning-engine/src/script/architect');
      script = validateScript(architectScript(spec), { title: spec.title, topic: spec.topic, audience: spec.audience, aspect: spec.aspect, accent: spec.accent });
      provider = 'architect';
      fallback = true;
    }
    assertLease(job);

    // Ground the asset in real course content when a Knowledge Asset was selected.
    let knowledgeAssetId = job.knowledge_asset_id || null;
    if (!knowledgeAssetId) {
      knowledgeAssetId = await resolveOrCreateKnowledgeAsset(script.meta.title, spec.audience, script, job.id);
      await supabase.from('visual_learning_jobs').update({
        knowledge_asset_id: knowledgeAssetId,
        script,
        script_provider: provider,
        used_fallback: fallback,
        title: String(script.meta.title || job.title).slice(0, 200),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('claim_token', job.claim_token);
    } else if (!job.script) {
      await supabase.from('visual_learning_jobs').update({
        script,
        script_provider: provider,
        used_fallback: fallback,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('claim_token', job.claim_token);
    }

    const prepared = await prepareEpisodeAssets(job, spec, script, workDir);
    assertLease(job);
    const { outPath, timeline } = await renderVideo(job, spec, script, prepared, workDir);
    assertLease(job);
    await saveToInfrastructure(job, spec, outPath, timeline);
  } catch (err) {
    console.error(`[visual-learning-worker] job ${job.id} failed:`, err);
    await fail(job, err?.message || String(err));
  } finally {
    clearInterval(heartbeatTimer);
    currentJobId = null;
    registerWorker().catch(() => {});
    await rm(workDir, { recursive: true, force: true }).catch((err) => {
      console.warn(`[visual-learning-worker] cleanup failed for ${job.id}:`, err.message);
    });
  }
}

async function tick() {
  await registerWorker();
  let job = null;
  try {
    const { data, error } = await supabase.rpc('claim_visual_learning_job', { p_worker_id: WORKER_ID });
    if (error) {
      lastClaimError = error.message;
      console.error('[visual-learning-worker] claim error:', error.message);
      return 'error';
    }
    lastClaimError = null;
    job = Array.isArray(data) ? (data[0] || null) : (data || null);
  } catch (e) {
    lastClaimError = e.message;
    console.error('[visual-learning-worker] claim error:', e.message);
    return 'error';
  }
  if (!job) return 'idle';
  console.log(`[visual-learning-worker] claimed ${job.id} "${job.title}" (attempt ${job.attempt_count})`);
  await processJob(job);
  return 'processed';
}

// RUN_ONCE mode (GitHub Actions): drain the queue, then exit so no always-on
// server is needed.
async function runOnce() {
  const startedAt = Date.now();
  let processed = 0;
  let exitCode = 0;
  while (!stopping && Date.now() - startedAt < RUN_ONCE_MAX_MS) {
    let result;
    try {
      result = await tick();
    } catch (err) {
      console.error('[visual-learning-worker] tick error:', err);
      result = 'error';
    }
    if (result === 'error') { exitCode = 1; break; }
    if (result === 'idle') break;
    processed += 1;
  }
  console.log(`[visual-learning-worker] run-once finished: ${processed} job(s) processed`);
  process.exit(exitCode);
}

async function loop() {
  if (stopping) return;
  try {
    await tick();
  } catch (err) {
    console.error('[visual-learning-worker] tick error:', err);
  }
  if (!stopping) setTimeout(loop, POLL_MS);
}

process.on('SIGINT', () => { stopping = true; console.log('[visual-learning-worker] stopping after current job'); });
process.on('SIGTERM', () => { stopping = true; console.log('[visual-learning-worker] stopping after current job'); });

if (RUN_ONCE) runOnce();
else loop();
