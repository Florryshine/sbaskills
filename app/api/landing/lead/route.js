import { NextResponse } from 'next/server';
import { landingSupabaseAdmin } from '@/lib/landingSupabaseAdmin';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { email, source = 'section', productSlug = 'ai-playbook' } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  const supabase = landingSupabaseAdmin();
  const { error } = await supabase
    .from('landing_leads')
    .insert({ email, source, product_slug: productSlug });

  if (error && error.code !== '23505') {
    console.error('Lead insert failed:', error);
    return NextResponse.json({ error: 'Could not save lead.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
