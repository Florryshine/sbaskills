// app/api/publish/schedule/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request) {
  // Was importing createRouteHandlerClient from @supabase/auth-helpers-nextjs,
  // a different (legacy) cookie format than the @supabase/ssr client the rest
  // of the app's auth (login, middleware) actually uses — auth.getUser()
  // could never see a real session here, so every call 401'd regardless of
  // login state.
  const routeSupabase = createRouteHandlerClient();
  const { data: { user } } = await routeSupabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobId, scheduledAt } = await request.json();
    if (!jobId || !scheduledAt) {
      return NextResponse.json({ error: 'jobId and scheduledAt are required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('publish_jobs')
      .update({ status: 'scheduled', scheduled_at: scheduledAt })
      .eq('id', jobId)
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, job: data });
  } catch (error) {
    console.error('Schedule error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
