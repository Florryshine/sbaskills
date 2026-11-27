#!/usr/bin/env bun
// Durable Tegaki MP4 renderer. Triggered by GitHub Actions repository_dispatch
// and a five-minute queue sweep; never render inside a Vercel request.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readFile, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const supabase = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const WORKER_ID = hostname() + '-tegaki-' + process.pid + '-' + randomUUID().slice(0,8);
const HEARTBEAT_MS = Math.max(10000, Number(process.env.TEGAKI_WORKER_HEARTBEAT_MS || 30000));
const RUN_ONCE = process.env.TEGAKI_RUN_ONCE === '1';
const MAX_RUN_MS = Number(process.env.TEGAKI_RUN_ONCE_MAX_MS || 45 * 60 * 1000);
const VIDEO_BUCKET = 'lesson-videos';
let stopping = false;
let currentJobId = null;
let bundleLocation = null;

async function getBundle() {
  if (!bundleLocation) bundleLocation = await bundle({
    entryPoint: path.join(ROOT, 'remotion', 'index.js'),
    publicDir: path.join(ROOT, 'public'),
    outDir: path.join(os.tmpdir(), 'tegaki-remotion-bundle'),
  });
  return bundleLocation;
}

async function registerWorker() {
  const { error } = await supabase.from('tegaki_workers').upsert({
    worker_id: WORKER_ID, last_seen_at: new Date().toISOString(), current_job_id: currentJobId,
    info: { node: process.version, bun: typeof Bun !== 'undefined' ? Bun.version : null },
  });
  if (error) console.warn('[tegaki-worker] liveness update failed:', error.message);
}

async function setStage(job, stage, message) {
  const { error } = await supabase.from('tegaki_jobs').update({
    stage, stage_message: message, updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token);
  if (error) throw new Error('Could not update Tegaki job stage: ' + error.message);
}

async function heartbeat(job) {
  const { data, error } = await supabase.from('tegaki_jobs').update({
    heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token)
    .in('status', ['rendering','uploading']).select('id').maybeSingle();
  if (error) throw new Error('Tegaki heartbeat failed: ' + error.message);
  if (!data) throw new Error('Tegaki job lease was lost.');
}

async function render(job) {
  const ratio = job.aspect_ratio || '9:16';
  const inputProps = {
    title: job.title, scenes: job.scenes, template: 'tegaki',
    brand: job.brand || 'SHINEY BRAIN ACADEMY', accent: '#f4c542',
    narrationVolume: Number(job.narration_volume ?? 1),
    musicSrc: job.music_src || null, musicVolume: Number(job.music_volume ?? 0.12),
    aspectRatio: ratio,
  };
  const serveUrl = await getBundle();
  const composition = await selectComposition({ serveUrl, id: 'TegakiVideo', inputProps });
  const outDir = path.join(os.tmpdir(), 'tegaki-export-' + job.id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'lesson.mp4');
  await setStage(job, 'rendering', 'Rendering ' + ratio + ' MP4 with Remotion');
  await renderMedia({
    composition, serveUrl, codec: 'h264', outputLocation: outPath, inputProps,
    pixelFormat: 'yuv420p', crf: 18, concurrency: 2,
    onProgress: ({ progress }) => {
      if (Number.isFinite(progress)) setStage(job, 'rendering', 'Rendering video · ' + Math.round(progress * 100) + '%').catch(() => {});
    },
  });
  const buffer = await readFile(outPath);
  if (buffer.length < 1024) throw new Error('Remotion returned an empty or invalid MP4.');
  return { outPath, buffer, outDir, composition };
}

async function save(job, rendered) {
  await setStage(job, 'uploading', 'Uploading MP4 and creating a Social Engine draft');
  const slug = String(job.title || 'tegaki-lesson').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'tegaki-lesson';
  const storagePath = 'tegaki/' + job.id + '/' + slug + '.mp4';
  const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET).upload(storagePath, rendered.buffer, {
    contentType: 'video/mp4', upsert: true,
  });
  if (uploadError) throw new Error('MP4 upload failed: ' + uploadError.message);
  const videoUrl = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath).data.publicUrl;
  if (!videoUrl) throw new Error('Could not resolve the uploaded video URL.');

  const duration = Number(job.duration_seconds) || job.scenes.reduce((sum, scene) => sum + (Number(scene.durationSeconds)||0), 0);
  const metadata = {
    tegaki_job_id: job.id, engine: 'tegaki-studio', title: job.title,
    topic: job.title, subject: job.subject, mime: 'video/mp4',
    video_url: videoUrl, video_storage_path: storagePath,
    durationSeconds: duration, aspect_ratio: job.aspect_ratio, visual_style: job.style_id,
    rendered_at: new Date().toISOString(),
    caption: job.title + ' — handwritten lesson by Shiney Brain Academy',
  };

  let contentAssetId = job.content_asset_id || null;
  if (!contentAssetId) {
    const { data: existing, error } = await supabase.from('content_assets').select('id')
      .contains('metadata', { tegaki_job_id: job.id }).limit(1).maybeSingle();
    if (error) throw new Error('Social Engine draft lookup failed: ' + error.message);
    contentAssetId = existing?.id || null;
  }
  if (contentAssetId) {
    const { error } = await supabase.from('content_assets').update({
      title: job.title, body: metadata.caption, metadata, asset_type: 'creator_video',
      format: 'video', status: 'draft',
    }).eq('id', contentAssetId);
    if (error) throw new Error('Social Engine draft update failed: ' + error.message);
  } else {
    const { data, error } = await supabase.from('content_assets').insert({
      knowledge_asset_id: job.knowledge_asset_id, asset_type: 'creator_video',
      format: 'video', title: job.title, body: metadata.caption, status: 'draft', metadata,
    }).select('id').single();
    if (error) throw new Error('Social Engine draft creation failed: ' + error.message);
    contentAssetId = data.id;
  }

  const mediaPayload = {
    content_asset_id: contentAssetId, media_type: 'video', role: 'primary', position: 0,
    url: videoUrl, storage_path: storagePath, mime_type: 'video/mp4',
    file_size_bytes: rendered.buffer.length, duration_seconds: duration, source: 'render', alt_text: job.title,
  };
  let mediaId = job.media_file_id || null;
  if (!mediaId) {
    const { data, error } = await supabase.from('media_files').select('id')
      .eq('content_asset_id', contentAssetId).eq('media_type','video').eq('role','primary').maybeSingle();
    if (error) throw new Error('Media lookup failed: ' + error.message);
    mediaId = data?.id || null;
  }
  if (mediaId) {
    const { error } = await supabase.from('media_files').update(mediaPayload).eq('id',mediaId);
    if (error) throw new Error('Media update failed: ' + error.message);
  } else {
    const { data, error } = await supabase.from('media_files').insert(mediaPayload).select('id').single();
    if (error) throw new Error('Media insert failed: ' + error.message);
    mediaId = data.id;
  }

  const { data: completed, error: completeError } = await supabase.from('tegaki_jobs').update({
    status: 'ready', stage: 'completed', stage_message: 'MP4 ready · saved to Social Engine drafts',
    video_url: videoUrl, storage_path: storagePath, content_asset_id: contentAssetId,
    media_file_id: mediaId, error_message: null, claim_token: null, worker_id: null,
    heartbeat_at: null, updated_at: new Date().toISOString(),
  }).eq('id',job.id).eq('claim_token',job.claim_token).select('id').maybeSingle();
  if (completeError) throw new Error('Could not mark Tegaki export ready: ' + completeError.message);
  if (!completed) throw new Error('Tegaki lease was lost before completion.');
  console.log('[tegaki-worker] ready:', videoUrl);
}

