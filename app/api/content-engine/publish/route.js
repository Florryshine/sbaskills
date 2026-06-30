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

    // 2. Insert into blog_posts
    const { data: blogPost, error: insertError } = await supabase
      .from('blog_posts')
      .insert({
        title: draft.title,
        slug: draft.url_slug,
        content: draft.content,
        excerpt: draft.meta_description || draft.content?.substring(0, 160) || '',
        cover_image: null, // you can later add cover image from draft.image_prompts if needed
        published: true,
        published_at: new Date().toISOString(),
        author_id: null, // optional: you can set a default author
        tags: draft.tags || [],
        meta_description: draft.meta_description,
        created_at: draft.created_at,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert into blog_posts failed:', insertError);
      return NextResponse.json({ error: 'Failed to publish to blog: ' + insertError.message }, { status: 500 });
    }

    // 3. Update draft status to 'published'
    const { error: updateDraftError } = await supabase
      .from('content_drafts')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', draftId);

    if (updateDraftError) {
      console.error('Update draft status failed:', updateDraftError);
      // Non-critical, but log it
    }

    // 4. Update queue item status
    if (draft.queue_id) {
      await supabase
        .from('content_queue')
        .update({ status: 'published' })
        .eq('id', draft.queue_id);
    }

    return NextResponse.json({ 
      success: true, 
      blogPostId: blogPost.id,
      slug: blogPost.slug,
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}