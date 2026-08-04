// lib/pdf/youtube.js
// Turns a bare YouTube URL block into a rich video card by calling
// YouTube's public oEmbed endpoint (no API key needed). Only fetches
// title, author (channel) name, and thumbnail — that's all oEmbed
// exposes. Duration and channel logo would need the full YouTube Data
// API (a key + quota), which is intentionally skipped for now.
//
// This must run BEFORE rendering, since @react-pdf/renderer builds its
// tree synchronously — there's no way to fetch mid-render. Call this on
// the parsed blocks array first, then pass the enriched blocks into
// BookDocument.

export async function enrichYoutubeBlocks(blocks) {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.type !== 'youtube') return block;

      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(block.url)}&format=json`;
        const res = await fetch(oembedUrl);
        if (!res.ok) throw new Error(`oEmbed ${res.status}`);
        const data = await res.json();

        return {
          ...block,
          title: data.title || null,
          channel: data.author_name || null,
          thumbnailUrl: data.thumbnail_url || null,
        };
      } catch (err) {
        // Video is unlisted/private/deleted, or the request failed —
        // fall back to a plain link card rather than failing the whole
        // PDF generation.
        return { ...block, title: null, channel: null, thumbnailUrl: null };
      }
    })
  );
}
