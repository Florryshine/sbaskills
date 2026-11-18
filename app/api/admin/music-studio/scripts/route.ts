import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import type { SongSpec, StudioSettings } from '@/lib/studio/types';

/**
 * Music Studio script persistence — the server-side replacement for the old
 * localStorage-only project list.
 *
 * A "script" is one content_assets row (asset_type 'music_video',
 * format-agnostic video like quote_loop) carrying the SongSpec + studio
 * settings in metadata and the lyrics as body. Rendered videos/audio attach
 * as media_files rows and show up in the Social Post review dashboard,
 * exactly like every other content-factory asset.
 *
 * Deleting a script removes its videos and audio too (explicit user intent);
 * deleting only a VIDEO is a different endpoint — see
 * /api/admin/music-studio/publish DELETE — which keeps the script + audio.
 */

export const runtime = 'nodejs';

const ASSET_TYPE = 'music_video';

function cleanSpec(spec: unknown): SongSpec | null {
  if (!spec || typeof spec !== 'object') return null;
  const candidate = spec as SongSpec;
  if (!candidate.title || !Array.isArray(candidate.sections)) return null;
  return JSON.parse(JSON.stringify(candidate)) as SongSpec;
}

function cleanSettings(settings: unknown): StudioSettings | null {
  if (!settings || typeof settings !== 'object') return null;
  return JSON.parse(JSON.stringify(settings)) as StudioSettings;
}

function lyricsTextOf(spec: SongSpec | null, fallback: string): string {
  if (spec) {
    const lines = spec.sections
      .flatMap((s) => s.lines.map((l) => l.text))
      .filter((t) => t && t.trim().length > 0);
    if (lines.length) return lines.join('\n');
  }
  return fallback.slice(0, 20000);
}

/** Find-or-create the knowledge_assets row every content_assets row needs. */
async function findOrCreateKnowledgeAsset(supabase: ReturnType<typeof createAdminClient>, topic: string) {
  const keyword = topic.trim().slice(0, 160) || 'Music studio song';
  const { data: existing } = await supabase
    .from('knowledge_assets')
    .select('id')
    .eq('keyword', keyword)
    .eq('topic_type', 'learning')
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('knowledge_assets')
    .insert({
      keyword,
      topic_type: 'learning',
      subject: 'Music',
      summary: `Learning song produced by the SBA Musical Learning Studio about ${keyword}.`,
      key_concepts: [],
      definitions: [],
      examples: [],
      facts: [],
      common_mistakes: [],
      sub_topics: [],
      learning_objectives: [],
      tags: ['music', 'learning song'],
      exam_type: ['JAMB'],
      prerequisite_ids: [],
      related_asset_ids: [],
      status: 'approved',
      source: 'music-studio',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Could not create the knowledge asset for this song: ${error.message}`);
  return created.id;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('content_assets')
    .select(
      'id, title, body, status, created_at, updated_at, knowledge_assets(keyword), ' +
      'metadata(topic, notes, spec, settings), ' +
      'media_files(id, media_type, role, url, storage_path, duration_seconds, mime_type)'
    )
    .eq('asset_type', ASSET_TYPE)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let body: {
    id?: unknown; title?: unknown; topic?: unknown; notes?: unknown;
    spec?: unknown; settings?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const spec = cleanSpec(body.spec);
  if (!spec) return NextResponse.json({ error: 'A valid song spec is required' }, { status: 400 });
  const settings = cleanSettings(body.settings) ?? undefined;
  const topic = (typeof body.topic === 'string' && body.topic.trim()) || spec.topic || 'Untitled topic';
  const title = (typeof body.title === 'string' && body.title.trim()) || spec.title || 'SBA learning song';
  const notes = typeof body.notes === 'string' ? body.notes.slice(0, 20000) : '';
  const lyricsText = lyricsTextOf(spec, '');

  const supabase = createAdminClient();

  try {
    const knowledgeAssetId = await findOrCreateKnowledgeAsset(supabase, topic);
    const metadata = {
      topic,
      notes,
      spec,
      ...(settings ? { settings } : {}),
      lyricsText,
      savedAt: new Date().toISOString(),
    };

    const existingId = typeof body.id === 'string' && body.id.length === 36 ? body.id : null;
    if (existingId) {
      // Update in place, but only if the row really is one of ours.
      const { data: existing, error: fetchError } = await supabase
        .from('content_assets')
        .select('id')
        .eq('id', existingId)
        .eq('asset_type', ASSET_TYPE)
        .maybeSingle();
      if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
      if (existing?.id) {
        const { data, error: updateError } = await supabase
          .from('content_assets')
          .update({
            title: title.slice(0, 160),
            body: lyricsText.slice(0, 20000),
            metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingId)
          .select('id, title, updated_at')
          .single();
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
        return NextResponse.json({ success: true, script: data });
      }
      // Fall through: the id didn't match a music_video asset — save as new.
    }

    const { data, error } = await supabase
      .from('content_assets')
      .insert({
        knowledge_asset_id: knowledgeAssetId,
        asset_type: ASSET_TYPE,
        platform: null, // format-agnostic video, publishable to any video channel
        format: 'video',
        title: title.slice(0, 160),
        body: lyricsText.slice(0, 20000),
        status: 'draft',
        generated_by: 'music-studio',
        metadata,
      })
      .select('id, title, updated_at')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, script: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save the script' }, { status: 500 });
  }
}

/** Delete a script AND its media (video + audio + storage objects). */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const supabase = createAdminClient();
  const { data: asset, error: fetchError } = await supabase
    .from('content_assets')
    .select('id, media_files(id, media_type, storage_path)')
    .eq('id', id)
    .eq('asset_type', ASSET_TYPE)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!asset) return NextResponse.json({ error: 'Script not found' }, { status: 404 });

  // Remove the storage objects first — the DB rows cascade with the asset.
  const media = (asset as unknown as { media_files?: Array<{ storage_path: string | null }> }).media_files ?? [];
  for (const file of media) {
    if (file.storage_path) {
      await supabase.storage.from('lesson-videos').remove([file.storage_path]);
    }
  }
  const { error } = await supabase.from('content_assets').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
