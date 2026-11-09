import { buildAssetContext, generateJson, PLATFORM_LIMITS, buildSharedCaptionNote } from './_shared';

export async function generateTikTok(asset, options = {}) {
  const context = buildAssetContext(asset);
  let segments = options.sharedShortScript?.segments;
  let data;
  if (Array.isArray(segments) && segments.length) {
    data = await generateJson('Write a TikTok caption and hashtags for this existing educational short. Do NOT rewrite or change the narration segments.\n\n' +
      context + '\n\nNarration:\n' + segments.map((s) => s.text).join('\n') + buildSharedCaptionNote(options.sharedCaptionBase) +
      '\n\nCaption max ' + PLATFORM_LIMITS.tiktok.caption +
      ' characters. Casual Nigerian Gen-Z tone, end with a question and one short follow line. Return ONLY JSON: {"caption":"...","hashtags":["#tag"],"privacy_level":"PUBLIC_TO_EVERYONE"}',
      { expect:'object', maxTokens:1400 });
  } else {
    data = await generateJson('Create a TikTok educational short script and caption.\n\n' + context +
      '\n\nCreate 3-6 spoken segments, each with text, visual_cue and stock_search. Caption max ' +
      PLATFORM_LIMITS.tiktok.caption + ' chars, casual Nigerian Gen-Z tone, end with a question and one short follow line.' +
      buildSharedCaptionNote(options.sharedCaptionBase) +
      ' Return ONLY JSON: {"segments":[{"text":"...","visual_cue":"...","stock_search":"..."}],"caption":"...","hashtags":[],"privacy_level":"PUBLIC_TO_EVERYONE"}',
      { expect:'object', maxTokens:2500 });
    segments = data.segments || [];
  }
  return [{ asset_type:'tiktok_video', platform:'tiktok', format:'video', title:asset.keyword,
    body:segments.map((s) => s.text).join(' '),
    metadata:{caption:data.caption,hashtags:data.hashtags||[],privacy_level:data.privacy_level||'PUBLIC_TO_EVERYONE',script_segments:segments},
    _media:{type:'video_script',format:'short',segments} }];
}
