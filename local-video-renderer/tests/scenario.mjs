// Usage (from repo root): PATH=<fake-bun-dir>:$PATH <real-bun> --preload ./local-video-renderer/tests/stubs-plugin.mjs local-video-renderer/tests/scenario.mjs <name>
import fs from 'node:fs';
const name = process.argv[2];
const fake = await import('./fake-supabase.mjs');
globalThis.__fakeSupabase = { createClient: fake.createClient };
const { db, storage, faults, log } = fake;

const script = fs.readFileSync('whiteboard-engine/demos/photosynthesis/script.txt', 'utf8');
const base = { id: crypto.randomUUID(), title: 'Photosynthesis', subject: 'biology', status: 'narrating', stage: 'queued', script_text: script, knowledge_asset_id: crypto.randomUUID(), timeline: null, audio_files: [], attempt_count: 0, claim_token: null, heartbeat_at: null, created_at: new Date().toISOString() };
db.whiteboard_jobs.push({ ...base });
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.WHITEBOARD_WORKER_POLL_MS = '3000';

if (name.startsWith('ai_')) {
  Object.assign(db.whiteboard_jobs[0], { title: 'Cell', topic: 'Cell', script_text: '', knowledge_asset_id: null });
  process.env.SCRIPT_MODE = { ai_ok: 'ok', ai_retry: 'garbage_then_ok', ai_fail: 'fail', ai_garbage: 'garbage' }[name];
}
if (name === 'once') {
  process.env.WHITEBOARD_RUN_ONCE = '1';
  // run-once mode must exit by itself; report from the exit hook (the harness never calls exit).
  process.on('exit', (code) => {
    const j = db.whiteboard_jobs[0];
    console.log('RESULT ' + JSON.stringify({ scenario: 'once', status: j.status, exit_code: code, content_assets: db.content_assets.length, exited_by_worker: true }));
  });
  await import('../whiteboard-worker.js');
  await new Promise((r) => setTimeout(r, 90000));
  console.log('RESULT ' + JSON.stringify({ scenario: 'once', exited_by_worker: false }));
  process.exit(0);
}
if (name === 'tts_fail') process.env.TTS_MODE = 'fail';
if (name === 'tts_flaky') process.env.TTS_MODE = 'flaky';
if (name === 'pcm') process.env.TTS_MODE = 'pcm';
if (name === 'render_fail') process.env.RENDER_MODE = 'fail';
if (name === 'upload_fail') faults.uploadBucket = 'lesson-videos';
if (name === 'rpc_missing') faults.rpcError = 'Could not find the function public.claim_whiteboard_job(p_worker_id) in the schema cache';
if (name === 'crash_resume') {
  Object.assign(db.whiteboard_jobs[0], { stage: 'narrating', claim_token: crypto.randomUUID(), worker_id: 'dead-worker', attempt_count: 1, heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
}
if (name === 'poison') {
  Object.assign(db.whiteboard_jobs[0], { stage: 'narrating', claim_token: crypto.randomUUID(), worker_id: 'dead-worker', attempt_count: 3, heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
}

await import('../whiteboard-worker.js');

const terminal = () => ['ready', 'failed'].includes(db.whiteboard_jobs[0].status);
const deadline = Date.now() + (name === 'rpc_missing' ? 9000 : 60000);
while (!terminal() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));

let rerun = null;
if (name === 'rerun' && db.whiteboard_jobs[0].status === 'ready') {
  // simulate: worker died after inserting the asset but before the job row stored its id
  Object.assign(db.whiteboard_jobs[0], { status: 'rendering', stage: 'rendering', claim_token: null, heartbeat_at: null, content_asset_id: null, media_file_id: null });
  const d2 = Date.now() + 60000;
  while (db.whiteboard_jobs[0].status !== 'ready' && Date.now() < d2) await new Promise((r) => setTimeout(r, 250));
  rerun = 'second pass finished';
}

const j = db.whiteboard_jobs[0];
console.log('RESULT ' + JSON.stringify({
  scenario: name, status: j.status, stage: j.stage, attempts: j.attempt_count, error: j.error_message?.slice(0, 160) ?? null,
  video_url: !!j.video_url, content_assets: db.content_assets.length, media_files: db.media_files.length,
  asset_links_knowledge: !!db.content_assets[0]?.knowledge_asset_id && db.content_assets[0].knowledge_asset_id === (db.whiteboard_jobs[0].knowledge_asset_id), title: j.title, has_script: !!j.script_text, ka_rows: db.knowledge_assets.length,
  media_type: db.media_files[0]?.media_type, audio_files: j.audio_files?.length, has_timeline: !!j.timeline,
  worker_registered: db.whiteboard_workers.length, stages: [...new Set(log.stageHistory)],
  audio_is_riff: [...storage.entries()].filter(([k]) => k.startsWith('whiteboard-assets/')).every(([, v]) => v.toString('latin1', 0, 4) === 'RIFF'),
  stored_objects: storage.size, rerun,
}));
process.exit(0);
