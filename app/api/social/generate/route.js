import { NextResponse } from 'next/server';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const SUPPORTED_PLATFORMS = ['facebook', 'whatsapp', 'instagram', 'x', 'threads', 'telegram', 'linkedin'];

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, subject, summary')
    .order('keyword', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateSocialPosts(parsed, requestedPlatforms) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.posts)) return false;
  const posts = parsed.posts;
  const byPlatform = new Map();
  for (const post of posts) {
    if (!post || !SUPPORTED_PLATFORMS.includes(post.platform) || !isText(post.caption)) return false;
    if (byPlatform.has(post.platform)) return false;
    if (post.hashtags != null && (!Array.isArray(post.hashtags) || post.hashtags.some((tag) => !isText(tag)))) return false;
    if (post.seo_keywords != null && (!Array.isArray(post.seo_keywords) || post.seo_keywords.some((tag) => !isText(tag)))) return false;
    byPlatform.set(post.platform, post);
  }
  return requestedPlatforms.every((platform) => byPlatform.has(platform));
}

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { knowledgeAssetId, tone = 'clear, engaging and educational', audience = 'students preparing for exams' } = body || {};
    const topicOverride = typeof body?.topic === 'string' ? body.topic.trim() : '';
    const subjectOverride = typeof body?.subject === 'string' ? body.subject.trim() : '';
    const requestedPlatforms = Array.isArray(body?.platforms)
      ? [...new Set(body.platforms.map((platform) => String(platform).toLowerCase().trim()))]
      : [];

    if (!knowledgeAssetId) return NextResponse.json({ error: 'Missing knowledgeAssetId' }, { status: 400 });
    if (!requestedPlatforms.length) return NextResponse.json({ error: 'Select at least one platform' }, { status: 400 });
    const unsupported = requestedPlatforms.filter((platform) => !SUPPORTED_PLATFORMS.includes(platform));
    if (unsupported.length) {
      return NextResponse.json({ error: 'Unsupported platform(s): ' + unsupported.join(', ') }, { status: 400 });
    }

    const { data: asset, error } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();
    if (error || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    const topic = topicOverride || asset.keyword || asset.title || 'Learning topic';
    const subject = subjectOverride || asset.subject || 'General';

    const platformInstructions = {
      facebook: '2-4 useful conversational paragraphs; encourage discussion or sharing.',
      whatsapp: 'Short, natural group-friendly message; avoid sounding like an advert.',
      instagram: 'Strong first line, readable short paragraphs, relevant hashtags and a clear CTA.',
      x: 'Concise, attention-grabbing post within 280 characters including hashtags.',
      telegram: 'Informative, useful post with a clear CTA; suitable for a learning community.',
      linkedin: 'Professional, insight-led post for educators, parents and learners.',
    };
    const prompt = `Create exactly one ready-to-publish social post for each requested platform: ${requestedPlatforms.join(', ')}.
Brand: Shiney Brain Academy.
Tone: ${String(tone).slice(0, 160)}.
Audience: ${String(audience).slice(0, 160)}.
Topic: ${asset.keyword || asset.title || 'Learning topic'}.
Subject: ${asset.subject || 'General'}.
Summary: ${asset.summary || asset.description || 'No summary supplied.'}
Key concepts: ${(asset.key_concepts || []).slice(0, 8).join('; ') || 'Not supplied'}.
Facts: ${(asset.facts || []).slice(0, 8).join('; ') || 'Not supplied'}.
Examples: ${(asset.examples || []).slice(0, 4).join('; ') || 'Not supplied'}.

Platform-specific direction:
${requestedPlatforms.map((platform) => platform + ': ' + platformInstructions[platform]).join('\n')}

Rules:
- Stay faithful to the supplied facts. Do not invent statistics, guarantees, links, dates or claims.
- Make the post genuinely useful and specific to the topic, not generic motivational filler.
- Include a clear, natural call to action and mention Shiney Brain Academy where appropriate.
- Return exactly one post per requested platform, no extras and no duplicate platforms.
- hashtags, emojis and seo_keywords must be arrays of strings (empty arrays are allowed).
- best_posting_time should be a short suggestion, not a claimed fact.
- image_prompt should describe a relevant image that could accompany this exact post; alt_text should describe that image accessibly.

Return ONLY JSON:
{"posts":[{"platform":"facebook","caption":"...","hashtags":["#..."],"emojis":["📚"],"call_to_action":"...","best_posting_time":"...","image_prompt":"...","alt_text":"...","seo_keywords":["..."]}]}

Include only requested platforms in posts.`;

    const validate = (parsed) => validateSocialPosts(parsed, requestedPlatforms);
    validate.describe = (parsed) => {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'expected a JSON object with a posts array';
      if (!Array.isArray(parsed.posts)) return 'posts is missing or is not an array';
      const issues = [];
      const seen = new Set();
      for (const post of parsed.posts) {
        if (!post || !SUPPORTED_PLATFORMS.includes(post.platform)) {
          issues.push('a post has a missing or unsupported platform');
          continue;
        }
        if (seen.has(post.platform)) issues.push('duplicate post for ' + post.platform);
        seen.add(post.platform);
        if (!isText(post.caption)) issues.push(post.platform + '.caption is missing');
        if (post.hashtags != null && !Array.isArray(post.hashtags)) issues.push(post.platform + '.hashtags must be an array');
        if (post.seo_keywords != null && !Array.isArray(post.seo_keywords)) issues.push(post.platform + '.seo_keywords must be an array');
      }
      const missing = requestedPlatforms.filter((platform) => !seen.has(platform));
      if (missing.length) issues.push('missing requested platforms: ' + missing.join(', '));
      return issues.join('; ') || 'social post validation failed';
    };

    const { result, errors } = await generateWithFallback(
      prompt,
      (text) => parseJsonFromText(text, 'object'),
      validate,
      4096
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Social post generation failed validation across all providers.', details: errors || [] },
        { status: 502 }
      );
    }

    const inserted = [];
    for (const platform of requestedPlatforms) {
      const post = result.posts.find((item) => item.platform === platform);
      const { data, error: insertError } = await supabase
        .from('social_post_drafts')
        .insert({
          knowledge_asset_id: knowledgeAssetId,
          platform,
          caption: post.caption.trim(),
          hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
          emojis: Array.isArray(post.emojis) ? post.emojis : [],
          call_to_action: post.call_to_action || null,
          best_posting_time: post.best_posting_time || null,
          image_prompt: post.image_prompt || null,
          alt_text: post.alt_text || null,
          seo_keywords: Array.isArray(post.seo_keywords) ? post.seo_keywords : [],
          status: 'draft',
          platforms: [platform],
        })
        .select()
        .single();
      if (insertError) {
        console.error('Failed to save generated ' + platform + ' draft:', insertError);
        throw new Error('Could not save the ' + platform + ' draft: ' + insertError.message);
      }
      inserted.push(data);
    }

    return NextResponse.json({
      success: true,
      posts: inserted,
      postCount: inserted.length,
      campaign: { id: asset.id, name: topic, audience: String(audience), tone: String(tone) },
    });
  } catch (err) {
    console.error('Social generation error:', err);
    return NextResponse.json({ error: err.message || 'Social generation failed' }, { status: 500 });
  }
}
