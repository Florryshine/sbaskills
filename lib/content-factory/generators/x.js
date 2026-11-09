import { buildAssetContext, generateJson, PLATFORM_LIMITS, buildSharedCaptionNote } from './_shared';

export async function generateX(asset, options = {}) {
  const context = buildAssetContext(asset);
  const slides = options.sharedSlides || [];
  const [data, generatedSlides] = await Promise.all([
    generateJson(`You are writing for Shiney Brain Academy's X account. Write one single post under ${PLATFORM_LIMITS.x.caption} characters and an optional 3-4 tweet thread. Use a sharp, high-signal Nigerian education voice. Do not invent facts.\n\n${context}${buildSharedCaptionNote(options.sharedCaptionBase)}\n\nReturn ONLY JSON: {"single_post":"...","thread":["tweet 1","tweet 2"]}`, { expect: 'object' }),
    slides.length ? Promise.resolve(slides.slice(0, 4)) : import('./_shared').then(({ generateCarouselSlides }) => generateCarouselSlides(context, {
      toneNote: 'Keep slide copy short and punchy for X. Maximum four slides.', slideRange: '3-4',
    })),
  ]);
  return [{
    asset_type: 'x_post', platform: 'x', format: 'carousel', title: asset.keyword,
    body: data.single_post, metadata: { thread: data.thread || [], slides: generatedSlides },
    _media: { type: 'carousel', slides: generatedSlides, summary: asset.summary, platform: 'x' },
  }];
}
