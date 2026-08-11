import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

export async function PATCH(req, { params }) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const allowed = ['description', 'discount_type', 'discount_value', 'max_uses', 'expires_at', 'active'];
  const patch = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_coupons')
    .update(patch)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}

export async function DELETE(_req, { params }) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const supabase = landingSupabaseAdmin();
  const { error } = await supabase.from('landing_coupons').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
