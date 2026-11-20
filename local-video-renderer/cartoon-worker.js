#!/usr/bin/env bun
// Cartoon Animation Studio durable worker.
// API routes enqueue; this process claims jobs atomically, heartbeats the lease,
// generates storyboard/narration, renders with the existing SBA Remotion install,
// and registers the MP4 in the existing content_assets/media_files library.

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { hostname } from 'node:os';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[cartoon-worker] Supabase URL and service-role key are required.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const REPO_ROOT = process.cwd();
const WORKER_ID = `${hostname()}-cartoon-${process.pid}-${randomUUID().slice(0, 8)}`;
const POLL_MS = Math.max(3000, Number(process.env.CARTOON_WORKER_POLL_MS || 12000));
const HEARTBEAT_MS = Math.max(10000, Number(process.env.CARTOON_WORKER_HEARTBEAT_MS || 25000));
const RUN_ONCE = process.env.CARTOON_RUN_ONCE === '1';
const AUDIO_BUCKET = 'cartoon-assets';
const VIDEO_BUCKET = 'lesson-videos';
const MAX_RUN_MS = Number(process.env.CARTOON_RUN_ONCE_MAX_MS || 40 * 60 * 1000);
let stopping = false;
let currentJobId = null;
let lastClaimError = null;

const { synthesizeLine, getAudioMimeType, getAudioExtension } = await import('../lib/podcastTTS.js');
const { normalizeAudio } = await import('../lib/whiteboard/audio.js');
const { generateStoryboard } = await import('../cartoon/server/storyboard.ts');

