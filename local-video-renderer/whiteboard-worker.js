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
const { withRetry, normalizeAudio } = await import('../lib/whiteboard/audio.js');
const { generateScriptWithAI } = await import('../lib/whiteboard/planner.js');
const { getIllustration } = await import('../whiteboard-engine/src/illustrations/registry.ts');
const { parseScript } = await import('../whiteboard-engine/src/script/parser.ts');

/** Image attributions + provider diagnostics per job (job id -> string[]). */
const jobImageCredits = new Map();

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
let currentJobId = null;
let registryWarned = false;
let lastClaimError = null;
const STARTED_AT = new Date().toISOString();

console.log(`[whiteboard-worker] ${WORKER_ID} polling every ${POLL_MS}ms`);

// Liveness beacon: lets the admin UI tell "no worker online" from "worker busy".
async function registerWorker() {
  const { error } = await supabase.from('whiteboard_workers').upsert({
    worker_id: WORKER_ID,
    started_at: STARTED_AT,
    last_seen_at: new Date().toISOString(),
    current_job_id: currentJobId,
    info: { node: process.version, bun: typeof Bun !== 'undefined' ? Bun.version : null, last_error: lastClaimError },
  });
  if (error && !registryWarned) {
    registryWarned = true;
    console.warn('[whiteboard-worker] could not write worker liveness (is migration 20261115 applied?):', error.message);
  }
}

