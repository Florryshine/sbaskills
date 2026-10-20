import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await auth.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { curriculum_id, subject = null } = await request.json();
    if (!curriculum_id) return NextResponse.json({ error: 'curriculum_id is required.' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.rpc('link_curriculum_topics_to_assets', {
      p_curriculum_id: curriculum_id,
      p_subject: subject,
    });
    if (error) throw error;

    return NextResponse.json({ success: true, ...(data || {}) });
  } catch (error) {
    console.error('Link curriculum assets error:', error);
    return NextResponse.json({ error: error?.message || 'Could not link curriculum to assets.' }, { status: 500 });
  }
}
