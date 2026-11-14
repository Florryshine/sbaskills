// local-video-renderer/whiteboard-worker.js
//
// Durable local renderer for Whiteboard Engine v3. Jobs are atomically claimed
// through claim_whiteboard_job(), heartbeated during narration and rendering, and saved
// idempotently into the existing content_assets + media_files contract.

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import { hostname } from 'node:os';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// Load these after dotenv so podcastTTS captures the configured keys.
const { synthesizeLine } = await import('../lib/podcastTTS.js');
const { buildTimelineForJob } = await import('../lib/whiteboard/timeline.js');
const { parseScript } = await import('../whiteboard-engine/src/script/parser.ts');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[whiteboard-worker] Missing SUPABASE env vars — exiting.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ENGINE_DIR = path.resolve(process.cwd(), 'whiteboard-engine');
const POLL_MS = Math.max(3000, Number(process.env.WHITEBOARD_WORKER_POLL_MS || 15000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.WHITEBOARD_WORKER_HEARTBEAT_MS || 30000));
const AUDIO_BUCKET = 'whiteboard-assets';
const VIDEO_BUCKET = 'lesson-videos';
const WORKER_ID = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
let stopping = false;

console.log(`[whiteboard-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);

async function tick() {
  const { data, error } = await supabase.rpc('claim_whiteboard_job', { p_worker_id: WORKER_ID });
  if (error) {
    console.error('[whiteboard-worker] claim error:', error.message);
    return;
  }
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return;

  console.log(`[whiteboard-worker] claimed ${job.id} "${job.title}" (attempt ${job.attempt_count})`);
  const heartbeatTimer = setInterval(() => {
    heartbeat(job).catch(err => {
      console.error('[whiteboard-worker] heartbeat error:', err.message);
    });
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
  try {
    let preparedJob = job;
    const sceneCount = parseScript(job.script_text).scenes.length;
    const hasCompleteNarration = job.timeline && Array.isArray(job.audio_files) && job.audio_files.length === sceneCount;
    if (!hasCompleteNarration) preparedJob = await narrateAndBuildJob(job);
    const outPath = await renderJob(preparedJob);
    await saveToInfrastructure(preparedJob, outPath);
  } catch (err) {
    console.error('[whiteboard-worker] job failed:', err);
    await fail(job, err?.message || String(err));
  } finally {
    clearInterval(heartbeatTimer);
    // Remove per-job render files on both success and failure. The MP4 has
    // already been uploaded before the successful path reaches this cleanup.
    await rm(path.join(ENGINE_DIR, '.job-' + job.id), { recursive: true, force: true }).catch(() => {});
  }
}

async function heartbeat(job) {
  const { data, error } = await supabase
    .from('whiteboard_jobs')
    .update({ heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    .in('status', ['narrating', 'rendering'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error(`Job heartbeat failed: ${error.message}`);
  if (!data) throw new Error('Job lease was lost while the worker was processing the job.');
}

async function narrateAndBuildJob(job) {
  const spec = parseScript(job.script_text);
  const narrationResults = [];

  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    const buffer = await synthesizeLine(scene.narration, 'host_a', 'neutral');
    const mimeType = buffer.mimeType || 'audio/wav';
    const extension = mimeType.includes('mpeg') ? 'mp3' : 'wav';
    const storagePath = `${job.id}/scene-${String(i + 1).padStart(2, '0')}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (uploadError) throw new Error(`Audio upload failed (${storagePath}): ${uploadError.message}`);
    const { data } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
    narrationResults.push({ buffer, mimeType, audioFile: storagePath, publicUrl: data?.publicUrl });
  }

  const { timeline, warnings } = buildTimelineForJob(
    job.script_text,
    narrationResults.map(({ buffer, mimeType, audioFile }) => ({ buffer, mimeType, audioFile })),
  );

  const { data: prepared, error } = await supabase.from('whiteboard_jobs').update({
    status: 'rendering',
    timeline,
    audio_files: narrationResults.map(({ audioFile, publicUrl }) => ({ audioFile, publicUrl })),
    warnings: warnings.slice(0, 20),
    duration_seconds: timeline.totalDuration,
    updated_at: new Date().toISOString(),
  })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    .eq('status', 'narrating')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(`Could not save narrated timeline: ${error.message}`);
  if (!prepared) throw new Error('Job lease was lost while narration was being prepared.');
  return prepared;
}

