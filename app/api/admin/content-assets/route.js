import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

// content_assets/media_files/video_scripts/publish_jobs are service_role-only
// by RLS (see supabase/migrations/20260718_social_engine_v2.sql) — the
// browser's anon key gets zero rows back, silently, no error. This route is
// the server-side door the admin UI is supposed to go through instead.

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_assets')
    .select(
      '*, knowledge_assets(keyword), media_files(*), video_scripts(*), publish_jobs(id, status, external_url, last_error, social_channels_v2(platform, label))'
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// Mirrored in app/admin/social-engine/page.js for the live counter.
// content_assets.platform is stored lowercase (see generators/*.js).
const PLATFORM_LIMITS = {
  x: 280,
  threads: 500,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  telegram: 4096,
};

// PATCH also backs the "Edit" affordance on every /admin/*-loops draft list
// (meme, past-question, teaching, lesson, quote, countdown) — see each
// page's `handleSaveEdit` for the caller side. Those pages send `title`
// and/or `metadata` alongside or instead of `body`/`status`; metadata is
// a full replace (not a deep merge) because every caller already has the
// complete current metadata object in state (it read it off the draft
// before editing) and only mutates the one or two fields the user touched
// — sending the whole object back is simpler and less surprising than a
// server-side merge that could silently resurrect a field the client meant
// to drop.
export async function PATCH(request) {
  const { id, status, body, title, metadata } = await request.json();
  const hasBody = typeof body === 'string';
  const hasTitle = typeof title === 'string';
  const hasMetadata = metadata && typeof metadata === 'object' && !Array.isArray(metadata);

  if (!id || (!status && !hasBody && !hasTitle && !hasMetadata)) {
    return NextResponse.json(
      { error: 'id and at least one of status, body, title, or metadata are required' },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();

  const update = {};
  if (status) update.status = status;
  if (hasTitle) update.title = title;
  if (hasMetadata) update.metadata = metadata;

  if (hasBody) {
    if (body.trim().length === 0) {
      return NextResponse.json({ error: 'Body cannot be empty' }, { status: 400 });
    }
    const { data: existing, error: fetchError } = await supabase
      .from('content_assets')
      .select('id, platform')
      .eq('id', id)
      .single();
    if (fetchError || !existing) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const limit = PLATFORM_LIMITS[existing.platform];
    if (limit && body.length > limit) {
      return NextResponse.json(
        { error: `Exceeds ${existing.platform}'s ${limit} character limit by ${body.length - limit}` },
        { status: 400 }
      );
    }
    update.body = body;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase.from('content_assets').update(update).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, contentAsset: data });
}

export async function DELETE(request) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const supabase = createAdminClient();
  const { error } = await supabase.from('content_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
