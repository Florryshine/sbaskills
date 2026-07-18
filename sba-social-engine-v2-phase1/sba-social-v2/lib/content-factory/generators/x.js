// lib/content-factory/generators/x.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateX(asset) {
  const context = buildAssetContext(asset);

  const prompt = `You are writing for Shiney Brain Academy's X (Twitter) account. X rewards short, sharp, high-signal posts — no fluff, no long setup.

${context}

X post rules:
- One single post under ${PLATFORM_LIMITS.x.caption} characters — punchy, attention-grabbing, a single clear idea.
- Also produce an optional 3-4 tweet THREAD version that breaks the concept down step by step, each tweet under 280 characters, for topics worth a deeper explainer.
- Use at most 1-2 hashtags in the single post (X hashtags perform worse than IG).

Return ONLY JSON:
{
  "single_post": "...",
  "thread": ["tweet 1", "tweet 2", "tweet 3"]
}`;

  const data = await generateJson(prompt, { expect: 'object' });

  return [
    {
      asset_type: 'x_post',
      platform: 'x',
      format: 'text',
      title: asset.keyword,
      body: data.single_post,
      metadata: { thread: data.thread || [] },
    },
  ];
}