async function renderJob(job) {
  const workDir = path.join(ENGINE_DIR, '.job-' + job.id);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const { data: jobWithAudio, error: audioListError } = await supabase
    .from('whiteboard_jobs')
    .select('audio_files')
    .eq('id', job.id)
    .eq('claim_token', job.claim_token)
    .single();
  if (audioListError) throw new Error(`Could not read narration list: ${audioListError.message}`);

  const timeline = job.timeline;
  if (!timeline || !Array.isArray(timeline.scenes)) {
    throw new Error('Job has no valid timeline.scenes payload.');
  }

  const audioList = jobWithAudio?.audio_files || [];
  if (audioList.length !== timeline.scenes.length) {
    throw new Error(`Narration mismatch: ${audioList.length} audio files for ${timeline.scenes.length} scenes.`);
  }

  for (const [i, audio] of audioList.entries()) {
    const audioPath = audio?.audioFile;
    if (!audioPath) throw new Error(`Narration file ${i + 1} has no storage path.`);
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).download(audioPath);
    if (error) throw new Error(`Audio download failed (${audioPath}): ${error.message}`);
    const relativeAudioPath = String(timeline.scenes[i]?.audioFile || audioPath).replace(/\\/g, '/').replace(/^\/+/, '');
    if (relativeAudioPath.split('/').includes('..')) throw new Error(`Unsafe narration path: ${relativeAudioPath}`);
    const localAudioPath = path.resolve(workDir, relativeAudioPath);
    if (!localAudioPath.startsWith(`${workDir}${path.sep}`)) throw new Error(`Narration path escaped job directory: ${relativeAudioPath}`);
    await mkdir(path.dirname(localAudioPath), { recursive: true });
    await writeFile(localAudioPath, Buffer.from(await data.arrayBuffer()));
  }

  // The Remotion CLI copies its bundled handwriting fonts into this
  // directory when they are not already present.
  await mkdir(path.join(workDir, 'fonts'), { recursive: true });
  await writeFile(path.join(workDir, 'timeline.json'), JSON.stringify(timeline));
  const slug = slugify(job.title);
  const outPath = path.join(workDir, `${slug}.mp4`);
  await runRenderer(outPath, workDir);
  return outPath;
}

function slugify(value) {
  return String(value || 'lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lesson';
}

function runRenderer(outPath, workDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'bun',
      ['run', 'src/render/cli.ts', '--timeline', path.join(workDir, 'timeline.json'), '--out', outPath],
      { cwd: ENGINE_DIR, env: { ...process.env, WB_JOB_DIR: workDir }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    const append = (current, chunk) => (current + chunk.toString()).slice(-12000);
    child.stdout.on('data', chunk => { stdout = append(stdout, chunk); });
    child.stderr.on('data', chunk => { stderr = append(stderr, chunk); });
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10000).unref();
    }, 30 * 60 * 1000);
    child.once('error', err => {
      clearTimeout(timeout);
      reject(new Error(`Could not start Bun renderer: ${err.message}`));
    });
    child.once('close', code => {
      clearTimeout(timeout);
      if (code === 0) resolve(outPath);
      else reject(new Error(`Render failed (exit ${code}): ${(stderr || stdout || 'no renderer output').slice(-4000)}`));
    });
  });
}

async function saveToInfrastructure(job, outPath) {
  const buffer = await readFile(outPath);
  if (!buffer.length) throw new Error('Renderer produced an empty MP4.');
  if (!job.knowledge_asset_id) {
    throw new Error('Job is missing knowledge_asset_id; refusing to create an orphan Social Engine asset.');
  }

  const slug = slugify(job.title);
  // Stable path means a retry overwrites the same object instead of leaving
  // timestamped orphan MP4s in Storage.
  const storagePath = `whiteboard/${job.id}/${slug}.mp4`;
  const { error: upErr } = await supabase.storage.from(VIDEO_BUCKET).upload(storagePath, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  });
  if (upErr) throw new Error(`Video upload failed: ${upErr.message}`);
  const { data: publicData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Could not resolve the uploaded video URL.');

  const metadata = {
    whiteboard_job_id: job.id,
    title: job.title,
    caption: `${job.title} — whiteboard lesson by Shiney Brain Academy`,
    topic: job.title,
    subject: job.subject,
    mime: 'video/mp4',
    video_url: videoUrl,
    video_storage_path: storagePath,
    durationSeconds: job.timeline?.totalDuration ?? null,
    rendered_at: new Date().toISOString(),
    engine: 'whiteboard-v3',
  };

  // metadata.whiteboard_job_id is the recovery key if the worker dies after
  // inserting an asset but before saving its id on whiteboard_jobs.
  let assetId = job.content_asset_id || null;
  if (!assetId) {
    const { data: existingAsset, error: findAssetError } = await supabase
      .from('content_assets')
      .select('id')
      .contains('metadata', { whiteboard_job_id: job.id })
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
  const { error: assetLinkError } = await supabase.from('whiteboard_jobs')
    .update({ content_asset_id: assetId, storage_path: storagePath, video_url: videoUrl })
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
    duration_seconds: job.timeline?.totalDuration ?? null,
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

  const { data: completed, error: completeError } = await supabase.from('whiteboard_jobs')
    .update({
      status: 'ready',
      video_url: videoUrl,
      storage_path: storagePath,
      content_asset_id: assetId,
      media_file_id: mediaId,
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
  console.log(`[whiteboard-worker] job ${job.id} ready → ${videoUrl}`);
}

async function fail(job, message) {
  const { error } = await supabase.from('whiteboard_jobs')
    .update({
      status: 'failed',
      error_message: String(message).slice(0, 1000),
      claim_token: null,
      worker_id: null,
      claimed_at: null,
      heartbeat_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token);
  if (error) console.error(`[whiteboard-worker] could not record failure for ${job.id}:`, error.message);
}

async function loop() {
  if (stopping) return;
  try {
    // heartbeat runs independently while rendering; tick itself is sequential.
    await tick();
  } catch (err) {
    console.error('[whiteboard-worker] tick error:', err);
  }
  if (!stopping) setTimeout(loop, POLL_MS);
}

process.on('SIGINT', () => { stopping = true; console.log('[whiteboard-worker] stopping after current job'); });
process.on('SIGTERM', () => { stopping = true; console.log('[whiteboard-worker] stopping after current job'); });

loop();
