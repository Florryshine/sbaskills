#!/usr/bin/env bun
// Durable Phase 4 narration worker. TTS runs outside Vercel request limits.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile, rm } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { synthesizeSceneNarration, VOICE_PRESETS } from '../visual-learning-engine/src/narration/providers';
import { buildNarrationManifest } from '../lib/image-explainer/narration-manifest.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase URL and service-role key are required.');
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const workerId = `${hostname()}-image-explainer-${process.pid}-${randomUUID().slice(0, 8)}`;
const runOnceMaxMs = Number(process.env.IMAGE_EXPLAINER_RUN_ONCE_MAX_MS || 45 * 60 * 1000);
const TTS_ENDPOINT = process.env.TTS_ENDPOINT;
let currentJob = null;

async function updateClaimed(job, patch) {
  const { data, error } = await supabase.from('image_explainer_jobs').update({
    ...patch, heartbeat_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', job.id).eq('claim_token', job.claim_token).select('id').maybeSingle();
  if (error) throw new Error(`Could not update claimed narration job: ${error.message}`);
  if (!data) throw new Error('Narration job lease was lost.');
}

async function process(job) {
  currentJob = job.id;
  const workDir = join(tmpdir(), `image-explainer-${job.id}-${randomUUID()}`);
  try {
    const scenes = job.script?.scenes;
    if (!Array.isArray(scenes) || !scenes.length || job.script?.review_status !== 'admin_reviewed') {
      throw new Error('This job has no administrator-approved script and storyboard.');
    }
    const preset = VOICE_PRESETS[job.spec?.voice] ? job.spec.voice : 'friendly_female';
    const clips = [];
    await updateClaimed(job, { stage: 'narration_generating', stage_message: `Generating scene 1 of ${scenes.length}.` });
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      if (!scene.narration?.trim()) throw new Error(`Scene ${index + 1} has no narration text.`);
      const result = await synthesizeSceneNarration(
        { text: scene.narration, preset, rate: '+0%' },
        { proxyEndpoint: TTS_ENDPOINT, allowSilent: false },
      );
      if (!result || !result.duration || result.duration <= 0) throw new Error(`TTS providers could not produce valid audio for scene ${index + 1}.`);
      const bytes = await readFile(result.file);
      if (bytes.length < 512) throw new Error(`Scene ${index + 1} audio is empty or corrupt.`);
      const ext = result.ext === 'wav' ? 'wav' : 'mp3';
      const path = `${job.created_by || 'admin'}/${job.id}/scene-${String(index + 1).padStart(3, '0')}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('image-explainer-audio').upload(path, bytes, {
        contentType: ext === 'wav' ? 'audio/wav' : 'audio/mpeg', upsert: true,
      });
      if (uploadError) throw new Error(`Audio upload failed for scene ${index + 1}: ${uploadError.message}`);
      clips.push({ path, ext, duration: result.duration, provider: result.provider, voice: result.voice, words: result.words });
      await updateClaimed(job, {
        stage: 'narration_generating',
        stage_message: `Generated and stored narration for scene ${index + 1} of ${scenes.length}.`,
      });
    }
    const manifest = buildNarrationManifest({ scenes, clips, voicePreset: preset, language: job.spec?.language || 'English' });
    await updateClaimed(job, {
      narration_manifest: manifest,
      status: 'analysed',
      stage: 'narration_ready',
      stage_message: `Narration ready: ${manifest.clip_count} clips, ${Math.round(manifest.total_duration_seconds)} seconds of measured speech. Review audio before continuing.`,
      error_message: null,
      claim_token: null, worker_id: null, heartbeat_at: null,
    });
    console.log(`[image-explainer-worker] narration complete ${job.id}: ${manifest.clip_count} clips`);
  } catch (error) {
    console.error(`[image-explainer-worker] job ${job.id} failed:`, error);
    await supabase.from('image_explainer_jobs').update({
      status: 'failed', stage: 'narration_failed',
      stage_message: 'Narration failed. The approved script and any uploaded scene audio are preserved for retry.',
      error_message: String(error?.message || error).slice(0, 1500),
      claim_token: null, worker_id: null, heartbeat_at: null,
      updated_at: new Date().toISOString(),
    }).eq('id', job.id).eq('claim_token', job.claim_token);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    currentJob = null;
  }
}

async function run() {
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < runOnceMaxMs) {
    const { data, error } = await supabase.rpc('claim_image_explainer_narration_job', { p_worker_id: workerId });
    if (error) throw new Error(`Narration queue claim failed: ${error.message}. Apply migration 20261124103000_image_explainer_narration.sql.`);
    const job = Array.isArray(data) ? data[0] : data;
    if (!job) break;
    await process(job);
    processed++;
  }
  console.log(`[image-explainer-worker] finished; processed ${processed} narration job(s)`);
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
