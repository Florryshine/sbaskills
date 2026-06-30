import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { draftId } = await request.json();
    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // 1. Fetch the draft
    const { data: draft, error: fetchError } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    if (!draft.url_slug || !draft.title || !draft.content) {
      return NextResponse.json(
        { error: 'Draft is missing title, url_slug, or content and cannot be published' },
        { status: 400 }
      );
    }

    // 2. Mark the draft itself as published — content_drafts is the single
    //    source of truth for both /admin/blog and the public /blog pages.
    const { data: updatedDraft, error: updateDraftError } = await supabase
      .from('content_drafts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftId)
      .select()
      .single();

    if (updateDraftError) {
      console.error('Update draft status failed:', updateDraftError);
      return NextResponse.json({ error: 'Failed to publish: ' + updateDraftError.message }, { status: 500 });
    }

    // 3. Update queue item status
    if (draft.queue_id) {
      await supabase
        .from('content_queue')
        .update({ status: 'published' })
        .eq('id', draft.queue_id);
    }

    return NextResponse.json({
      success: true,
      draftId: updatedDraft.id,
      slug: updatedDraft.url_slug,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
