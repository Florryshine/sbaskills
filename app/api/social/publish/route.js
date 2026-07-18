import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { publishToPlatform } from '@/lib/services/social-publisher';

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: 'Missing postId' }, { status: 400 });

    const { data: post, error } = await supabase
      .from('social_post_drafts')
      .select('*')
      .eq('id', postId)
      .single();
    if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    const platform = post.platforms?.[0] || 'facebook';
    const { data: channel, error: chanErr } = await supabase
      .from('social_channels')
      .select('*')
      .eq('platform', platform)
      .single();
    if (chanErr || !channel) {
      return NextResponse.json({ error: `No channel configured for ${platform}` }, { status: 404 });
    }

    const mediaUrls = post.image_urls || null;
    const externalId = await publishToPlatform(platform, channel, post.caption, mediaUrls);

    await supabase
      .from('social_post_drafts')
      .update({
        status: 'published',
        postiz_id: externalId,
        published_at: new Date().toISOString(),
      })
      .eq('id', postId);

    await supabase.from('social_publish_history').insert({
      post_id: postId,
      platform,
      status: 'success',
      postiz_response: { externalId },
    });

    return NextResponse.json({ success: true, externalId });
  } catch (err) {
    console.error('Publish error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}