async function fail(job, error) {
  await supabase.from('tegaki_jobs').update({
    status: 'failed', stage: 'failed', stage_message: 'Export failed',
    error_message: String(error?.message || error).slice(0,1800),
    claim_token: null, worker_id: null, heartbeat_at: null, updated_at: new Date().toISOString(),
  }).eq('id',job.id).eq('claim_token',job.claim_token);
}

async function tick() {
  await registerWorker();
  const { data, error } = await supabase.rpc('claim_tegaki_job',{p_worker_id:WORKER_ID});
  if (error) throw new Error('Could not claim Tegaki job: ' + error.message);
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return 'idle';
  currentJobId = job.id;
  let lostLease = false;
  const timer = setInterval(() => heartbeat(job).catch(err => {
    console.error('[tegaki-worker] heartbeat:', err.message);
    if (/lease was lost/i.test(err.message)) lostLease = true;
  }), HEARTBEAT_MS);
  timer.unref?.();
  let rendered;
  try {
    console.log('[tegaki-worker] rendering', job.id, job.title);
    rendered = await render(job);
    if (lostLease) throw new Error('Tegaki job lease was lost during rendering.');
    await save(job, rendered);
  } catch (error) {
    console.error('[tegaki-worker] job failed:', error);
    await fail(job,error);
  } finally {
    clearInterval(timer);
    if (rendered?.outDir) await rm(rendered.outDir,{recursive:true,force:true}).catch(()=>{});
    currentJobId = null;
    await registerWorker().catch(()=>{});
  }
  return 'processed';
}

async function runOnce() {
  const start = Date.now();
  let count = 0;
  while (!stopping && Date.now()-start < MAX_RUN_MS) {
    const result = await tick();
    if (result === 'idle') break;
    count++;
  }
  console.log('[tegaki-worker] run-once finished:',count,'job(s)');
}
async function loop() {
  if (stopping) return;
  try { await tick(); } catch (error) { console.error('[tegaki-worker] tick failed:',error); }
  if (!stopping) setTimeout(loop,15000);
}
process.on('SIGINT',()=>{stopping=true;});
process.on('SIGTERM',()=>{stopping=true;});
if (RUN_ONCE) await runOnce(); else await loop();
