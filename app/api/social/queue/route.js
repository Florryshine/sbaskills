import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('social_post_drafts')
      .select('*')
      .in('status', ['scheduled', 'failed'])
      .order('scheduled_at', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error('Queue fetch error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}