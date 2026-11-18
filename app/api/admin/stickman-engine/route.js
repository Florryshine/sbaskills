// app/api/admin/stickman-engine/route.js
//
// Stickman Animation Engine — job creation, status, retry.
//   POST { useAI?, topic?, subject?, knowledgeAssetId?, script?, title?, autoPublish? }
//     useAI  -> stores only the topic (+subject + optional lesson Knowledge
//               Asset). The persistent Bun worker
//               (local-video-renderer/stickman-worker.js) generates, validates
//               and saves the SceneScript, so the slow multi-provider LLM call
//               never runs inside this time-limited serverless function.
//     script -> SceneScript JSON (see stickman-engine/src/rig/character.ts);
//               validated against the shared engine validator, its Knowledge
//               Asset resolved/created here, then queued.
//   GET ?id=<jobId>  -> full job (timeline included for the player preview)
//   GET (no id)      -> 20 most recent jobs + worker liveness + dispatch status
//   PATCH { id, action: "retry" } -> re-queue a failed job; saved narration and
//               timeline are kept so the retry resumes at rendering.
//
// Free toolchain only: edge-tts (no key) via lib/podcastTTS, Remotion render
// on the existing worker fleet, storage via lesson-videos contract.

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateSceneScript } from '../../../../stickman-engine/src/scene/validate';

export const maxDuration = 60;

const SUBJECTS = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

// A worker that has not polled for this long is treated as offline (poll is 15s).
const WORKER_ONLINE_MS = 90 * 1000;

