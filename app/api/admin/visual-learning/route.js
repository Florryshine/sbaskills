// app/api/admin/visual-learning/route.js
//
// Visual Learning Video Production Engine — job creation, status, retry.
//   POST { useAI?, topic?, title?, audience?, tone?, targetSeconds?, aspect?,
//          style?, voice?, music?, subtitles?, keyPoints?, knowledgeAssetId?,
//          script?, autoPublish?, maxShotSeconds? }
//     useAI  -> stores only the topic + spec. The persistent Bun worker
//               (local-video-renderer/visual-learning-worker.js) plans the
//               script via the shared LLM fallback chain (or the deterministic
//               architect when no keys are configured — the engine is 100%
//               free to run), so no slow LLM call ever runs in this serverless
//               function.
//     script -> pasted episode JSON (visual-learning-engine scene grammar);
//               validated against the engine validator, then queued.
//   GET ?id=<jobId>  -> full job (timeline included for the player preview)
//   GET (no id)      -> 20 most recent jobs + worker liveness
//   PATCH { id, action: "retry" } -> re-queue a failed job; saved artifacts
//               (script/manifests/timeline) are kept so the retry resumes at
//               the stage that failed.
//
// Free toolchain only: edge-tts / public TTS proxy (no key), pollinations /
// pexels / pixabay / wikimedia / openverse imagery (free keys / no key),
// procedural music (no service), Remotion render on the existing worker fleet.

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateScript } from '../../../../visual-learning-engine/src/script/schema';

export const maxDuration = 60;

// A worker that has not polled for this long is treated as offline (poll is 15s).
const WORKER_ONLINE_MS = 90 * 1000;

async function getWorkerStatus(supabase) {
  const { data, error } = await supabase
    .from('visual_learning_workers')
    .select('worker_id, last_seen_at, current_job_id, info')
    .order('last_seen_at', { ascending: false })
    .limit(5);
  if (error) {
    return { online: false, last_seen_at: null, unknown: true, reason: error.message };
  }
  const latest = data?.[0] || null;
  const online = !!latest && Date.now() - new Date(latest.last_seen_at).getTime() < WORKER_ONLINE_MS;
  return { online, last_seen_at: latest?.last_seen_at || null, last_error: latest?.info?.last_error || null, unknown: false };
}

