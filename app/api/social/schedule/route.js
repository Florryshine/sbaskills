import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId, scheduledAt } = await req.json();
    if (!postId || !scheduledAt) {
      return NextResponse.json({ error: 'Missing postId or scheduledAt' }, { status: 400 });
    }

    const { data: post, error } = await supabase
      .from('social_post_drafts')
      .select('id, status')
      .eq('id', postId)
      .single();
    if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    if (post.status !== 'draft') {
      return NextResponse.json({ error: `Cannot schedule a post with status '${post.status}'` }, { status: 400 });
    }

    await supabase
      .from('social_post_drafts')
      .update({
        status: 'scheduled',
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId);

    return NextResponse.json({ success: true, message: `Scheduled for ${scheduledAt}` });
  } catch (err) {
    console.error('Schedule error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}