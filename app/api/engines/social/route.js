import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

// ... (keys, helpers, sanitizeJsonString, tryOpenRouter, tryHuggingFace)

function buildSocialPrompt(asset) {
  const keyword = asset.keyword || '';
  const summary = asset.summary || '';
  const keyConcepts = (asset.key_concepts || []).slice(0,3).join(', ');
  const examples = (asset.examples || []).slice(0,2).join('; ');

  return `You are a social media marketer for Shiney Brain Academy. Create engaging social media posts to promote the topic: "${keyword}".

Summary: ${summary}
Key Concepts: ${keyConcepts}
Examples: ${examples}

Create posts for: Facebook, WhatsApp, Instagram, X, Telegram. Each post should be engaging, include emojis, and end with a call-to-action.

Return ONLY a JSON object with a "posts" array of 5 objects: { "platform": "facebook|whatsapp|instagram|x|telegram", "caption": "..." }`;
}

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

    const prompt = buildSocialPrompt(asset);

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.error('❌ Social prompt is empty:', { prompt });
      return NextResponse.json({ error: 'Prompt generation failed' }, { status: 500 });
    }

    console.log(`📝 Social prompt length: ${prompt.length}`);
    console.log(`📝 First 200 chars: ${prompt.substring(0, 200)}...`);

    let result = null;
    let usedProvider = '';
    const errors = [];

    // (same generation loop – check parsed.posts)

    const posts = result.posts.slice(0, 5);
    const inserted = [];
    for (const post of posts) {
      const { data: draft, error: draftError } = await supabase
        .from('social_post_drafts')
        .insert({
          knowledge_asset_id: asset.id,
          keyword: asset.keyword,
          platform: post.platform,
          caption: post.caption,
          status: 'draft',
          generated_from: 'knowledge_asset',
          version: 1,
        })
        .select()
        .single();

      if (draftError) {
        console.error(`Failed to insert ${post.platform}:`, draftError);
      } else {
        inserted.push(draft);
      }
    }

    if (inserted.length === 0) {
      return NextResponse.json({ error: 'Failed to save any posts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      postCount: inserted.length,
      postIds: inserted.map(p => p.id),
      usedProvider,
    });
  } catch (error) {
    console.error('❌ Social posts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}