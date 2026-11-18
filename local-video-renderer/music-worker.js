#!/usr/bin/env bun
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { openBrowser } from '@remotion/renderer';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';\nimport { syllabify } from '../lib/studio/theory.ts';

const execFile = promisify(execFileCb);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Missing Supabase URL or service-role key.');
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const WORKER_ID = `${os.hostname()}-music-${process.pid}-${randomUUID().slice(0, 8)}`;
const HEARTBEAT_MS = 20000, BUCKET = 'music-studio-media';
const TMP = path.join(os.tmpdir(), `sba-music-${randomUUID()}`);
let currentJob = null, heartbeatTimer = null, leaseLost = false;

async function heartbeat(job, stage, progress, message) {
  const { data, error } = await supabase.rpc('music_render_heartbeat', {
    p_job_id: job.id, p_claim_token: job.claim_token,
    p_stage: stage ?? null, p_progress: progress ?? null, p_message: message ?? null,
  });
  if (error) throw new Error(`Heartbeat failed: ${error.message}`);
  if (!data) { leaseLost = true; throw new Error('Music render lease was lost.'); }
}
async function registerWorker() {
  const { error } = await supabase.from('music_render_workers').upsert({
    worker_id: WORKER_ID, last_seen_at: new Date().toISOString(),
    current_job_id: currentJob?.id ?? null, info: { runtime: 'bun+chromium+ffmpeg' },
  });
  if (error) console.warn('[music-worker] liveness update failed:', error.message);
}
async function startHeartbeat(job) {
  await registerWorker();
  heartbeatTimer = setInterval(async () => {
    try { await heartbeat(job, null, null, null); await registerWorker(); }
    catch (e) { leaseLost = true; console.error('[music-worker] heartbeat error:', e.message); }
  }, HEARTBEAT_MS);
}
async function stage(job, name, pct, message) {
  if (leaseLost) throw new Error('Worker lease lost.');
  await heartbeat(job, name, pct, message);
  console.log(`[${job.id}] ${pct}% ${name}: ${message}`);
}

async function synthesizeTtsBank(job) {
  if (job.payload?.settings?.vocalMode !== 'tts' && job.payload?.spec?.vocal?.mode !== 'tts') return {};
  const items = new Set();
  for (const section of job.payload.spec.sections || []) {
    for (const line of section.lines || []) {
      for (const word of line.words || []) {
        const syllables = Array.isArray(word.syllables) && word.syllables.length
          ? word.syllables : syllabify(String(word.text || ''));
        for (const syllable of syllables) {
          const value = String(syllable || '').trim().toLowerCase().slice(0, 80);
          if (value) items.add(value);
        }
      }
    }
  }
  const queue = [...items];
  if (!queue.length) return {};
  const endpoint = (process.env.TTS_ENDPOINT || 'https://openai-edge-tts-aqq1.onrender.com').replace(/\/+$/, '');
  const audio = {};
  let next = 0, failures = 0, completed = 0;
  const worker = async () => {
    while (next < queue.length && failures < 3) {
      const item = queue[next++];
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`${endpoint}/v1/audio/speech`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'tts-1', input: item, voice: 'en-NG-EzinneNeural', speed: 1, response_format: 'wav' }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`TTS HTTP ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length < 512 || bytes.toString('ascii', 0, 4) !== 'RIFF') throw new Error('TTS returned invalid WAV data');
        audio[item] = bytes.toString('base64');
      } catch (error) {
        failures++;
        console.warn(`[music-worker] TTS fragment "${item}" unavailable:`, error.message);
      } finally {
        clearTimeout(timeout);
        completed++;
      }
      if (completed % 8 === 0) {
        await heartbeat(job, 'tts', Math.min(12, 5 + Math.round((completed / queue.length) * 7)),
          `Preparing voice fragments ${completed}/${queue.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, queue.length) }, () => worker()));
  console.log(`[music-worker] prepared ${Object.keys(audio).length}/${queue.length} TTS syllables`);
  return audio;
}

