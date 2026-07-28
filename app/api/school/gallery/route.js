import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { requireSchoolStaff } from '@/lib/school/auth';

export const dynamic = 'force-dynamic';

// GET /api/school/gallery?school=<slug>  (public, used by the landing page)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const schoolSlug = searchParams.get('school');
  if (!schoolSlug) return NextResponse.json({ error: 'Missing school.' }, { status: 400 });

  const supabase = createRouteHandlerClient();
  const { data: school } = await supabase.from('schools').select('id').eq('slug', schoolSlug).single();
  if (!school) return NextResponse.json({ error: 'School not found.' }, { status: 404 });

  const { data, error } = await supabase
    .from('school_gallery')
    .select('id, image_url, caption, sort_order')
    .eq('school_id', school.id)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ images: data || [] });
}

// POST /api/school/gallery
// Body: { school, image_url, caption, sort_order }  (staff only)
export async function POST(request) {
  const body = await request.json();
  const { school: schoolSlug, image_url, caption, sort_order } = body;

  if (!schoolSlug || !image_url) {
    return NextResponse.json({ error: 'Missing school or image_url.' }, { status: 400 });
  }

  const { supabase, school, error } = await requireSchoolStaff(schoolSlug);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const { data, error: insertError } = await supabase
    .from('school_gallery')
    .insert({ school_id: school.id, image_url, caption: caption || null, sort_order: sort_order || 0 })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ image: data });
}