// Supabase owns dispatching. The trigger and minute sweeper write their latest
// attempt here so the admin UI can distinguish a missing token from a GitHub rejection.
async function getDispatchStatus(supabase) {
  const { data, error } = await supabase
    .from('stickman_dispatch_attempts')
    .select('created_at, source, http_status, error_message, completed_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return { unknown: true, reason: error.message, latest: null };
  return { unknown: false, latest: data?.[0] || null };
}

async function getWorkerStatus(supabase) {
  const { data, error } = await supabase
    .from('stickman_workers')
    .select('worker_id, last_seen_at, current_job_id, info')
    .order('last_seen_at', { ascending: false })
    .limit(5);
  if (error) {
    // Table missing => the observability migration is not applied; surface that
    // instead of guessing (mirrors the whiteboard engine's behaviour).
    return { online: false, last_seen_at: null, unknown: true, reason: error.message };
  }
  const latest = data?.[0] || null;
  const online = !!latest && Date.now() - new Date(latest.last_seen_at).getTime() < WORKER_ONLINE_MS;
  return { online, last_seen_at: latest?.last_seen_at || null, last_error: latest?.info?.last_error || null, unknown: false };
}

// Resolve (or create) the Knowledge Asset a creator_video must point at.
// content_assets requires a knowledge_asset_id, so creating one without this
// link would fail later in the worker and never reach the Social Engine.
async function resolveOrCreateKnowledgeAsset(supabase, keyword, subject, script) {
  const cleanKeyword = String(keyword || 'Stickman lesson').trim().slice(0, 200) || 'Stickman lesson';
  const cleanSubject = SUBJECTS.includes(subject) ? subject : 'general';

  const { data: matching, error: lookupError } = await supabase
    .from('knowledge_assets')
    .select('id')
    .eq('keyword', cleanKeyword)
    .eq('subject', cleanSubject)
    .limit(1);
  if (lookupError) throw new Error(`Knowledge Asset lookup failed: ${lookupError.message}`);
  if (matching?.[0]?.id) return matching[0].id;

  const titleOverlays = (script.scenes || [])
    .flatMap((sc) => (sc.overlays || []))
    .filter((o) => o.type === 'title' && o.text)
    .map((o) => o.text);
  const formulaTexts = (script.scenes || [])
    .flatMap((sc) => (sc.overlays || []))
    .filter((o) => o.type === 'formula' && o.text)
    .map((o) => o.text);

  const { data: created, error: createError } = await supabase
    .from('knowledge_assets')
    .insert({
      keyword: cleanKeyword,
      topic_type: cleanSubject === 'general' ? 'creator_video' : 'curriculum_topic',
      subject: cleanSubject,
      summary: `Stickman animation: ${cleanKeyword}`,
      raw_content: JSON.stringify(script).slice(0, 12000),
      learning_objectives: [],
      key_concepts: [...new Set([...titleOverlays, ...formulaTexts])].slice(0, 12),
      definitions: [],
      examples: [],
      facts: [],
      common_mistakes: [],
      sub_topics: [],
      status: 'draft',
      source: 'stickman_animation_engine',
    })
    .select('id')
    .single();
  if (createError) throw new Error(`Knowledge Asset creation failed: ${createError.message}`);
  return created.id;
}

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const supabase = createAdminClient();

  if (!id) {
    let { data, error } = await supabase
      .from('stickman_jobs')
      .select('id, title, topic, subject, status, stage, stage_message, video_url, duration_seconds, error_message, created_at, knowledge_asset_id')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error && /subject|knowledge_asset_id/i.test(error.message)) {
      // Observability migration not applied yet: keep the page usable.
      ({ data, error } = await supabase
        .from('stickman_jobs')
        .select('id, title, topic, status, stage, stage_message, video_url, duration_seconds, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(20));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const [worker, dispatch] = await Promise.all([getWorkerStatus(supabase), getDispatchStatus(supabase)]);
    return NextResponse.json({ jobs: data, worker, dispatch });
  }

  const { data: job, error } = await supabase
    .from('stickman_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  const [worker, dispatch] = await Promise.all([getWorkerStatus(supabase), getDispatchStatus(supabase)]);
  return NextResponse.json({ job, worker, dispatch, serverTime: new Date().toISOString() });
}

// PATCH { id, action: 'retry' } — re-queue a failed job. Narration/timeline
// already saved on the job are kept, so a retry resumes at rendering;
// content_assets/media_files are reused by the worker (idempotent), so
// retries never create duplicate records.
export async function PATCH(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body?.id || body.action !== 'retry') {
    return NextResponse.json({ error: 'Provide { id, action: "retry" }.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('stickman_jobs')
    .select('id, status, stage, timeline, audio_files, script_text')
    .eq('id', body.id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'failed') {
    return NextResponse.json({ error: `Only failed jobs can be retried (this one is ${job.status}).` }, { status: 409 });
  }

  const needsScript = !String(job.script_text || '').trim();
  const hasNarration = !!job.timeline && Array.isArray(job.audio_files) && job.audio_files.length > 0;
  const nextStatus = needsScript ? 'queued' : hasNarration ? 'rendering' : 'narrating';
  const { error: updateError } = await supabase
    .from('stickman_jobs')
    .update({
      status: nextStatus,
      stage: 'queued',
      stage_message: 'Re-queued by admin',
      stage_updated_at: new Date().toISOString(),
      error_message: null,
      attempt_count: 0,
      claim_token: null,
      worker_id: null,
      claimed_at: null,
      heartbeat_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'failed');
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true, status: nextStatus });
}

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  // Never let an unexpected throw become a plain-text 500 page: the admin UI expects JSON.
  try {
    return await createJob(req, user);
  } catch (err) {
    console.error('Stickman job creation failed:', err);
    return NextResponse.json({ error: `Could not create the job: ${err?.message || err}` }, { status: 500 });
  }
}

async function createJob(req, user) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const useAI = Boolean(body.useAI);
  const subject = SUBJECTS.includes(body.subject) ? body.subject : 'general';
  const topic = (body.topic || '').trim();
  const scriptText = (body.script || '').trim();
  const autoPublish = body.autoPublish !== false;

  if (!useAI && !scriptText) {
    return NextResponse.json({ error: 'Provide a script or set useAI=true with a topic.' }, { status: 400 });
  }
  if (useAI && !topic) {
    return NextResponse.json({ error: 'AI generation needs a topic (or a selected lesson).' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Optional lesson Knowledge Asset: when the admin picked a lesson, the job is
  // anchored to it and the generated story is grounded in its content.
  let knowledgeAssetId = typeof body.knowledgeAssetId === 'string' && body.knowledgeAssetId ? body.knowledgeAssetId : null;
  if (knowledgeAssetId) {
    const { data: ka, error: kaErr } = await supabase.from('knowledge_assets').select('id').eq('id', knowledgeAssetId).maybeSingle();
    if (kaErr) return NextResponse.json({ error: `Knowledge Asset lookup failed: ${kaErr.message}` }, { status: 500 });
    if (!ka) return NextResponse.json({ error: 'Selected Knowledge Asset no longer exists.' }, { status: 400 });
  }

  // AI path: only the topic is stored. The persistent worker writes + validates
  // the script, so the slow multi-provider LLM call never runs here.
  if (useAI) {
    const { data: created, error } = await supabase
      .from('stickman_jobs')
      .insert({
        title: (body.title || topic).slice(0, 200),
        topic,
        subject,
        knowledge_asset_id: knowledgeAssetId,
        auto_publish: autoPublish,
        status: 'queued',
        stage: 'queued',
        stage_message: 'Waiting for a worker to write the script',
        stage_updated_at: new Date().toISOString(),
        script_text: '',
        created_by: user?.id ?? null,
      })
      .select('id, title, status, stage')
      .single();
    if (error) {
      const hint = /auto_publish|subject|stage/i.test(error.message)
        ? ' (apply migration 20261118210000_stickman_engine_reliability.sql in Supabase)'
        : '';
      return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
    }
    return NextResponse.json({ job: created, status: created.status, useAI: true }, { status: 201 });
  }

  // Paste path: parse + validate BEFORE creating the row.
  let script;
  try {
    script = JSON.parse(scriptText);
  } catch (e) {
    return NextResponse.json({ error: `script is not valid JSON: ${e.message}` }, { status: 400 });
  }
  const problems = validateSceneScript(script);
  if (problems.length) {
    return NextResponse.json({ error: 'SceneScript validation failed', problems }, { status: 400 });
  }

  // Resolve the shared Knowledge Asset up-front so a retry after a worker
  // crash reuses the same asset instead of duplicating the lesson.
  try {
    if (!knowledgeAssetId) {
      knowledgeAssetId = await resolveOrCreateKnowledgeAsset(supabase, script.title, subject, script);
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const { data: job, error } = await supabase
    .from('stickman_jobs')
    .insert({
      title: (body.title || script.title || 'Stickman animation').slice(0, 200),
      topic: topic || script.title,
      subject,
      knowledge_asset_id: knowledgeAssetId,
      auto_publish: autoPublish,
      script_text: JSON.stringify(script),
      status: 'queued',
      stage: 'queued',
      stage_message: 'Waiting for a worker',
      stage_updated_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select('id, title, status, stage')
    .single();
  if (error) {
    const hint = /auto_publish|subject|knowledge_asset_id/i.test(error.message)
      ? ' (apply migration 20261118210000_stickman_engine_reliability.sql in Supabase)'
      : '';
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }
  return NextResponse.json({ job, status: job.status, useAI: false }, { status: 201 });
}
