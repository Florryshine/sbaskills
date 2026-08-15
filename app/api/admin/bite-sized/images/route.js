import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import {
  downloadImageBuffer,
  searchPexelsMulti,
  searchPixabayMulti,
  searchWikimediaMulti,
} from '@/lib/image-search';

const BUCKET = 'lesson-screen-images';

async function requireAdmin() {
  const supabase = createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') {
    return { supabase, response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }

  return { supabase, user };
}

async function searchCandidates(query) {
  const providers = [searchPexelsMulti, searchPixabayMulti, searchWikimediaMulti];
  const results = [];

  for (const search of providers) {
    try {
      const hits = await search(query, 4);
      results.push(...hits);
      if (results.length >= 8) break;
    } catch (error) {
      console.warn(`[BiteSized Images] ${search.name} failed:`, error.message);
    }
  }

  return results.slice(0, 8);
}

function extensionFor(url, contentType = '') {
  const fromUrl = String(url || '').split('?')[0].split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fromUrl)) return fromUrl === 'jpeg' ? 'jpg' : fromUrl;
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  return 'jpg';
}

export async function POST(request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const action = body?.action || 'search';
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  const screenId = typeof body?.screenId === 'string' ? body.screenId : '';

  if (action === 'search') {
    if (!query) return NextResponse.json({ error: 'query is required.' }, { status: 400 });
    return NextResponse.json({ success: true, candidates: await searchCandidates(query) });
  }

  if (action !== 'attach') {
    return NextResponse.json({ error: 'action must be search or attach.' }, { status: 400 });
  }
  if (!screenId) return NextResponse.json({ error: 'screenId is required.' }, { status: 400 });

  const candidate = body?.candidate;
  if (!candidate?.url) return NextResponse.json({ error: 'candidate.url is required.' }, { status: 400 });

  const { data: screen, error: screenError } = await supabase
    .from('lesson_screens')
    .select('id, lesson_id')
    .eq('id', screenId)
    .single();
  if (screenError || !screen) return NextResponse.json({ error: 'Lesson screen not found.' }, { status: 404 });

  try {
    const buffer = await downloadImageBuffer(candidate.url);
    const extension = extensionFor(candidate.url);
    const path = `lesson-screens/${screen.lesson_id}/${screen.id}.${extension}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, buffer, {
      contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
      upsert: true,
    });
    if (uploadError) throw uploadError;

    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    const imageCredit = [candidate.source, candidate.photographer, candidate.sourceUrl]
      .filter(Boolean)
      .join(' · ');

    const { data: updated, error: updateError } = await supabase
      .from('lesson_screens')
      .update({
        image_url: urlData.publicUrl,
        image_credit: imageCredit || null,
        image_alt: body.imageAlt || null,
      })
      .eq('id', screenId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, screen: updated, storagePath: path });
  } catch (error) {
    console.error('[BiteSized Images] Attachment failed:', error);
    return NextResponse.json({ error: error.message || 'Image attachment failed.' }, { status: 502 });
  }
}