async function runEngine(job, dir, ttsBank) {
  const bundlePath = path.join(dir, 'music-engine.bundle.js');
  await execFile('bun', ['build', path.join(ROOT, 'lib/studio/background-entry.ts'), '--target=browser', '--outfile', bundlePath, '--format=iife', '--minify']);
  const browser = await openBrowser('chrome');
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 720, height: 1280, deviceScaleFactor: 1 });
    page.on('console', async (msg) => {
      const line = msg.text();
      if (!line.startsWith('SBA_MUSIC_PROGRESS:')) return;
      try {
        const p = JSON.parse(line.slice(19));
        await heartbeat(job, 'audio', Math.min(60, 10 + Math.round((p.percent || 0) * 0.5)), p.message || 'Rendering song audio');
      } catch (e) { console.warn('[music-worker] progress update skipped:', e.message); }
    });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#111"></body></html>');
    await page.addScriptTag({ path: bundlePath });
    await page.evaluate(({ payload, bank }) => { window.__SBA_MUSIC_JOB__ = payload; window.__SBA_MUSIC_TTS_BANK__ = bank; }, { payload: job.payload, bank: ttsBank });
    const summary = await page.evaluate(async () => {
      if (!window.__SBA_MUSIC_RENDER__) throw new Error('Music renderer bundle did not initialize.');
      return await window.__SBA_MUSIC_RENDER__();
    });
    const wavBase64 = await page.evaluate(() => window.__SBA_MUSIC_RESULT__?.wavBase64 || '');
    if (!wavBase64) throw new Error('Audio engine returned an empty WAV.');
    await writeFile(path.join(dir, 'audio.wav'), Buffer.from(wavBase64, 'base64'));
    const framesDir = path.join(dir, 'frames'); await mkdir(framesDir, { recursive: true });
    const batchSize = 24;
    for (let start = 0; start < summary.frameCount; start += batchSize) {
      if (leaseLost) throw new Error('Worker lease lost during video rendering.');
      const frames = await page.evaluate(({ start, count }) => {
        if (!window.__SBA_MUSIC_RENDER_BATCH__) throw new Error('Video frame renderer unavailable.');
        return window.__SBA_MUSIC_RENDER_BATCH__(start, count);
      }, { start, count: batchSize });
      for (let i = 0; i < frames.length; i++) {
        await writeFile(path.join(framesDir, `frame-${String(start + i + 1).padStart(6, '0')}.jpg`), Buffer.from(frames[i], 'base64'));
      }
      await heartbeat(job, 'video', 60 + Math.round(((start + frames.length) / summary.frameCount) * 25),
        `Rendering synchronized video frames ${Math.min(start + frames.length, summary.frameCount)}/${summary.frameCount}`);
    }
    return { ...summary, warnings: await page.evaluate(() => window.__SBA_MUSIC_RESULT__?.warnings || []) };
  } finally { await browser.close(); }
}

