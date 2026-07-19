// app/api/publish/now/route.js
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { executePublishJob } from '@/lib/publish-engine';

export async function POST(request) {
  const supabase = createRouteHandlerClient({ cookies });
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
