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
import { generateScriptWithAI } from '@/lib/whiteboard/planner';
import { parseScript } from '../../../../whiteboard-engine/src/script/parser';
import { getIllustration } from '../../../../whiteboard-engine/src/illustrations/registry';

export const maxDuration = 60;


export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) {
    // list recent jobs
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('whiteboard_jobs')
      .select('id, title, subject, status, video_url, duration_seconds, created_at, error_message')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ jobs: data });
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('whiteboard_jobs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  return NextResponse.json({ job });
}

async function handlePost(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

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

  // 1. Resolve the final script (AI path happens inline: the fallback chain
  //    is fast and the user gets validation errors immediately).
  let finalScript = scriptText;
  if (useAI) {
    try {
      finalScript = await generateScriptWithAI(topic, subject);
    } catch (err) {
      return NextResponse.json(
        { error: `AI script generation failed: ${err.message}` },
        { status: 502 },
      );
    }
  }

  // 2. Validate the script + referenced assets BEFORE creating the row.
  let spec;
  try {
    spec = parseScript(finalScript);
  } catch (err) {
    return NextResponse.json({ error: `Script parse error: ${err.message}` }, { status: 400 });
  }
  const missingAssets = spec.scenes
    .flatMap((s) => s.elements)
    .filter((el) => el.type === 'illustration' && !getIllustration(el.asset))
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


export async function POST(req) {
  try {
    return await handlePost(req);
  } catch (err) {
    console.error('[whiteboard-engine] Unhandled POST failure:', err);
    return NextResponse.json(
      {
        error: err?.message
          ? `Whiteboard request failed: ${err.message}`
          : 'Whiteboard request failed unexpectedly. Check the server logs for details.',
      },
      { status: 500 },
    );
  }
}
