// app/api/admin/whiteboard-engine/route.js
//
// Whiteboard Engine v3 — job creation + status.
//   POST { topic?, subject?, script?, useAI? }
//     → validates the script, resolves its Knowledge Asset and stores a durable
//       narrating job. The persistent Bun worker performs TTS + rendering.
//   GET ?id=<jobId> → job status + timeline for the @remotion/player preview.
//
// The actual MP4 render runs where Chrome runs: local-video-renderer/
// whiteboard-worker.js claims the job, performs TTS + rendering, and saves through the standard
// lesson-videos → content_assets → media_files contract.

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { parseScript } from '../../../../whiteboard-engine/src/script/parser';
import { getIllustration } from '../../../../whiteboard-engine/src/illustrations/registry';

export const maxDuration = 60;

// A worker that has not polled for this long is treated as offline (poll is 15s).
const WORKER_ONLINE_MS = 90 * 1000;

// Supabase owns dispatching. The trigger and minute sweeper write their latest
// attempt here so the admin UI can distinguish a missing token from a GitHub rejection.
async function getDispatchStatus(supabase) {
  const { data, error } = await supabase
    .from('whiteboard_dispatch_attempts')
    .select('created_at, source, http_status, error_message, completed_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) return { unknown: true, reason: error.message, latest: null };
  return { unknown: false, latest: data?.[0] || null };
}

async function getWorkerStatus(supabase) {
  const { data, error } = await supabase
    .from('whiteboard_workers')
    .select('worker_id, last_seen_at, current_job_id, info')
    .order('last_seen_at', { ascending: false })
    .limit(5);
  if (error) {
    // Table missing => migration 20261115 not applied; surface that instead of guessing.
    return { online: false, last_seen_at: null, unknown: true, reason: error.message };
  }
  const latest = data?.[0] || null;
  const online = !!latest && Date.now() - new Date(latest.last_seen_at).getTime() < WORKER_ONLINE_MS;
  return { online, last_seen_at: latest?.last_seen_at || null, last_error: latest?.info?.last_error || null, unknown: false };
}

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    // list recent jobs
    const supabase = createAdminClient();
    const cols = 'id, title, subject, status, video_url, duration_seconds, created_at, error_message';
    let { data, error } = await supabase.from('whiteboard_jobs').select(`${cols}, stage`)
      .order('created_at', { ascending: false }).limit(20);
    if (error && /stage/i.test(error.message)) {
      // Migration 20261115 not applied yet: keep the page usable.
      ({ data, error } = await supabase.from('whiteboard_jobs').select(cols)
        .order('created_at', { ascending: false }).limit(20));
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const [worker, dispatch] = await Promise.all([getWorkerStatus(supabase), getDispatchStatus(supabase)]);
    return NextResponse.json({ jobs: data, worker, dispatch });
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('whiteboard_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  const [worker, dispatch] = await Promise.all([getWorkerStatus(supabase), getDispatchStatus(supabase)]);
  return NextResponse.json({ job, worker, dispatch, serverTime: new Date().toISOString() });
}

// PATCH { id, action: 'retry' } — re-queue a failed job. Narration/timeline already saved on the
// job are kept, so a retry resumes at rendering; content_assets/media_files are reused by the
// worker (idempotent), so retries never create duplicate records.
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
    .from('whiteboard_jobs')
    .select('id, status, timeline, audio_files')
    .eq('id', body.id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'failed') {
    return NextResponse.json({ error: `Only failed jobs can be retried (this one is ${job.status}).` }, { status: 409 });
  }

  const hasNarration = !!job.timeline && Array.isArray(job.audio_files) && job.audio_files.length > 0;
  const { error: updateError } = await supabase
    .from('whiteboard_jobs')
    .update({
      status: hasNarration ? 'rendering' : 'narrating',
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
  return NextResponse.json({ success: true, status: hasNarration ? 'rendering' : 'narrating' });
}

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  // Never let an unexpected throw become a plain-text 500 page: the admin UI expects JSON.
  try {
    return await createJob(req, user);
  } catch (err) {
    console.error('Whiteboard job creation failed:', err);
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

  const subject = ['biology', 'chemistry', 'physics', 'mathematics', 'general'].includes(body.subject)
    ? body.subject
    : 'general';
  const topic = (body.topic || '').trim();
  const useAI = Boolean(body.useAI);
  const scriptText = (body.script || '').trim();

  if (!useAI && !scriptText) {
    return NextResponse.json({ error: 'Provide a script or set useAI=true with a topic.' }, { status: 400 });
  }
  if (useAI && !topic) {
    return NextResponse.json({ error: 'AI generation needs a topic.' }, { status: 400 });
  }

  // AI path: only the topic is stored. The persistent worker writes + validates the script, so the
  // slow multi-provider LLM call never runs inside this time-limited serverless function.
  if (useAI) {
    const supabaseAI = createAdminClient();
    const created = await supabaseAI
      .from('whiteboard_jobs')
      .insert({ title: topic.slice(0, 200), topic, subject, status: 'narrating', script_text: '', created_by: user.id })
      .select('id')
      .single();
    if (created.error) {
      const hint = /topic|stage/i.test(created.error.message)
        ? ' (apply migration 20261115_whiteboard_engine_observability.sql in Supabase)'
        : '';
      return NextResponse.json({ error: `${created.error.message}${hint}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, jobId: created.data.id, status: 'narrating', scenes: null });
  }

  const finalScript = scriptText;

  // 2. Validate the script + referenced assets BEFORE creating the row.
  let spec;
  try {
    spec = parseScript(finalScript);
  } catch (err) {
    return NextResponse.json({ error: `Script parse error: ${err.message}` }, { status: 400 });
  }
  const missingAssets = spec.scenes
    .flatMap((s) => s.elements)
    .filter((el) => el.type === 'illustration' && !el.image && !getIllustration(el.asset))
    .map((el) => el.asset);
  if (missingAssets.length > 0) {
    return NextResponse.json({ error: `Unknown illustrations: ${missingAssets.join(', ')}` }, { status: 400 });
  }

  const hasScriptSubject = /^\s*@subject\b/im.test(finalScript);
  const resolvedSubject = hasScriptSubject ? spec.subject : subject;

  // 3. Resolve the shared Knowledge Asset first. content_assets requires a
  //    knowledge_asset_id, so creating a creator_video without this link would
  //    fail later in the worker and never reach the Social Engine.
  const supabase = createAdminClient();
  let knowledgeAssetId = null;
  const { data: matchingAssets, error: assetLookupError } = await supabase
    .from('knowledge_assets')
    .select('id')
    .eq('keyword', spec.title)
    .eq('subject', resolvedSubject)
    .limit(1);
  if (assetLookupError) {
    return NextResponse.json({ error: `Knowledge Asset lookup failed: ${assetLookupError.message}` }, { status: 500 });
  }
  knowledgeAssetId = matchingAssets?.[0]?.id || null;

  if (!knowledgeAssetId) {
    const { data: createdAsset, error: createAssetError } = await supabase
      .from('knowledge_assets')
      .insert({
        keyword: spec.title,
        topic_type: 'curriculum_topic',
        subject: resolvedSubject,
        summary: `Whiteboard lesson: ${spec.title}`,
        raw_content: finalScript.slice(0, 12000),
        learning_objectives: [],
        key_concepts: [],
        definitions: [],
        examples: [],
        facts: [],
        common_mistakes: [],
        sub_topics: [],
        status: 'draft',
        source: 'whiteboard_engine_v3',
      })
      .select('id')
      .single();
    if (createAssetError) {
      return NextResponse.json({ error: `Knowledge Asset creation failed: ${createAssetError.message}` }, { status: 500 });
    }
    knowledgeAssetId = createdAsset.id;
  }

  // 4. Create a durable job. The persistent worker owns narration and rendering;
  //    no Vercel background promise is used for long-running TTS work.
  const insert = await supabase
    .from('whiteboard_jobs')
    .insert({
      title: spec.title,
      subject: resolvedSubject,
      knowledge_asset_id: knowledgeAssetId,
      status: 'narrating',
      script_text: finalScript,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 500 });
  }
  const jobId = insert.data.id;

  return NextResponse.json({ success: true, jobId, status: 'narrating', scenes: spec.scenes.length });
}