function validateSpec(spec) {
  const errors = [];
  if (spec.aspect && !['16:9', '9:16', '1:1'].includes(spec.aspect)) errors.push(`aspect must be 16:9, 9:16 or 1:1 (got ${spec.aspect})`);
  if (spec.style && !['cartoon', 'photo', 'sketch'].includes(spec.style)) errors.push(`style must be cartoon, photo or sketch (got ${spec.style})`);
  const seconds = Number(spec.targetSeconds);
  if (spec.targetSeconds !== undefined && (!isFinite(seconds) || seconds < 20 || seconds > 900)) {
    errors.push('targetSeconds must be between 20 and 900');
  }
  if (spec.accent && !/^#[0-9a-fA-F]{6}$/.test(String(spec.accent))) errors.push('accent must be a hex color like #E63946');
  if (spec.maxShotSeconds !== undefined && (!isFinite(Number(spec.maxShotSeconds)) || Number(spec.maxShotSeconds) < 1.5 || Number(spec.maxShotSeconds) > 10)) {
    errors.push('maxShotSeconds must be between 1.5 and 10');
  }
  return errors;
}

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const supabase = createAdminClient();

  if (!id) {
    let { data, error } = await supabase
      .from('visual_learning_jobs')
      .select('id, title, topic, status, stage, stage_message, video_url, duration_seconds, aspect, style, script_provider, used_fallback, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error && /script_provider|used_fallback|aspect|style/i.test(error.message)) {
      // Migration not fully applied: keep the page usable.
      ({ data, error } = await supabase
        .from('visual_learning_jobs')
        .select('id, title, topic, status, stage, stage_message, video_url, duration_seconds, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(20));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const worker = await getWorkerStatus(supabase);
    return NextResponse.json({ jobs: data, worker });
  }

  const { data: job, error } = await supabase
    .from('visual_learning_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  const worker = await getWorkerStatus(supabase);
  return NextResponse.json({ job, worker, serverTime: new Date().toISOString() });
}

// PATCH { id, action: 'retry' } — re-queue a failed job. Saved artifacts
// (script/manifests/timeline) are kept so the retry resumes where it failed;
// content_assets/media_files are reused (idempotent).
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
    .from('visual_learning_jobs')
    .select('id, status, script, image_manifest, narration_manifest, timeline')
    .eq('id', body.id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'failed') {
    return NextResponse.json({ error: `Only failed jobs can be retried (this one is ${job.status}).` }, { status: 409 });
  }

  const hasScript = Array.isArray(job.script?.scenes) && job.script.scenes.length > 0;
  const hasTimeline = !!job.timeline;
  const nextStatus = hasScript && hasTimeline ? 'rendering' : hasScript ? 'imagery' : 'queued';
  const { error: updateError } = await supabase
    .from('visual_learning_jobs')
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
  try {
    return await createJob(req, user);
  } catch (err) {
    console.error('Visual learning job creation failed:', err);
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
  const topic = (body.topic || '').trim();
  const scriptText = (body.script || '').trim();
  const autoPublish = body.autoPublish !== false;

  const spec = {
    audience: (body.audience || 'students').trim().slice(0, 120),
    tone: (body.tone || 'warm and curious').trim().slice(0, 120),
    targetSeconds: Math.max(20, Math.min(900, Number(body.targetSeconds) || 120)),
    aspect: ['16:9', '9:16', '1:1'].includes(body.aspect) ? body.aspect : '16:9',
    style: ['cartoon', 'photo', 'sketch'].includes(body.style) ? body.style : 'cartoon',
    voice: typeof body.voice === 'string' && body.voice ? body.voice : 'warm_male',
    accent: /^#[0-9a-fA-F]{6}$/.test(String(body.accent)) ? body.accent : '',
    music: body.music !== false,
    subtitles: body.subtitles !== false,
    seed: Number.isFinite(Number(body.seed)) ? Number(body.seed) : Math.floor(Math.random() * 100000),
    maxShotSeconds: Math.max(1.5, Math.min(10, Number(body.maxShotSeconds) || 3)),
    watermark: typeof body.watermark === 'string' ? body.watermark.slice(0, 60) : 'Shiney Brain Academy',
    keyPoints: Array.isArray(body.keyPoints) ? body.keyPoints.map((k) => String(k).trim().slice(0, 200)).filter(Boolean).slice(0, 8) : [],
    auto_publish: autoPublish,
  };

  const specErrors = validateSpec(spec);
  if (specErrors.length) return NextResponse.json({ error: 'Invalid options', problems: specErrors }, { status: 400 });

  if (!useAI && !scriptText) {
    return NextResponse.json({ error: 'Provide a script or set useAI=true with a topic.' }, { status: 400 });
  }
  if (useAI && !topic) {
    return NextResponse.json({ error: 'AI generation needs a topic (or a selected lesson).' }, { status: 400 });
  }

  const supabase = createAdminClient();

  let knowledgeAssetId = typeof body.knowledgeAssetId === 'string' && body.knowledgeAssetId ? body.knowledgeAssetId : null;
  if (knowledgeAssetId) {
    const { data: ka, error: kaErr } = await supabase.from('knowledge_assets').select('id').eq('id', knowledgeAssetId).maybeSingle();
    if (kaErr) return NextResponse.json({ error: `Knowledge Asset lookup failed: ${kaErr.message}` }, { status: 500 });
    if (!ka) return NextResponse.json({ error: 'Selected Knowledge Asset no longer exists.' }, { status: 400 });
  }

  // AI path: only the topic + spec are stored. The persistent worker plans and
  // validates the script so the slow LLM call never runs in this function.
  if (useAI) {
    const { data: created, error } = await supabase
      .from('visual_learning_jobs')
      .insert({
        title: (body.title || topic).slice(0, 200),
        topic: topic.slice(0, 300),
        spec,
        knowledge_asset_id: knowledgeAssetId,
        status: 'queued',
        stage: 'queued',
        stage_message: 'Waiting for a worker to write the script',
        stage_updated_at: new Date().toISOString(),
        created_by: user?.id ?? null,
      })
      .select('id, title, status, stage')
      .single();
    if (error) {
      const hint = /spec|stage/i.test(error.message)
        ? ' (apply migration 20261119_visual_learning_jobs.sql in Supabase)'
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
  try {
    validateScript(script, {
      title: (body.title || script?.meta?.title || topic || 'Visual learning episode').slice(0, 120),
      topic: topic || script?.meta?.title || 'visual learning',
      audience: spec.audience,
      aspect: spec.aspect,
      accent: spec.accent,
    });
  } catch (e) {
    return NextResponse.json({ error: `Episode script validation failed: ${e.message}` }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from('visual_learning_jobs')
    .insert({
      title: (body.title || script.meta?.title || 'Visual learning episode').slice(0, 200),
      topic: topic || script.meta?.title || 'visual learning',
      spec,
      script,
      knowledge_asset_id: knowledgeAssetId,
      status: 'queued',
      stage: 'queued',
      stage_message: 'Waiting for a worker',
      stage_updated_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select('id, title, status, stage')
    .single();
  if (error) {
    const hint = /spec|script|stage/i.test(error.message)
      ? ' (apply migration 20261119_visual_learning_jobs.sql in Supabase)'
      : '';
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }
  return NextResponse.json({ job, status: job.status, useAI: false }, { status: 201 });
}
