// lib/image-search.js
// Fetches MULTIPLE candidate images per query, unlike lib/image-engine.js's
// fetchStockImage() which returns just one (used for the blog hero image).
// No AI involved — these are free stock/educational image APIs.

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

// Wikimedia requires a descriptive User-Agent identifying the app + contact.
// Missing/generic User-Agent is the most common reason requests get blocked.
const WIKIMEDIA_USER_AGENT =
  'ShineyBrainAcademy/1.0 (https://shineybrainacademy.vercel.app; contact: sba.support@shineybrainacademy.com)';

export async function searchPixabayMulti(query, count = 3) {
  if (!PIXABAY_API_KEY) return [];
  try {
    const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=${Math.max(count, 3)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || []).slice(0, count).map((hit) => ({
      url: hit.largeImageURL || hit.fullHDURL || hit.webformatURL,
      sourceUrl: hit.pageURL,
      photographer: hit.user,
      source: 'pixabay',
      license: 'Pixabay License (free for commercial use, no attribution required)',
    }));
  } catch (err) {
    console.error('Pixabay search failed:', err.message);
    return [];
  }
}

export async function searchPexelsMulti(query, count = 3) {
  if (!PEXELS_API_KEY) return [];
  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${Math.max(count, 3)}`;
    const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).slice(0, count).map((photo) => ({
      url: photo.src.large2x || photo.src.large || photo.src.original,
      sourceUrl: photo.url,
      photographer: photo.photographer,
      source: 'pexels',
      license: 'Pexels License (free for commercial use, no attribution required)',
    }));
  } catch (err) {
    console.error('Pexels search failed:', err.message);
    return [];
  }
}

export async function searchWikimediaMulti(query, count = 4) {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6', // File namespace (images only)
      gsrsearch: query,
      gsrlimit: String(Math.max(count * 2, 8)), // over-fetch, some results won't have usable imageinfo
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|user',
      iiurlwidth: '1200',
      origin: '*',
    });
    const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

    const results = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      // Skip non-image files (svg diagrams are fine, but skip audio/video/pdf accidentally matched)
      const imgUrl = info.thumburl || info.url;
      if (!/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(imgUrl)) continue;

      results.push({
        url: imgUrl,
        sourceUrl: info.descriptionurl,
        photographer: info.user || info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '') || 'Unknown',
        source: 'wikimedia',
        license: info.extmetadata?.LicenseShortName?.value || 'See source page for license',
      });
      if (results.length >= count) break;
    }
    return results;
  } catch (err) {
    console.error('Wikimedia search failed:', err.message);
    return [];
  }
}

// Downloads an image URL into a Buffer so we can re-host it in our own storage
// (source CDNs can rate-limit hotlinking, and we want permanence for PDFs).
export async function downloadImageBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT } });
  if (!res.ok) throw new Error(`Failed to download image: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