async function muxVideo(dir, summary) {
  const output = path.join(dir, 'song.mp4');
  await execFile('ffmpeg', [
    '-hide_banner','-loglevel','error','-y',
    '-framerate',String(summary.fps),'-i',path.join(dir,'frames','frame-%06d.jpg'),
    '-i',path.join(dir,'audio.wav'),'-c:v','libx264','-preset','veryfast','-crf','20',
    '-pix_fmt','yuv420p','-r',String(summary.fps),'-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',output,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return output;
}
async function uploadFile(localPath, storagePath, contentType) {
  const bytes = await readFile(localPath);
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, { contentType, upsert: true, cacheControl: '31536000' });
  if (error) throw new Error(`Storage upload failed (${storagePath}): ${error.message}`);
  return { url: supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl, size: bytes.byteLength, path: storagePath };
}
async function attachMedia(job, audio, video, summary) {
  if (!job.content_asset_id) return [];
  const rows = [
    { content_asset_id:job.content_asset_id,media_type:'video',role:'primary',position:0,url:video.url,storage_path:video.path,width:summary.width,height:summary.height,duration_seconds:summary.durationSec+1.6,file_size_bytes:video.size,mime_type:'video/mp4',source:'ai_generated',alt_text:`Learning song video: ${job.title}` },
    { content_asset_id:job.content_asset_id,media_type:'audio',role:'audio',position:1,url:audio.url,storage_path:audio.path,duration_seconds:summary.durationSec+1.6,file_size_bytes:audio.size,mime_type:'audio/wav',source:'ai_generated',alt_text:`Learning song audio: ${job.title}` },
  ];
  const ids=[];
  for (const row of rows) {
    const {data:old}=await supabase.from('media_files').select('id').eq('content_asset_id',job.content_asset_id).eq('storage_path',row.storage_path).maybeSingle();
    if(old?.id){ids.push(old.id);continue;}
    const {data,error}=await supabase.from('media_files').insert(row).select('id').single();
    if(error) throw new Error(`Could not attach media to Social Engine: ${error.message}`);
    ids.push(data.id);
  }
  return ids;
}
async function processJob(job) {
  currentJob=job; leaseLost=false; await startHeartbeat(job);
  try {
    if(!job.payload?.spec||!job.payload?.settings) throw new Error('Job is missing SongSpec or Studio settings.');
    await stage(job,'preparing',5,'Preparing independent music renderer');
    await mkdir(TMP,{recursive:true});
    const ttsBank = await synthesizeTtsBank(job);\n    const summary=await runEngine(job,TMP,ttsBank);
    await stage(job,'encoding',87,'Encoding synchronized MP4 video');
    const videoPath=await muxVideo(TMP,summary);
    await stage(job,'uploading',93,'Uploading audio and video to SBA media storage');
    const base=`music-render/${job.id}`;
    const [audio,video]=await Promise.all([
      uploadFile(path.join(TMP,'audio.wav'),`${base}/song.wav`,'audio/wav'),
      uploadFile(videoPath,`${base}/song.mp4`,'video/mp4'),
    ]);
    const mediaIds=await attachMedia(job,audio,video,summary);
    await stage(job,'completed',100,'Song rendered and saved successfully');
    const {error}=await supabase.from('music_render_jobs').update({
      status:'completed',stage:'completed',stage_message:'Song rendered and saved successfully',progress:100,
      audio_url:audio.url,audio_storage_path:audio.path,video_url:video.url,video_storage_path:video.path,
      media_file_ids:mediaIds,error_message:summary.warnings?.length?summary.warnings.join(' | ').slice(0,1800):null,
      completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),
      claim_token:null,worker_id:null,claimed_at:null,heartbeat_at:null,
    }).eq('id',job.id).eq('claim_token',job.claim_token);
    if(error) throw new Error(`Could not mark render complete: ${error.message}`);
    console.log(`[music-worker] completed ${job.id}: ${video.url}`);
  } catch(error) {
    const message=error instanceof Error?error.message:String(error);
    console.error(`[music-worker] job ${job.id} failed:`,message);
    if(!leaseLost) await supabase.from('music_render_jobs').update({
      status:'failed',stage:'failed',stage_message:'Background rendering failed',
      error_message:message.slice(0,1800),updated_at:new Date().toISOString(),
      claim_token:null,worker_id:null,claimed_at:null,heartbeat_at:null,
    }).eq('id',job.id).eq('claim_token',job.claim_token);
  } finally {
    if(heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer=null;currentJob=null;await registerWorker();
    await rm(TMP,{recursive:true,force:true}).catch(()=>{});
  }
}
async function main(){
  await registerWorker();
  const {data,error}=await supabase.rpc('claim_music_render_job',{p_worker_id:WORKER_ID});
  if(error) throw new Error(`Could not claim music job: ${error.message}`);
  const job=Array.isArray(data)?data[0]:data;
  if(!job){console.log('[music-worker] no queued songs.');return;}
  console.log(`[music-worker] claimed ${job.id}: ${job.title}`);
  await processJob(job);
}
await main();
