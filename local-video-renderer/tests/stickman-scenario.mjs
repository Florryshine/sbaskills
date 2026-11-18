// Usage (from repo root): PATH=<fake-bun-dir>:$PATH <real-bun> --preload ./local-video-renderer/tests/stickman-stubs-plugin.mjs local-video-renderer/tests/stickman-scenario.mjs <name>
// Drives the REAL stickman-worker.js against the in-memory Supabase fake, a
// stubbed TTS/planner and a stand-in for the Remotion render step.
import fs from 'node:fs';
const name = process.argv[2];
const fake = await import('./fake-supabase.mjs');
globalThis.__fakeSupabase = { createClient: fake.createClient };
const { db, storage, faults, log } = fake;

const script = JSON.parse(fs.readFileSync('stickman-engine/scenes/friction-story.json', 'utf8'));
const base = {
  id: crypto.randomUUID(),
  title: 'Velocity',
  topic: 'Friction',
  subject: 'physics',
  status: 'queued',
  stage: 'queued',
  script_text: JSON.stringify(script),
  knowledge_asset_id: null,
  timeline: null,
  audio_files: [],
  auto_publish: true,
  attempt_count: 0,
  claim_token: null,
  heartbeat_at: null,
  created_at: new Date().toISOString(),
};
db.stickman_jobs.push({ ...base });
// Two active video channels + one non-video platform the worker must skip.
db.social_channels_v2.push(
  { id: 'ch-yt', platform: 'youtube', is_active: true },
  { id: 'ch-tt', platform: 'tiktok', is_active: true },
  { id: 'ch-x', platform: 'x', is_active: true },
);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.STICKMAN_WORKER_POLL_MS = '3000';

if (name.startsWith('ai_')) {
  Object.assign(db.stickman_jobs[0], { title: 'Friction video', topic: 'Friction', script_text: '', knowledge_asset_id: null });
  process.env.SCRIPT_MODE = { ai_ok: 'ok', ai_retry: 'garbage_then_ok', ai_fail: 'fail', ai_garbage: 'garbage' }[name];
}
if (name === 'ai_lesson') {
  // AI job anchored to an existing Knowledge Asset: script is grounded, KA reused not duplicated.
  Object.assign(db.stickman_jobs[0], { title: 'Friction video', topic: 'Friction', script_text: '', knowledge_asset_id: 'ka-existing' });
  db.knowledge_assets.push({ id: 'ka-existing', keyword: 'Friction', subject: 'physics', summary: 'Force that opposes motion', raw_content: 'Friction opposes sliding. f = mu x N.', key_concepts: [] });
  process.env.SCRIPT_MODE = 'ok';
}
if (name === 'no_publish') db.stickman_jobs[0].auto_publish = false;
if (name === 'once') {
  process.env.STICKMAN_RUN_ONCE = '1';
  // run-once mode must exit by itself; report from the exit hook (the harness never calls exit).
  process.on('exit', (code) => {
    const j = db.stickman_jobs[0];
    console.log('RESULT ' + JSON.stringify({ scenario: 'once', status: j.status, exit_code: code, content_assets: db.content_assets.length, exited_by_worker: true }));
  });
  await import('../stickman-worker.js');
  await new Promise((r) => setTimeout(r, 90000));
  console.log('RESULT ' + JSON.stringify({ scenario: 'once', exited_by_worker: false }));
  process.exit(0);
}
if (name === 'tts_fail') process.env.TTS_MODE = 'fail';
if (name === 'tts_flaky') process.env.TTS_MODE = 'flaky';
if (name === 'render_fail') process.env.RENDER_MODE = 'fail';
if (name === 'upload_fail') faults.uploadBucket = 'lesson-videos';
if (name === 'rpc_missing') faults.rpcError = 'Could not find the function public.claim_stickman_job(p_worker_id) in the schema cache';
if (name === 'crash_resume') {
  // A dead worker left the job claimed AFTER narration completed: timeline +
  // audio_files are saved, so the next claim must resume without re-TTS.
  const audioFiles = (script.scenes).flatMap((sc, si) => (sc.dialogue || []).map((d, li) => ({
    key: `${si}:${li}`, file: `narration/${si}-${li}.wav`, storagePath: `${db.stickman_jobs[0].id}/${si}-${li}.wav`, publicUrl: `https://fake.supabase.co/storage/v1/object/public/stickman-assets/${db.stickman_jobs[0].id}/${si}-${li}.wav`, dur: 2,
  })));
  // The saved timeline is the real compiled one (what the renderer consumes).
  const mod = await import('../../stickman-engine/src/scene/compiler.ts');
  const timeline = mod.compile(script, Object.fromEntries(audioFiles.map((e) => [e.key, { file: e.file, dur: e.dur }])));
  Object.assign(db.stickman_jobs[0], {
    stage: 'narrating',
    claim_token: crypto.randomUUID(),
    worker_id: 'dead-worker',
    attempt_count: 1,
    heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    audio_files: audioFiles,
    timeline,
  });
  // seed the storage objects the resume path downloads
  for (const e of audioFiles) {
    storage.set(`stickman-assets/${e.storagePath}`, makeWavBuffer(2));
  }
}
if (name === 'poison') {
  Object.assign(db.stickman_jobs[0], { stage: 'narrating', claim_token: crypto.randomUUID(), worker_id: 'dead-worker', attempt_count: 3, heartbeat_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() });
}