function log(...args) { console.log('[cartoon-worker]', ...args); }
function wordsFor(text, duration, lead = 0.25) {
  const words = String(text || '').trim().split(/\\s+/).filter(Boolean);
  if (!words.length) return [];
  const span = Math.max(0.4, duration - lead - 0.1);
  const weights = words.map(w => Math.max(2, w.replace(/[^\\w]/g, '').length) + 1.2);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = lead;
  return words.map((word, i) => {
    const d = span * weights[i] / total;
    const item = { word, start: Number(t.toFixed(3)), end: Number((t + d).toFixed(3)) };
    t += d;
    return item;
  });
}
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
  return new Promise(resolve => {
    const child = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
    let out = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), 12000);
    child.stdout.on('data', d => { out += d.toString(); });
    child.on('close', code => {
      clearTimeout(timer);
      const n = code === 0 ? Number.parseFloat(out.trim()) : NaN;
      resolve(Number.isFinite(n) && n > 0 ? n : Math.max(1.6, String(text).split(/\\s+/).filter(Boolean).length / 2.6 + 0.5));
    });
    child.on('error', () => { clearTimeout(timer); resolve(Math.max(1.6, String(text).split(/\\s+/).filter(Boolean).length / 2.6 + 0.5)); });
  });
}
function assertLease(job) {
  if (job.leaseLost) throw new Error('Cartoon job lease was lost; this worker will not save stale results.');
}
async function registerWorker() {
  const { error } = await supabase.from('cartoon_workers').upsert({
    worker_id: WORKER_ID, last_seen_at: new Date().toISOString(),
    current_job_id: currentJobId,
    info: { node: process.version, bun: typeof Bun !== 'undefined' ? Bun.version : null, last_error: lastClaimError },
  });
  if (error) log('worker liveness update failed:', error.message);
}
async function heartbeat(job) {
  const { data, error } = await supabase.rpc('cartoon_job_heartbeat', {
    p_job_id: job.id, p_claim_token: job.claim_token,
    p_stage: job.stage || null, p_progress: job.progress ?? null,
    p_message: job.stage_message || null,
  });
  if (error) throw new Error('Heartbeat failed: ' + error.message);
  if (data !== true) throw new Error('Cartoon job lease was lost.');
}
async function setStage(job, stage, progress, message) {
  assertLease(job);
  job.stage = stage;
  job.progress = Math.max(0, Math.min(100, Math.round(progress)));
  job.stage_message = String(message || '').slice(0, 300);
  const { data: ownedJob, error } = await supabase.from('cartoon_jobs').update({
    stage, progress: job.progress, stage_message: job.stage_message, updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token).eq('status', 'processing').select('id').maybeSingle();
  if (error) throw new Error('Could not update job progress: ' + error.message);
  if (!ownedJob) { job.leaseLost = true; throw new Error('Cartoon job lease was lost.'); }
  const { error: projectError } = await supabase.from('cartoon_projects').update({
    stage, progress: job.progress, stage_message: job.stage_message, updated_at: new Date().toISOString(),
  }).eq('id', job.project_id);
  if (projectError) throw new Error('Could not update project progress: ' + projectError.message);
}
async function failJob(job, error) {
  const message = String(error?.message || error || 'Unknown Cartoon worker error').slice(0, 1800);
  const { data: failedJob, error: failError } = await supabase.from('cartoon_jobs').update({
    status: 'failed', stage: 'failed', stage_message: 'Job failed',
    error_message: message, claim_token: null, worker_id: null,
    claimed_at: null, heartbeat_at: null, updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token).select('id').maybeSingle();
  if (failError) log('could not record job failure:', failError.message);
  // A worker whose lease was reclaimed must never overwrite the newer worker's project state.
  if (!failedJob) return;
  await supabase.from('cartoon_projects').update({
    status: 'failed', stage: 'failed', stage_message: 'Production failed',
    error_message: message, updated_at: new Date().toISOString(),
  }).eq('id', job.project_id);
  log('job failed:', job.id, message);
}
async function loadProject(job) {
  const { data, error } = await supabase.from('cartoon_projects').select('*').eq('id', job.project_id).maybeSingle();
  if (error) throw new Error('Project lookup failed: ' + error.message);
  if (!data) throw new Error('Cartoon project no longer exists.');
  return data;
}
async function loadKnowledgeAsset(id, topic, subject) {
  let query = supabase.from('knowledge_assets')
    .select('id,keyword,subject,summary,sub_topics,key_concepts,definitions,facts,raw_content');
  if (id) query = query.eq('id', id);
  else query = query.eq('keyword', topic).eq('subject', subject).limit(1);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error('Knowledge Asset lookup failed: ' + error.message);
  return data || null;
}
function asJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch {} }
  return [];
}
async function ensureKnowledgeAsset(project, spec, subject) {
  if (project.knowledge_asset_id) return project.knowledge_asset_id;
  const keyword = String(spec.title || project.custom_topic || project.title).trim().slice(0, 200);
  const { data: found, error: findError } = await supabase.from('knowledge_assets')
    .select('id').eq('keyword', keyword).eq('subject', subject).limit(1).maybeSingle();
  if (findError) throw new Error('Knowledge Asset reuse lookup failed: ' + findError.message);
  if (found?.id) return found.id;
  const subTopics = spec.scenes.slice(0, 8).map(scene => ({ title: scene.heading, explanation: scene.narration }));
  const { data, error } = await supabase.from('knowledge_assets').insert({
    keyword, topic_type: 'creator_video', subject,
    summary: String(spec.description || spec.caption || keyword).slice(0, 1800),
    raw_content: JSON.stringify(spec).slice(0, 16000),
    sub_topics: subTopics,
    key_concepts: spec.scenes.map(s => s.heading).slice(0, 12),
    definitions: [], examples: [], facts: [], common_mistakes: [],
    learning_objectives: [], status: 'draft', source: 'cartoon_animation_engine',
  }).select('id').single();
  if (error) throw new Error('Could not create linked Knowledge Asset: ' + error.message);
  return data.id;
}
function sceneTokens(scene) {
  const stop = new Set(['about','after','again','also','because','before','being','between','could','does','from','have','into','just','more','most','other','should','some','than','that','their','there','these','this','those','through','today','what','when','where','which','while','with','would','your','learn','learning','friends']);
  return new Set((String(scene.heading || '') + ' ' + String(scene.narration || ''))
    .toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(word => !stop.has(word)) || []);
}
async function attachVisualAssets(spec, subject) {
  const { data, error } = await supabase.from('visual_assets')
    .select('id,name,description,subject,category,keywords,public_url,license,attribution_required,attribution')
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .limit(120);
  if (error) {
    log('shared visual library lookup skipped:', error.message);
    return spec;
  }
  const assets = data || [];
  if (!assets.length) return spec;
  for (const scene of spec.scenes) {
    const tokens = sceneTokens(scene);
    const ranked = assets.map(asset => {
      const text = [asset.name, asset.description, ...(asset.keywords || [])].join(' ').toLowerCase();
      let score = 0;
      for (const token of tokens) if (text.includes(token)) score += token.length >= 7 ? 3 : 1;
      if (String(asset.subject || '').toLowerCase() === String(subject || '').toLowerCase()) score += 2;
      if (String(asset.subject || '').toLowerCase() === 'general') score += 0.5;
      return { asset, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    scene.customAssets = ranked.map(({ asset }, index) => ({
      assetId: asset.id,
      url: asset.public_url,
      x: index === 0 ? 790 : 220,
      y: index === 0 ? 330 : 430,
      scale: 0.78,
      popAt: 0.5 + index * 0.35,
      name: asset.name,
      license: asset.attribution_required
        ? `${asset.license} — ${asset.attribution || 'attribution required'}`
        : asset.license,
    }));
  }
  return spec;
}
async function makeStoryboard(job, project) {
  const subject = String(job.payload?.subject || 'General').slice(0, 80);
  const topicHint = String(project.custom_topic || project.title || '').trim();
  const ka = await loadKnowledgeAsset(project.knowledge_asset_id, topicHint, subject);
  const topic = String(project.custom_topic || ka?.keyword || project.title || '').trim();
  const kaLike = ka ? {
    keyword: ka.keyword, subject: ka.subject || subject, summary: ka.summary || topic,
    subTopics: JSON.stringify(asJsonArray(ka.sub_topics)),
    keyConcepts: JSON.stringify(asJsonArray(ka.key_concepts)),
    definitions: JSON.stringify(asJsonArray(ka.definitions)),
    facts: JSON.stringify(asJsonArray(ka.facts)),
  } : { keyword: topic, subject, summary: topic };
  await setStage(job, 'scripting', 8, 'Creating the cartoon storyboard...');
  const generated = await generateStoryboard(kaLike, topic);
  let spec = generated.spec;
  if (!spec || !Array.isArray(spec.scenes) || spec.scenes.length < 3) {
    throw new Error('Storyboard generator returned an invalid scene list.');
  }
  spec = await attachVisualAssets(spec, subject);
  const knowledgeAssetId = await ensureKnowledgeAsset(project, spec, subject);
  assertLease(job);
  const { error } = await supabase.from('cartoon_projects').update({
    title: spec.title || project.title, knowledge_asset_id: knowledgeAssetId,
    raw_script: spec, spec, status: 'narrating', stage: 'narrating',
    stage_message: generated.usedFallback ? 'Storyboard ready using safe template fallback.' : 'Storyboard ready.',
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  if (error) throw new Error('Could not save storyboard: ' + error.message);
  if (generated.error) log('storyboard provider fallback:', generated.error.slice(0, 400));
  return { spec, knowledgeAssetId, subject };
}
async function narrateScenes(job, project, spec) {
  const existing = project.narration && typeof project.narration === 'object' ? { ...project.narration } : {};
  const workDir = path.join(tmpdir(), 'sba-cartoon', job.id);
  await mkdir(workDir, { recursive: true });
  for (let i = 0; i < spec.scenes.length; i++) {
    assertLease(job);
    const scene = spec.scenes[i];
    if (existing[scene.id]?.audioUrl && existing[scene.id]?.durationSeconds) continue;
    await setStage(job, 'narrating', 15 + (i / spec.scenes.length) * 48, `Narrating scene ${i + 1}/${spec.scenes.length}: ${scene.heading}`);
    const raw = await synthesizeLine(scene.narration, 'host_a', 'neutral');
    const source = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
    const normalized = normalizeAudio(source, getAudioMimeType(source));
    const buffer = normalized.buffer;
    const mimeType = normalized.mimeType || getAudioMimeType(buffer);
    const ext = mimeType === 'audio/wav' ? 'wav' : getAudioExtension(buffer);
    const localFile = path.join(workDir, `${scene.id}.${ext}`);
    const storagePath = `audio/${project.id}/${scene.id}.${ext}`;
    await (await import('node:fs/promises')).writeFile(localFile, buffer);
    const durationSeconds = await probeDuration(localFile, scene.narration, buffer);
    const { error: uploadError } = await supabase.storage.from(AUDIO_BUCKET)
      .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
    if (uploadError) throw new Error(`Narration upload failed for ${scene.id}: ${uploadError.message}`);
    const { data: publicData } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(storagePath);
    if (!publicData?.publicUrl) throw new Error('Supabase did not return a public narration URL.');
    existing[scene.id] = {
      sceneId: scene.id, audioUrl: publicData.publicUrl,
      storagePath, durationSeconds: Number(durationSeconds.toFixed(3)),
      words: wordsFor(scene.narration, durationSeconds),
    };
    assertLease(job);
    const { error: saveError } = await supabase.from('cartoon_projects')
      .update({ narration: existing, updated_at: new Date().toISOString() }).eq('id', project.id);
    if (saveError) throw new Error('Could not checkpoint narration: ' + saveError.message);
  }
  await rm(workDir, { recursive: true, force: true }).catch(() => {});
  return existing;
}
async function renderVideo(job, project) {
  if (!project.spec) throw new Error('Project has no storyboard to render.');
  const orientation = project.orientation || '9:16';
  const dims = orientation === '16:9' ? { width: 1920, height: 1080 } :
    orientation === '1:1' ? { width: 1080, height: 1080 } : { width: 1080, height: 1920 };
  const inputProps = {
    spec: project.spec,
    narration: project.narration || {},
    orientation,
    subtitles: project.subtitles !== false,
    brandLine: 'Shiney Brain Academy',
  };
  const outDir = path.join(tmpdir(), 'sba-cartoon-render');
  await mkdir(outDir, { recursive: true });
  const outputLocation = path.join(outDir, `${project.id}.mp4`);
  await setStage(job, 'rendering', 70, 'Bundling the Cartoon composition...');
  const { bundle } = await import('@remotion/bundler');
  const { selectComposition, renderMedia } = await import('@remotion/renderer');
  const entryPoint = path.join(REPO_ROOT, 'remotion', 'index.js');
  const serveUrl = await bundle({ entryPoint });
  assertLease(job);
  const composition = await selectComposition({
    serveUrl, id: 'CartoonVideo', inputProps,
    timeoutInMilliseconds: 120000,
  });
  await supabase.from('cartoon_projects').update({
    status: 'rendering', stage: 'rendering', stage_message: 'Rendering animated scenes...',
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  await setStage(job, 'rendering', 76, 'Rendering animated scenes...');
  let lastProgressWrite = 0;
  await renderMedia({
    composition: { ...composition, width: dims.width, height: dims.height },
    serveUrl, codec: 'h264', outputLocation, inputProps,
    concurrency: Math.max(1, Math.min(4, Number(process.env.CARTOON_RENDER_CONCURRENCY || 2))),
    onProgress: ({ progress }) => {
      const now = Date.now();
      if (now - lastProgressWrite < 2500 && progress < 1) return;
      lastProgressWrite = now;
      const value = 76 + Math.round(progress * 18);
      setStage(job, 'rendering', value, `Rendering cartoon video: ${Math.round(progress * 100)}%`).catch(err => log('progress update failed:', err.message));
    },
  });
  assertLease(job);
  const buffer = await readFile(outputLocation);
  if (!buffer.length) throw new Error('Remotion produced an empty MP4.');
  return { outputLocation, buffer, durationSeconds: composition.durationInFrames / composition.fps, dimensions: dims };
}
async function registerVideo(job, project, rendered) {
  if (!project.knowledge_asset_id) throw new Error('Project is missing its Knowledge Asset link.');
  await setStage(job, 'uploading', 96, 'Uploading the video and registering it in the SBA content library...');
  const slug = String(project.title || 'cartoon').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cartoon';
  const storagePath = `cartoon/${project.id}/${slug}.mp4`;
  const { error: uploadError } = await supabase.storage.from(VIDEO_BUCKET)
    .upload(storagePath, rendered.buffer, { contentType: 'video/mp4', upsert: true });
  if (uploadError) throw new Error('Video upload failed: ' + uploadError.message);
  const { data: publicData } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(storagePath);
  const videoUrl = publicData?.publicUrl;
  if (!videoUrl) throw new Error('Uploaded video has no public URL; refusing to save media_files with a null URL.');

  assertLease(job);
  const metadata = {
    engine: 'cartoon-studio', cartoon_project_id: project.id, cartoon_job_id: job.id,
    title: project.title, caption: project.spec?.caption || '', description: project.spec?.description || '',
    hashtags: project.spec?.hashtags || [], video_url: videoUrl, video_storage_path: storagePath,
    durationSeconds: rendered.durationSeconds, orientation: project.orientation, mime: 'video/mp4',
    rendered_at: new Date().toISOString(),
  };
  let assetId = project.content_asset_id || null;
  if (!assetId) {
    const { data: existing, error } = await supabase.from('content_assets').select('id')
      .contains('metadata', { cartoon_project_id: project.id }).limit(1).maybeSingle();
    if (error) throw new Error('Content asset recovery lookup failed: ' + error.message);
    assetId = existing?.id || null;
  }
  if (assetId) {
    const { error } = await supabase.from('content_assets').update({
      title: project.title, body: metadata.caption, metadata, asset_type: 'creator_video',
      format: 'video', status: 'draft',
    }).eq('id', assetId);
    if (error) throw new Error('Content asset update failed: ' + error.message);
  } else {
    const { data, error } = await supabase.from('content_assets').insert({
      knowledge_asset_id: project.knowledge_asset_id, asset_type: 'creator_video',
      format: 'video', title: project.title, body: metadata.caption,
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
    const { data: found, error } = await supabase.from('media_files').select('id')
      .eq('content_asset_id', assetId).eq('media_type', 'video').eq('role', 'primary').maybeSingle();
    if (error) throw new Error('Media recovery lookup failed: ' + error.message);
    mediaId = found?.id || null;
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
  const { error: projectError } = await supabase.from('cartoon_projects').update({
    status: 'ready', stage: 'done', progress: 100, stage_message: 'Cartoon video is ready.',
    video_url: videoUrl, video_storage_path: storagePath,
    video_size_bytes: rendered.buffer.length, duration_seconds: rendered.durationSeconds,
    content_asset_id: assetId, media_file_id: mediaId, error_message: null,
    updated_at: new Date().toISOString(),
  }).eq('id', project.id);
  if (projectError) throw new Error('Could not mark project ready: ' + projectError.message);
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
    if (job.job_type === 'script') {
      const generated = await makeStoryboard(job, project);
      project = { ...project, spec: generated.spec, knowledge_asset_id: generated.knowledgeAssetId, status: 'narrating' };
      const narration = await narrateScenes(job, project, generated.spec);
      assertLease(job);
      const { error } = await supabase.from('cartoon_projects').update({
        narration, status: 'cast_ready', stage: 'done', progress: 100,
        stage_message: 'Storyboard and narration ready for review.',
        updated_at: new Date().toISOString(),
      }).eq('id', project.id);
      if (error) throw new Error('Could not finish script and narration: ' + error.message);
    } else if (job.job_type === 'narrate') {
      if (!project.spec) throw new Error('Project has no storyboard.');
      const narration = await narrateScenes(job, project, project.spec);
      assertLease(job);
      await supabase.from('cartoon_projects').update({
        narration, status: 'cast_ready', stage: 'done', progress: 100,
        stage_message: 'Narration ready.', updated_at: new Date().toISOString(),
      }).eq('id', project.id);
    } else if (job.job_type === 'render') {
      if (!project.knowledge_asset_id) {
        const subject = 'General';
        const id = await ensureKnowledgeAsset(project, project.spec, subject);
        await supabase.from('cartoon_projects').update({ knowledge_asset_id: id }).eq('id', project.id);
        project.knowledge_asset_id = id;
      }
      const rendered = await renderVideo(job, project);
      assertLease(job);
      const saved = await registerVideo(job, project, rendered);
      await rm(rendered.outputLocation, { force: true }).catch(() => {});
      log('render complete:', saved.videoUrl);
    } else {
      throw new Error('Unsupported Cartoon job type: ' + job.job_type);
    }
    assertLease(job);
    const { data: completedJob, error: completeError } = await supabase.from('cartoon_jobs').update({
      status: 'completed', stage: 'done', progress: 100, stage_message: 'Completed',
      result: { completedAt: new Date().toISOString() }, completed_at: new Date().toISOString(),
      claim_token: null, worker_id: null, claimed_at: null, heartbeat_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('claim_token', job.claim_token).select('id').maybeSingle();
    if (completeError) throw new Error('Could not mark job completed: ' + completeError.message);
    if (!completedJob) throw new Error('Cartoon job lease was lost before completion could be recorded.');
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
  const { data, error } = await supabase.rpc('claim_cartoon_job', { p_worker_id: WORKER_ID });
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
    const result = await tick().catch(error => { log('tick failed:', error.message); return 'error'; });
    if (result !== 'processed') break;
    count++;
  }
  log('run-once finished:', count, 'job(s)');
  if (lastClaimError) {
    console.error('[cartoon-worker] exiting non-zero because the queue claim failed:', lastClaimError);
    process.exit(1);
  }
  process.exit(0);
}
async function loop() {
  if (stopping) return;
  await tick().catch(error => log('tick failed:', error.message));
  if (!stopping) setTimeout(loop, POLL_MS);
}
process.on('SIGINT', () => { stopping = true; log('stopping after current job'); });
process.on('SIGTERM', () => { stopping = true; log('stopping after current job'); });
log(WORKER_ID, 'polling every', POLL_MS, 'ms');
if (RUN_ONCE) runOnce();
else loop();
