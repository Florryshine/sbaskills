// ─── Visual sourcing: stock video/image lookup per segment ───────────────
// For each segment's visual_cue (e.g. "Diagram of a leaf"), tries to find
// a real stock video clip first (more dynamic), falls back to a still
// image, and falls back to null if nothing usable is found (caller should
// render a plain color card in that case).
//
// Provider order: Pexels (video, then image) -> Pixabay (video, then image)

function getPexelsKey() {
  return process.env.PEXELS_API_KEY;
}
function getPixabayKey() {
  return process.env.PIXABAY_API_KEY;
}

/**
 * @param {string} query - the visual_cue text to search for
 * @returns {Promise<{ type: 'video'|'image'|'none', url: string|null, width?: number, height?: number }>}
 */
export async function findVisualForCue(query) {
  if (!query || !query.trim()) return { type: 'none', url: null };

  // Try Pexels video first
  const pexelsVideo = await searchPexelsVideo(query);
  if (pexelsVideo) return pexelsVideo;

  // Then Pexels image
  const pexelsImage = await searchPexelsImage(query);
  if (pexelsImage) return pexelsImage;

  // Then Pixabay video
  const pixabayVideo = await searchPixabayVideo(query);
  if (pixabayVideo) return pixabayVideo;

  // Then Pixabay image
  const pixabayImage = await searchPixabayImage(query);
  if (pixabayImage) return pixabayImage;

  return { type: 'none', url: null };
}

async function searchPexelsVideo(query) {
  const PEXELS_API_KEY = getPexelsKey();
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) {
      console.log(`Pexels video search failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    console.log(`Pexels video results for "${query}": total_results=${data.total_results}, videos found=${data.videos?.length}`);
    const video = data.videos?.[0];
    if (!video) return null;

    // Pick a reasonably sized file (avoid 4K, too heavy)
    const file =
      video.video_files.find(f => f.width && f.width <= 1920 && f.width >= 1280) ||
      video.video_files[0];

    return { type: 'video', url: file.link, width: file.width, height: file.height };
  } catch (e) {
    console.error('Pexels video search failed:', e.message);
    return null;
  }
}

async function searchPexelsImage(query) {
  const PEXELS_API_KEY = getPexelsKey();
  if (!PEXELS_API_KEY) return null;
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
      { headers: { Authorization: PEXELS_API_KEY } }
    );
    if (!res.ok) {
      console.log(`Pexels image search failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    const photo = data.photos?.[0];
    if (!photo) return null;

    return { type: 'image', url: photo.src.large, width: photo.width, height: photo.height };
  } catch (e) {
    console.error('Pexels image search failed:', e.message);
    return null;
  }
}

async function searchPixabayVideo(query) {
  const PIXABAY_API_KEY = getPixabayKey();
  if (!PIXABAY_API_KEY) return null;
  try {
    const res = await fetch(
      `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=3`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const video = data.hits?.[0];
    if (!video) return null;

    const file = video.videos.medium || video.videos.small;
    return { type: 'video', url: file.url, width: file.width, height: file.height };
  } catch (e) {
    console.error('Pixabay video search failed:', e.message);
    return null;
  }
}

async function searchPixabayImage(query) {
  const PIXABAY_API_KEY = getPixabayKey();
  if (!PIXABAY_API_KEY) return null;
  try {
    const res = await fetch(
      `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&per_page=3&image_type=photo`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const image = data.hits?.[0];
    if (!image) return null;

    return { type: 'image', url: image.largeImageURL, width: image.imageWidth, height: image.imageHeight };
  } catch (e) {
    console.error('Pixabay image search failed:', e.message);
    return null;
  }
}