await import('../stickman-worker.js');

const terminal = () => ['ready', 'failed'].includes(db.stickman_jobs[0].status);
const deadline = Date.now() + (name === 'rpc_missing' ? 9000 : 90000);
while (!terminal() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));

let rerun = null;
if (name === 'rerun' && db.stickman_jobs[0].status === 'ready') {
  // simulate: worker died after inserting the asset but before the job row stored its id
  Object.assign(db.stickman_jobs[0], { status: 'rendering', stage: 'rendering', claim_token: null, heartbeat_at: null, content_asset_id: null, media_file_id: null });
  const d2 = Date.now() + 90000;
  while (db.stickman_jobs[0].status !== 'ready' && Date.now() < d2) await new Promise((r) => setTimeout(r, 250));
  rerun = 'second pass finished';
}

const j = db.stickman_jobs[0];
const audioEntries = (j.audio_files || []).filter((a) => a && typeof a === 'object');
console.log('RESULT ' + JSON.stringify({
  scenario: name,
  status: j.status,
  stage: j.stage,
  attempts: j.attempt_count,
  error: j.error_message?.slice(0, 160) ?? null,
  video_url: !!j.video_url,
  content_assets: db.content_assets.length,
  media_files: db.media_files.length,
  publish_jobs: db.publish_jobs.length,
  asset_links_knowledge: !!db.content_assets[0]?.knowledge_asset_id && db.content_assets[0].knowledge_asset_id === j.knowledge_asset_id,
  ka_reused: name === 'ai_lesson' ? (j.knowledge_asset_id === 'ka-existing' && db.knowledge_assets.length === 1) : undefined,
  title: j.title,
  has_script: !!j.script_text,
  ka_rows: db.knowledge_assets.length,
  worker_registered: db.stickman_workers.length,
  stages: [...new Set(log.stageHistory)],
  narration_entries: audioEntries.length,
  narration_have_urls: audioEntries.every((a) => !!a.publicUrl),
  timeline_audio: j.timeline?.audio?.length ?? null,
  has_timeline: !!j.timeline,
  // The audio-timing contract: every clip carries the compiler-assigned
  // frameStart (what the composition's <Sequence from> must honor).
  audio_starts_increasing: Array.isArray(j.timeline?.audio)
    && j.timeline.audio.length > 1
    && j.timeline.audio.every((a, i) => i === 0 || a.frameStart > j.timeline.audio[i - 1].frameStart),
  audio_is_riff: [...storage.entries()].filter(([k]) => k.startsWith('stickman-assets/')).every(([, v]) => v.toString('latin1', 0, 4) === 'RIFF'),
  stored_objects: storage.size,
  tts_calls: globalThis.__ttsCalls ?? null,
  script_calls: globalThis.__scriptCalls ?? null,
  rerun,
}));

function makeWavBuffer(seconds) {
  const pcm = Buffer.alloc(24000 * 2 * seconds);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'latin1');
  header.write('fmt ', 12, 'latin1');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'latin1');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
process.exit(0);
