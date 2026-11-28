import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
import { parseJsonFromText } from '@/lib/robustJsonParse';

const SOCIAL_PLATFORMS = ['facebook', 'whatsapp', 'instagram', 'x', 'telegram', 'linkedin'];
const CAPTION_LIMITS = { facebook: 63206, whatsapp: 4096, instagram: 2200, x: 280, telegram: 4096, linkedin: 3000 };

function buildSocialPrompt(asset) {
  const keyword = asset.keyword || 'this topic';
  const summary = asset.summary || 'No summary available.';
  const keyConcepts = Array.isArray(asset.key_concepts) && asset.key_concepts.length
    ? asset.key_concepts.slice(0, 5).join(', ')
    : 'key concepts not provided';
  const examples = Array.isArray(asset.examples) && asset.examples.length
    ? asset.examples.slice(0, 3).join('; ')
    : 'No examples provided.';
  const facts = Array.isArray(asset.facts) && asset.facts.length
    ? asset.facts.slice(0, 6).join('; ')
    : 'No verified facts supplied.';

  return `You are the social media content strategist for Shiney Brain Academy.
Create exactly one ready-to-publish post for EACH of these platforms: ${SOCIAL_PLATFORMS.join(', ')}.

Topic: ${keyword}
Subject: ${asset.subject || 'General'}
Summary: ${summary}
Key concepts: ${keyConcepts}
Examples: ${examples}
Facts: ${facts}

Platform requirements:
- Facebook: useful, community-oriented, conversational; up to 63206 characters.
- WhatsApp: short, natural, friendly group message; up to 4096 characters.
- Instagram: strong opening, visually evocative language, relevant hashtags; up to 2200 characters.
- X: concise, attention-grabbing and complete within 280 characters.
- Telegram: informative and practical for a learning community; up to 4096 characters.
- LinkedIn: professional, insight-led and useful to educators, parents or learners; up to 3000 characters.

Rules:
- Ground claims in the supplied facts. Never invent scores, statistics, guarantees, dates or links.
- Make each platform's post distinct and adapted to its audience; do not copy the same caption six times.
- Mention Shiney Brain Academy naturally where appropriate.
- Each caption must contain a clear, natural next step.
- Return exactly six posts, one for each requested platform, no duplicates and no extras.

Return ONLY JSON:
{"posts":[
  {"platform":"facebook","caption":"..."},
  {"platform":"whatsapp","caption":"..."},
  {"platform":"instagram","caption":"..."},
  {"platform":"x","caption":"..."},
  {"platform":"telegram","caption":"..."},
  {"platform":"linkedin","caption":"..."}
]}`;
}

function validatePosts(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Array.isArray(parsed.posts)) return false;
  if (parsed.posts.length !== SOCIAL_PLATFORMS.length) return false;
  const seen = new Map();
  for (const post of parsed.posts) {
    if (!post || !SOCIAL_PLATFORMS.includes(post.platform)) return false;
    if (seen.has(post.platform)) return false;
    if (typeof post.caption !== 'string' || !post.caption.trim()) return false;
    if (post.caption.trim().length > CAPTION_LIMITS[post.platform]) return false;
    seen.set(post.platform, post);
  }
  return SOCIAL_PLATFORMS.every((platform) => seen.has(platform));
}

validatePosts.describe = (parsed) => {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'expected a JSON object with a posts array';
  if (!Array.isArray(parsed.posts)) return 'posts is missing or is not an array';
  const seen = new Set();
  const issues = [];
  for (const post of parsed.posts) {
    if (!post || !SOCIAL_PLATFORMS.includes(post.platform)) {
      issues.push('a post has a missing or unsupported platform');
      continue;
    }
    if (seen.has(post.platform)) issues.push('duplicate post for ' + post.platform);
    seen.add(post.platform);
    if (typeof post.caption !== 'string' || !post.caption.trim()) issues.push(post.platform + '.caption is missing');
    else if (post.caption.trim().length > CAPTION_LIMITS[post.platform]) {
      issues.push(post.platform + '.caption exceeds ' + CAPTION_LIMITS[post.platform] + ' characters');
    }
  }
  const missing = SOCIAL_PLATFORMS.filter((platform) => !seen.has(platform));
  if (missing.length) issues.push('missing platforms: ' + missing.join(', '));
  if (parsed.posts.length !== SOCIAL_PLATFORMS.length) issues.push('expected exactly six posts');
  return issues.join('; ') || 'social post validation failed';
};

export async function POST(request) {
  try {
    const { knowledgeAssetId } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: asset, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Knowledge asset not found' }, { status: 404 });
    }

    const { result, usedProvider, errors } = await generateWithFallback(
      buildSocialPrompt(asset),
      (text) => parseJsonFromText(text, 'object'),
      validatePosts,
      4096
    );

    if (!result) {
      return NextResponse.json({
        error: 'Social post generation failed validation across all providers.',
        details: errors || [],
      }, { status: 502 });
    }

    const rows = result.posts.map((post) => ({
      knowledge_asset_id: asset.id,
      keyword: asset.keyword,
      platform: post.platform,
      caption: post.caption.trim(),
      status: 'draft',
      generated_from: 'knowledge_asset',
      version: 1,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('social_post_drafts')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('Failed to save social drafts:', insertError);
      return NextResponse.json({ error: 'Generated posts could not be saved: ' + insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postCount: inserted?.length || 0,
      postIds: (inserted || []).map((post) => post.id),
      usedProvider,
    });
  } catch (error) {
    console.error('Social posts generation error:', error);
    return NextResponse.json({ error: error.message || 'Social generation failed' }, { status: 500 });
  }
}
