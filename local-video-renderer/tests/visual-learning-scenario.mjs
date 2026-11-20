// Visual Learning worker scenario test: drives the real visual-learning-worker.js
// against the in-memory Supabase fake with stubbed planner/TTS/imagery and a
// stand-in for the Chrome render step. Usage (from repo root):
//   PATH=<fake-bun-dir>:$PATH bun --preload ./local-video-renderer/tests/visual-learning-stubs-plugin.mjs \
//     local-video-renderer/tests/visual-learning-scenario.mjs <scenario>
import { randomUUID } from 'node:crypto';
const name = process.argv[2];
const fake = await import('./fake-supabase.mjs');
globalThis.__fakeSupabase = { createClient: fake.createClient };
const { db, storage, faults, log } = fake;

db.visual_learning_jobs.push({
  id: randomUUID(),
  title: 'Why Sleep Is a Study Superpower',
  topic: 'why sleep helps studying',
  spec: { audience: 'students', tone: 'warm', targetSeconds: 120, aspect: '16:9', style: 'cartoon', voice: 'warm_male', music: true, subtitles: true, seed: 7, imageProvider: 'pollinations', watermark: 'Shiney Brain Academy', maxShotSeconds: 3 },
  status: 'queued',
  stage: 'queued',
  script: null,
  image_manifest: null,
  narration_manifest: null,
  timeline: null,
  attempt_count: 0,
  claim_token: null,
  heartbeat_at: null,
  created_at: new Date().toISOString(),
});
// Two active video channels + one non-video platform the worker must skip.
db.social_channels_v2.push(
  { id: 'ch-yt', platform: 'youtube', is_active: true },
  { id: 'ch-tt', platform: 'tiktok', is_active: true },
  { id: 'ch-x', platform: 'x', is_active: true },
);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.VISUAL_LEARNING_WORKER_POLL_MS = '3000';
process.env.VL_NARRATION_PROVIDER = 'proxy'; // stubbed providers intercept regardless
process.env.VL_IMAGE_PROVIDER = 'pollinations'; // stubbed imagery intercepts regardless

if (name.startsWith('script_')) {
  process.env.SCRIPT_MODE = { script_ok: 'ok', script_retry: 'garbage_then_ok', script_fail: 'fail', script_garbage: 'garbage' }[name];
}
if (name === 'tts_fail') process.env.TTS_MODE = 'fail';
if (name === 'render_fail') process.env.RENDER_MODE = 'fail';
if (name === 'upload_fail') faults.uploadBucket = 'lesson-videos';
if (name === 'rpc_missing') faults.rpcError = 'Could not find the function public.claim_visual_learning_job(p_worker_id) in the schema cache';
if (name === 'crash_resume') {
  Object.assign(db.visual_learning_jobs[0], { stage: 'imagery', claim_token: randomUUID(), worker_id: 'dead-worker', attempt_count: 1, heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
}
if (name === 'poison') {
  Object.assign(db.visual_learning_jobs[0], { stage: 'imagery', claim_token: randomUUID(), worker_id: 'dead-worker', attempt_count: 3, heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
}
if (name === 'no_publish') db.visual_learning_jobs[0].spec.auto_publish = false;
if (name === 'once') process.env.VISUAL_LEARNING_RUN_ONCE = '1';

if (name === 'once') {
  process.on('exit', (code) => {
    const j = db.visual_learning_jobs[0];
    console.log('RESULT ' + JSON.stringify({ scenario: 'once', status: j.status, exit_code: code, content_assets: db.content_assets.length, exited_by_worker: true }));
  });
  await import('../visual-learning-worker.js');
  await new Promise((r) => setTimeout(r, 120000));
  console.log('RESULT ' + JSON.stringify({ scenario: 'once', exited_by_worker: false }));
  process.exit(0);
}

await import('../visual-learning-worker.js');

const terminal = () => ['ready', 'failed'].includes(db.visual_learning_jobs[0].status);
const deadline = Date.now() + (name === 'rpc_missing' ? 9000 : 180000);
while (!terminal() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));

let rerun = null;
if (name === 'rerun' && db.visual_learning_jobs[0].status === 'ready') {
  // simulate: worker died after inserting the asset but before the job row stored its id
  Object.assign(db.visual_learning_jobs[0], { status: 'rendering', stage: 'rendering', claim_token: null, heartbeat_at: null, content_asset_id: null, media_file_id: null });
  const d2 = Date.now() + 180000;
  while (db.visual_learning_jobs[0].status !== 'ready' && Date.now() < d2) await new Promise((r) => setTimeout(r, 250));
  rerun = 'second pass finished';
}

const j = db.visual_learning_jobs[0];
const videoKey = j.storage_path ? `lesson-videos/${j.storage_path}` : null;
const timelineShots = (j.timeline?.scenes || []).reduce((a, s) => a + (s.shots?.length || 0), 0);
console.log('RESULT ' + JSON.stringify({
  scenario: name,
  status: j.status,
  stage: j.stage,
  error: (j.error_message || '').slice(0, 200),
  content_assets: db.content_assets.length,
  media_files: db.media_files.length,
  publish_jobs: db.publish_jobs.length,
  ka_rows: db.knowledge_assets.length,
  has_script: Array.isArray(j.script?.scenes) && j.script.scenes.length > 0,
  has_timeline: !!j.timeline,
  script_provider: j.script_provider,
  attempts: j.attempt_count,
  worker_registered: db.visual_learning_workers.length,
  video_uploaded: videoKey ? storage.has(videoKey) : false,
  preview_assets: [...storage.keys()].filter((k) => k.startsWith('visual-learning-assets/visual-learning/')).length,
  narration_clips: j.narration_manifest?.clips?.length || 0,
  image_count: j.image_manifest?.assets?.length || 0,
  timeline_shots: timelineShots,
  duration_seconds: j.duration_seconds,
  stages: [...new Set(log.stageHistory)],
  rerun,
}));
process.exit(0);
