import { NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { knowledgeAssetId, platforms, tone, audience } = await req.json();
    if (!knowledgeAssetId) return NextResponse.json({ error: 'Missing knowledgeAssetId' }, { status: 400 });

    const { data: asset, error } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();
    if (error || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const prompt = `Generate social media posts for platforms: ${platforms.join(', ')}. Tone: ${tone}. Audience: ${audience}. Based on content: ${asset.title}. ${asset.description || ''}`;
    const raw = await generateWithFallback(prompt, 'gemini');
    const posts = parseJsonFromText(raw);

    const inserted = [];
    for (const post of posts) {
      const { data, error: insertError } = await supabase
        .from('social_post_drafts')
        .insert({
          knowledge_asset_id: knowledgeAssetId,
          platform: post.platform,
          caption: post.caption,
          hashtags: post.hashtags,
          emojis: post.emojis,
          call_to_action: post.call_to_action,
          best_posting_time: post.best_posting_time,
          image_prompt: post.image_prompt,
          alt_text: post.alt_text,
          seo_keywords: post.seo_keywords,
          status: 'draft',
          platforms: [post.platform],
        })
        .select()
        .single();
      if (insertError) throw insertError;
      inserted.push(data);
    }

    return NextResponse.json({ success: true, posts: inserted });
  } catch (err) {
    console.error('Generate error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
