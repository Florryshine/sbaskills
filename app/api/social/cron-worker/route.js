import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { publishToPlatform } from '@/lib/services/social-publisher';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const now = new Date().toISOString();

  const { data: posts, error } = await supabase
    .from('social_post_drafts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .is('postiz_id', null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const post of posts) {
    try {
      const platform = post.platforms?.[0] || 'facebook';
      const { data: channel, error: chanErr } = await supabase
        .from('social_channels')
        .select('*')
        .eq('platform', platform)
        .single();

      if (chanErr || !channel) {
        throw new Error(`No channel for ${platform}`);
      }

      const mediaUrls = post.image_urls || null;
      const externalId = await publishToPlatform(platform, channel, post.caption, mediaUrls);

      await supabase
        .from('social_post_drafts')
        .update({
          status: 'published',
          postiz_id: externalId,
          published_at: now,
        })
        .eq('id', post.id);

      await supabase.from('social_publish_history').insert({
        post_id: post.id,
        platform,
        status: 'success',
        postiz_response: { externalId },
      });

      results.push({ id: post.id, status: 'success', externalId });
    } catch (err) {
      const retryCount = (post.retry_count || 0) + 1;
      const newStatus = retryCount >= 3 ? 'failed' : 'scheduled';
      await supabase
        .from('social_post_drafts')
        .update({
          retry_count: retryCount,
          status: newStatus,
          error_message: err.message,
        })
        .eq('id', post.id);
      results.push({ id: post.id, status: 'error', message: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}