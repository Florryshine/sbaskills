import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function POST(request) {
  try {
    const { draftId } = await request.json();
    const supabase = createRouteHandlerClient();

    // Get draft
    const { data: draft, error: draftError } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (draftError) throw draftError;

    // Insert into blog_posts
    const { data: post, error: postError } = await supabase
      .from('blog_posts')
      .insert({
        title: draft.title,
        slug: draft.slug,
        content: draft.content,
        excerpt: draft.meta_description,
        tags: draft.tags,
        category: draft.category,
        published: true,
        published_at: new Date().toISOString(),
        author_id: null, // will be set by the user
      })
      .select()
      .single();

    if (postError) throw postError;

    // Update draft status
    await supabase
      .from('content_drafts')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    // Update queue item
    if (draft.queue_id) {
      await supabase
        .from('content_queue')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('id', draft.queue_id);
    }

    return NextResponse.json({
      success: true,
      postId: post.id,
      slug: post.slug,
      url: `/blog/${post.slug}`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}