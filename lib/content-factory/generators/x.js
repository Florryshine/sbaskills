// lib/content-factory/generators/x.js
import { buildAssetContext, generateJson, PLATFORM_LIMITS, generateCarouselSlides } from './_shared';

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

  const [data, slides] = await Promise.all([
    generateJson(prompt, { expect: 'object' }),
    // X allows a max of 4 images per post, so request fewer slides up
    // front rather than generating 5-7 and having to drop some later.
    generateCarouselSlides(context, {
      toneNote: 'Keep the slide copy short and punchy, matching X\'s high-signal, no-fluff style.',
      slideRange: '3-4',
    }),
  ]);

  return [
    {
      asset_type: 'x_post',
      platform: 'x',
      format: 'carousel',
      title: asset.keyword,
      body: data.single_post,
      metadata: { thread: data.thread || [], slides },
      // consumed by lib/content-factory/index.js, stripped before insert.
      // X supports up to 4 images per post — a carousel-style image set
      // fits within that and outperforms a single hero image on reach.
      _media: {
        type: 'carousel',
        slides,
        summary: asset.summary,
        // Explicit instead of relying on getStyle()'s instagram fallback in
        // render-canvas.js — X has no PLATFORM_STYLES entry of its own yet,
        // so this resolves to the exact same bold/square look Instagram
        // gets. Naming it here (rather than leaving it implicit) is what
        // lets the background-recolor feature recognize X as eligible.
        platform: 'x',
      },
    },
  ];
}
