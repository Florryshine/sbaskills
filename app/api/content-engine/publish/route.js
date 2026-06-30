import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { draftId } = await request.json();
    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // Update draft status to 'published'
    const { error } = await supabase
      .from('content_drafts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftId);

    if (error) throw error;

    // Optionally update the related queue item
    const { data: draft } = await supabase
      .from('content_drafts')
      .select('queue_id')
      .eq('id', draftId)
      .single();

    if (draft?.queue_id) {
      await supabase
        .from('content_queue')
        .update({ status: 'published' })
        .eq('id', draft.queue_id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}