// Report real progress. Guarded by claim_token so a worker that lost its lease cannot overwrite state.
async function setStage(job, stage, message) {
  const { error } = await supabase.from('whiteboard_jobs')
    .update({ stage, stage_message: message || null, stage_updated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('claim_token', job.claim_token);
  if (error) console.warn(`[whiteboard-worker] stage update (${stage}) failed:`, error.message);
}

async function tick() {
  await registerWorker();
  const { data, error } = await supabase.rpc('claim_whiteboard_job', { p_worker_id: WORKER_ID });
  if (error) {
    console.error('[whiteboard-worker] claim error:', error.message);
    lastClaimError = error.message; // surfaced in the admin UI via whiteboard_workers.info
    return 'error';
  }
  lastClaimError = null;
  const job = Array.isArray(data) ? data[0] : data;
  if (!job) return 'idle';

  console.log(`[whiteboard-worker] claimed ${job.id} "${job.title}" (attempt ${job.attempt_count})`);
  currentJobId = job.id;
  job.leaseLost = false;
  const heartbeatTimer = setInterval(() => {
    heartbeat(job).catch(err => {
      console.error('[whiteboard-worker] heartbeat error:', err.message);
      if (/lease was lost/i.test(err.message)) job.leaseLost = true;
    });
    registerWorker().catch(() => {});
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
  try {
    let preparedJob = job;
    // AI jobs arrive without a script: the web route only stores the topic so the slow multi-provider
    // LLM call never runs inside a time-limited Vercel function.
    if (!String(job.script_text || '').trim()) preparedJob = await generateScriptForJob(job);
    job.script_text = preparedJob.script_text;
    const sceneCount = parseScript(preparedJob.script_text).scenes.length;
    const hasCompleteNarration = preparedJob.timeline && Array.isArray(preparedJob.audio_files) && preparedJob.audio_files.length === sceneCount;
    if (!hasCompleteNarration) preparedJob = await narrateAndBuildJob(preparedJob);
    preparedJob.leaseLost = job.leaseLost;
    const outPath = await renderJob(preparedJob, job);
    assertLease(job);
    await saveToInfrastructure(preparedJob, outPath);
  } catch (err) {
    console.error('[whiteboard-worker] job failed:', err);
    await fail(job, err?.message || String(err));
  } finally {
    clearInterval(heartbeatTimer);
    currentJobId = null;
    registerWorker().catch(() => {});

    // Remove temporary narration, timeline and rendered MP4 after processing.
    const workDir = path.join(ENGINE_DIR, '.job-' + job.id);
    await rm(workDir, { recursive: true, force: true }).catch((err) => {
      console.warn(`[whiteboard-worker] cleanup failed for ${job.id}:`, err.message);
    });
  }
  return 'processed';
}

function assertLease(job) {
  if (job.leaseLost) throw new Error('Job lease was lost while the worker was processing the job.');
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

async function loadKnowledgeAssetContext(knowledgeAssetId, topic, subject) {
  let query = supabase.from('knowledge_assets').select('*');
  if (knowledgeAssetId) {
    query = query.eq('id', knowledgeAssetId);
  } else {
    // If the admin did not explicitly attach a Knowledge Asset, reuse an
    // existing exact topic match rather than treating a newly generated script
    // as independent research material.
    query = query.eq('keyword', topic).eq('subject', subject).limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not load the matching Knowledge Asset for Whiteboard source context: ${error.message}`);
  if (!data) return { id: null, context: '' };

  const source = {
    keyword: data.keyword,
    subject: data.subject,
    summary: data.summary,
    description: data.description,
    raw_content: data.raw_content,
    content: data.content,
    definitions: data.definitions,
    key_concepts: data.key_concepts,
    learning_objectives: data.learning_objectives,
    sub_topics: data.sub_topics,
    facts: data.facts,
    examples: data.examples,
    common_mistakes: data.common_mistakes,
  };
  const compact = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );

  // A Knowledge Asset created by this Whiteboard Engine contains the output
  // script itself, not independent source research. Reuse its ID for linkage,
  // but do not feed that script back as if it were verified source material.
  const context = data.source === 'whiteboard_engine_v3'
    ? ''
    : JSON.stringify(compact).slice(0, 12000);
  return { id: data.id, context };
}

async function generateScriptForJob(job) {
  const topic = String(job.topic || job.title || '').trim();
  if (!topic) throw new Error('Job has neither a script nor a topic to generate one from.');
  await setStage(job, 'scripting', `Developing the explanation and writing "${topic}"`);
  const knowledgeSource = await loadKnowledgeAssetContext(job.knowledge_asset_id, topic, job.subject || 'general');
  const knowledgeContext = knowledgeSource.context;

  // Generate, then validate by really parsing it. Validation failures are fed
  // BACK into the next prompt (reflect loop) instead of blind retries — the
  // model learns exactly which asset ids it hallucinated.
  let feedback = '';
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    assertLease(job);
    try {
      const text = await generateScriptWithAI(topic, job.subject || 'general', feedback, knowledgeContext);
      const parsed = parseScript(text);
      const missing = parsed.scenes
        .flatMap((sc) => sc.elements)
        .filter((el) => el.type === 'illustration' && !el.image && !getIllustration(el.asset))
        .map((el) => el.asset);
      if (missing.length) {
        throw new Error(
          `AI script used unknown illustrations: ${missing.join(', ')}`,
        );
      }
      const withSpec = { text, parsed };
      const title = withSpec.parsed.title || topic;
      const subject = /^\s*@subject\b/im.test(withSpec.text) ? withSpec.parsed.subject : (job.subject || 'general');

      // Reuse (or create) the shared Knowledge Asset: content_assets requires it.
      let knowledgeAssetId = job.knowledge_asset_id || knowledgeSource.id || null;
      if (!knowledgeAssetId) {
        const { data: found, error: findErr } = await supabase.from('knowledge_assets')
          .select('id').eq('keyword', title).eq('subject', subject).limit(1);
        if (findErr) throw new Error(`Knowledge Asset lookup failed: ${findErr.message}`);
        knowledgeAssetId = found?.[0]?.id || null;
      }
      if (!knowledgeAssetId) {
        const { data: created, error: createErr } = await supabase.from('knowledge_assets').insert({
          keyword: title, topic_type: 'curriculum_topic', subject,
          summary: `Whiteboard lesson: ${title}`, raw_content: withSpec.text.slice(0, 12000),
          learning_objectives: [], key_concepts: [], definitions: [], examples: [], facts: [],
          common_mistakes: [], sub_topics: [], status: 'draft', source: 'whiteboard_engine_v3',
        }).select('id').single();
        if (createErr) throw new Error(`Knowledge Asset creation failed: ${createErr.message}`);
        knowledgeAssetId = created.id;
      }

      const { data: saved, error: saveErr } = await supabase.from('whiteboard_jobs').update({
        title, subject, script_text: withSpec.text, knowledge_asset_id: knowledgeAssetId,
        stage_message: `Script ready: ${withSpec.parsed.scenes.length} scenes`,
        stage_updated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', job.id).eq('claim_token', job.claim_token).select('*').maybeSingle();
      if (saveErr) throw new Error(`Could not save generated script: ${saveErr.message}`);
      if (!saved) throw new Error('Job lease was lost while the script was being generated.');
      console.log(`[whiteboard-worker] script ready for ${job.id}: "${title}" (${withSpec.parsed.scenes.length} scenes)`);
      return saved;
    } catch (err) {
      lastErr = err;
      console.warn(`[whiteboard-worker] script attempt ${attempt} rejected: ${err.message}`);
      feedback =
        `IMPORTANT — your previous script was REJECTED by the validator with this error:\n"${err.message}"\n` +
        'Fix exactly this problem and return the full corrected script. ' +
        'Only use draw: ids that appear verbatim in the COMPLETE ASSET CATALOG above.';
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

async function narrateAndBuildJob(job) {
  const spec = parseScript(job.script_text);
  const narrationResults = [];

  for (let i = 0; i < spec.scenes.length; i++) {
    const scene = spec.scenes[i];
    assertLease(job);
    await setStage(job, 'narrating', `Narrating scene ${i + 1} of ${spec.scenes.length}`);
    const raw = await withRetry(
      () => synthesizeLine(scene.narration, 'host_a', 'neutral'),
      {
        label: `Narration for scene ${i + 1}`,
        onRetry: (err, n) => console.warn(`[whiteboard-worker] TTS scene ${i + 1} attempt ${n} failed: ${err.message}`),
      },
    );
    const { buffer, mimeType } = normalizeAudio(raw, raw.mimeType);
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

  await setStage(job, 'timeline', 'Aligning narration to the drawing timeline');
  const { timeline, warnings, credits, notes } = await buildTimelineForJob(
    job.script_text,
    narrationResults.map(({ buffer, mimeType, audioFile }) => ({ buffer, mimeType, audioFile })),
  );
  // Keep image attributions + provider diagnostics for the save step.
  jobImageCredits.set(job.id, [...(credits ?? []), ...(notes ?? [])]);

  const { data: prepared, error } = await supabase.from('whiteboard_jobs').update({
    status: 'rendering',
    stage: 'rendering',
    stage_message: 'Rendering whiteboard animation',
    stage_updated_at: new Date().toISOString(),
    timeline,
    audio_files: narrationResults.map(({ audioFile, publicUrl }) => ({ audioFile, publicUrl })),
    warnings: [...(credits ?? []).map((c) => `credit: ${c}`), ...(notes ?? []), ...warnings].slice(0, 30),
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

async function renderJob(job, leaseJob = job) {
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

  // Create a render-only timeline with local narration paths.
  const renderTimeline = {
    ...timeline,
    scenes: timeline.scenes.map((scene, i) => ({
      ...scene,
      audioFile: `narration/${path.basename(audioList[i]?.audioFile || scene.audioFile || `scene-${i + 1}.wav`)}`,
    })),
  };

  // Use fixed, per-scene local names: storage paths never become filesystem paths.
  // This prevents traversal and basename collisions while retaining each audio format.
  await mkdir(path.join(workDir, 'narration'), { recursive: true });

  for (const [i, audio] of audioList.entries()) {
    const audioPath = audio?.audioFile;
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error(`Narration file ${i + 1} has no valid storage path.`);
    }
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).download(audioPath);
    if (error) throw new Error(`Audio download failed (${audioPath}): ${error.message}`);
    const sourceName = path.basename(audioPath);
    const extension = path.extname(sourceName).toLowerCase();
    if (!['.wav', '.mp3', '.m4a', '.ogg'].includes(extension)) {
      throw new Error(`Unsupported narration audio format for scene ${i + 1}: ${extension || 'unknown'}`);
    }
    const localName = `scene-${String(i + 1).padStart(2, '0')}${extension}`;
    renderTimeline.scenes[i].audioFile = `narration/${localName}`;
    await writeFile(path.join(workDir, 'narration', localName), Buffer.from(await data.arrayBuffer()));
  }

  // Remotion's handwriting renderer expects this workspace directory to exist.
  await mkdir(path.join(workDir, 'fonts'), { recursive: true });
  await writeFile(path.join(workDir, 'timeline.json'), JSON.stringify(renderTimeline));
  const slug = slugify(job.title);
  const outPath = path.join(workDir, `${slug}.mp4`);
  assertLease(leaseJob);
  await setStage(job, 'rendering', 'Rendering whiteboard animation (Chrome + Remotion)');
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

  await setStage(job, 'uploading', 'Uploading video and registering it with the Social Engine');
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

  // Attribution for externally sourced images — required for CC-BY style
  // licences, stored in metadata and appended to the asset body.
  const imageCredits = jobImageCredits.get(job.id) ?? [];
  const creditLines = imageCredits.filter((l) => l.startsWith('credit: ')).map((l) => l.slice(8));
  if (creditLines.length) {
    metadata.image_credits = creditLines;
    metadata.caption = `${metadata.caption}\n\nImage credits: ${creditLines.join(' | ')}`;
  }

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
      stage: 'completed',
      stage_message: 'Video is ready',
      stage_updated_at: new Date().toISOString(),
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
      stage: 'failed',
      stage_message: 'Failed',
      stage_updated_at: new Date().toISOString(),
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

// RUN_ONCE mode (GitHub Actions): drain the queue, then exit so no always-on server is needed.
const RUN_ONCE = process.env.WHITEBOARD_RUN_ONCE === '1';
const RUN_ONCE_MAX_MS = Number(process.env.WHITEBOARD_RUN_ONCE_MAX_MS || 40 * 60 * 1000);

async function runOnce() {
  const startedAt = Date.now();
  let processed = 0;
  let exitCode = 0;
  while (!stopping && Date.now() - startedAt < RUN_ONCE_MAX_MS) {
    let result;
    try {
      result = await tick();
    } catch (err) {
      console.error('[whiteboard-worker] tick error:', err);
      result = 'error';
    }
    if (result === 'error') { exitCode = 1; break; }
    if (result === 'idle') break;
    processed += 1;
  }
  console.log(`[whiteboard-worker] run-once finished: ${processed} job(s) processed`);
  process.exit(exitCode);
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

if (RUN_ONCE) runOnce();
else loop();
