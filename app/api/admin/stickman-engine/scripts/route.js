// app/api/admin/stickman-engine/scripts/route.js
//
// Saved Stickman SceneScripts — the "script library" behind the studio's
// Save / Load / Reuse affordances. Scripts are validated with the same engine
// validator as the job route, so a saved script is always queueable.
//   GET            -> 50 most recent saved scripts
//   POST { id?, title, subject, script } -> create or update (id present)
//   DELETE ?id=    -> remove a saved script

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { validateSceneScript } from '../../../../../stickman-engine/src/scene/validate';

export const maxDuration = 30;

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('stickman_scripts')
    .select('id, title, subject, topic, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scripts: data });
}

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const scriptText = (body.script || '').trim();
  if (!scriptText) return NextResponse.json({ error: 'script is required' }, { status: 400 });
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

  const title = (body.title || script.title || 'Untitled script').slice(0, 200);
  const subject = ['biology', 'chemistry', 'physics', 'mathematics', 'general'].includes(body.subject)
    ? body.subject
    : 'general';
  const supabase = createAdminClient();

  if (body.id) {
    const { data, error } = await supabase
      .from('stickman_scripts')
      .update({ title, subject, topic: body.topic || null, script_text: JSON.stringify(script), updated_at: new Date().toISOString() })
      .eq('id', body.id)
      .select('id, title, subject, updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ script: data, updated: true });
  }

  const { data, error } = await supabase
    .from('stickman_scripts')
    .insert({
      title,
      subject,
      topic: body.topic || null,
      script_text: JSON.stringify(script),
      created_by: user?.id ?? null,
    })
    .select('id, title, subject, updated_at')
    .single();
  if (error) {
    const hint = /stickman_scripts/i.test(error.message)
      ? ' (apply migration 20261118210000_stickman_engine_reliability.sql in Supabase)'
      : '';
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }
  return NextResponse.json({ script: data, created: true }, { status: 201 });
}

export async function DELETE(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('stickman_scripts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
