import { NextResponse } from 'next/server';
import { requireLandingAdmin } from '@/lib/requireLandingAdmin';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

export async function GET() {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupons: data });
}

export async function POST(req) {
  const auth = await requireLandingAdmin();
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const {
    code, description, discount_type = 'fixed_price', discount_value,
    product_slug = 'jamb-playbook', max_uses = null, expires_at = null,
  } = body;

  if (!code || discount_value == null) {
    return NextResponse.json({ error: 'code and discount_value are required.' }, { status: 400 });
  }

  const supabase = landingSupabaseAdmin();
  const { data, error } = await supabase
    .from('landing_coupons')
    .insert({
      code: code.trim().toUpperCase(),
      description,
      discount_type,
      discount_value,
      product_slug,
      max_uses,
      expires_at,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}
