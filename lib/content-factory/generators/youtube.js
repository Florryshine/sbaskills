import { buildAssetContext, generateJson, PLATFORM_LIMITS } from './_shared';

export async function generateYouTube(asset, options = {}) {
  const context = buildAssetContext(asset);
  let segments = options.sharedShortScript?.segments;
  let data;

  if (Array.isArray(segments) && segments.length) {
    data = await generateJson('Create YouTube Shorts metadata for this already-written narration. Do NOT rewrite or add segments.\n\nTopic: ' +
      asset.keyword + '\nSource:\n' + context + '\nNarration:\n' + segments.map((s) => s.text).join('\n') +
      '\n\nReturn ONLY JSON: {"title":"max ' + PLATFORM_LIMITS.youtube.title +
      ' chars","description":"max ' + PLATFORM_LIMITS.youtube.description +
      ' chars","tags":["8-12 search tags"],"hashtags":["5-8 hashtags"],"thumbnail_brief":"one sentence","privacyStatus":"public"}',
      { expect:'object', maxTokens:1800 });
  } else {
    data = await generateJson('Create a YouTube Short script and SEO metadata for this topic.\n\n' + context +
      '\n\nCreate 4-7 spoken segments. Each segment has text, visual_cue and stock_search. Also create title (max ' +
      PLATFORM_LIMITS.youtube.title + ' chars), description (max ' + PLATFORM_LIMITS.youtube.description +
      ' chars), tags, hashtags, thumbnail_brief and privacyStatus.\n\nReturn ONLY JSON: {"segments":[{"text":"...","visual_cue":"...","stock_search":"..."}],"title":"...","description":"...","tags":[],"hashtags":[],"thumbnail_brief":"...","privacyStatus":"public"}',
      { expect:'object', maxTokens:3000 });
    segments = data.segments || [];
  }

  return [{ asset_type:'youtube_short', platform:'youtube', format:'video', title:data.title,
    body:segments.map((s) => s.text).join(' '),
    metadata:{description:data.description,tags:data.tags||[],hashtags:data.hashtags||[],
      thumbnail_brief:data.thumbnail_brief,privacyStatus:data.privacyStatus||'public',
      playlistId:data.playlistId||null,script_segments:segments},
    _media:{type:'video_script',format:'short',segments} }];
}
