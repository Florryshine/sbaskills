// app/api/publish/now/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { executePublishJob } from '@/lib/publish-engine';

export async function POST(request) {
  // Was importing createRouteHandlerClient from @supabase/auth-helpers-nextjs,
  // a different (legacy) cookie format than the @supabase/ssr client the rest
  // of the app's auth (login, middleware) actually uses. That mismatch meant
  // auth.getUser() here could never see a real, logged-in admin session —
  // every request came back 401 Unauthorized regardless of login state.
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { jobId } = await request.json();
    if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

    const result = await executePublishJob(jobId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Publish now error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
