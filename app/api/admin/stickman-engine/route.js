// app/api/admin/stickman-engine/route.js
//
// Stickman Animation Engine - job creation + status.
//   POST { title?, topic?, script? }
//     script = SceneScript JSON (see stickman-engine/src/rig/character.ts).
//     Validates the schema shape, stores a queued job. The Bun worker
//     (local-video-renderer/stickman-worker.js) narrates, compiles and renders.
//   GET ?id=<jobId>       -> full job (timeline included for previews)
//   GET (no id)           -> 20 most recent jobs + worker liveness
//
// Free toolchain only: edge-tts (no key) via lib/podcastTTS, Remotion render
// on the existing Docker worker fleet, storage via lesson-videos contract.

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const maxDuration = 60;

// Minimal structural validation of a SceneScript before we queue anything.
function validateSceneScript(script) {
  const problems = [];
  if (!script || typeof script !== 'object') return ['script must be a JSON object'];
  if (!script.title || typeof script.title !== 'string') problems.push('title is required');
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) problems.push('scenes[] is required');
  if (!script.cast || typeof script.cast !== 'object') problems.push('cast{} is required');
  if (!script.environment || !script.environment.type) problems.push('environment.type is required');

  const KNOWN_ACTIONS = new Set([
    'walk', 'run', 'push', 'point', 'present', 'wave', 'reactSurprise',
    'cheer', 'laugh', 'stumble', 'sit', 'face', 'talkGestures',
  ]);
  (script.scenes || []).forEach((sc, i) => {
    if (!sc.id) problems.push(`scene ${i}: id is required`);
    for (const a of sc.actions || []) {
      if (!a.char || !KNOWN_ACTIONS.has(a.do)) {
        problems.push(`scene ${i}: unknown action ${a && a.do} for ${a && a.char}`);
      }
    }
    for (const d of sc.dialogue || []) {
      if (!d.who || !d.text) problems.push(`scene ${i}: dialogue needs who + text`);
    }
  });
  return problems;
}

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const supabase = createAdminClient();

  if (!id) {
    const { data, error } = await supabase
      .from('stickman_jobs')
      .select('id, title, topic, status, stage, stage_message, video_url, duration_seconds, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const since = new Date(Date.now() - 90 * 1000).toISOString();
    const { data: workers } = await supabase
      .from('stickman_jobs')
      .select('worker_id, claimed_at')
      .gte('claimed_at', since)
      .order('claimed_at', { ascending: false })
      .limit(1);
    return NextResponse.json({ jobs: data, worker: { online: !!(workers && workers.length) } });
  }

  const { data: job, error } = await supabase
    .from('stickman_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ job });
}

export async function POST(req) {
  const { response, user } = await requireAdminApi();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let script = body.script;
  if (typeof script === 'string') {
    try {
      script = JSON.parse(script);
    } catch (e) {
      return NextResponse.json({ error: `script is not valid JSON: ${e.message}` }, { status: 400 });
    }
  }
  const problems = validateSceneScript(script);
  if (problems.length) {
    return NextResponse.json({ error: 'SceneScript validation failed', problems }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('stickman_jobs')
    .insert({
      title: body.title || script.title || 'Stickman animation',
      topic: body.topic || 'story',
      script_text: JSON.stringify(script),
      status: 'queued',
      stage: 'queued',
      stage_message: 'Waiting for a worker',
      stage_updated_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select('id, title, status, stage, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job }, { status: 201 });
}
