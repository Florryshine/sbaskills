import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

export async function PATCH(req, { params }) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const allowed = ['student_name', 'quote', 'result_label', 'kind', 'approved', 'sort_order', 'image_url'];
  const patch = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_testimonials')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ testimonial: data });
}

export async function DELETE(_req, { params }) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const supabase = landingSupabaseAdmin();
  const { error } = await supabase.from('landing_testimonials').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
