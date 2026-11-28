import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid render job ID.' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('music_render_jobs')
    .update({
      status: 'queued', stage: 'queued', stage_message: 'Retry queued',
      progress: 0, attempt_count: 0, claim_token: null, worker_id: null,
      claimed_at: null, heartbeat_at: null, error_message: null,
      completed_at: null, updated_at: new Date().toISOString(),
    })
    .eq('id', id).eq('status', 'failed')
    .select('id,title,status,stage,progress,created_at').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Only failed jobs can be retried.' }, { status: 409 });
  return NextResponse.json({ success: true, job: data }, { status: 202 });
}
