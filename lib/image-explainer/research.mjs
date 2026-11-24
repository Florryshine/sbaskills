import {
  searchPixabayMulti,
  searchPexelsMulti,
  searchWikimediaMulti,
  searchPexelsVideoMulti,
  searchPixabayVideoMulti,
} from '../image-search.js';
import { cleanResearchText as clean, abstractFromInvertedIndex, buildResearchQueries } from './research-utils.mjs';

const USER_AGENT = 'ShineyBrainAcademy/1.0 (https://shineybrainacademy.vercel.app; educational research)';
const TIMEOUT_MS = 12000;


async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Research provider returned HTTP ${response.status}`);
  return response.json();
}


async function searchWikipedia(query) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', list: 'search', srsearch: query,
    srlimit: '3', srprop: 'snippet', utf8: '1',
  });
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`);
  const hits = data?.query?.search || [];
  const summaries = await Promise.all(hits.slice(0, 2).map(async (hit) => {
    try {
      const page = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`);
      return {
        title: clean(page.title, 180),
        extract: clean(page.extract, 1800),
        url: page.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        source: 'Wikipedia',
        source_type: 'encyclopedia',
        retrieved_at: new Date().toISOString(),
      };
    } catch { return null; }
  }));
  return summaries.filter((item) => item?.extract);
}

async function searchOpenAlex(query) {
  const params = new URLSearchParams({
    search: query, 'per-page': '4',
    select: 'id,doi,title,publication_year,authorships,primary_location,biblio,abstract_inverted_index,type',
  });
  const data = await fetchJson(`https://api.openalex.org/works?${params}`);
  return (data?.results || []).slice(0, 4).map((work) => ({
    title: clean(work.title, 300),
    year: work.publication_year || null,
    authors: (work.authorships || []).slice(0, 5).map((a) => clean(a.author?.display_name, 100)).filter(Boolean),
    doi: work.doi || null,
    url: work.doi || work.primary_location?.landing_page_url || work.id,
    abstract: abstractFromInvertedIndex(work.abstract_inverted_index),
    source: 'OpenAlex',
    source_type: 'scholarly_metadata',
    publication_type: work.type || null,
  })).filter((item) => item.title && item.url);
}


function normalizeAsset(item, query, type) {
  return {
    title: clean(item.title || item.name || item.photographer || query, 180),
    media_type: type,
    preview_url: item.previewUrl || item.url || null,
    media_url: item.url || null,
    source_url: item.sourceUrl || null,
    creator: clean(item.photographer || item.user, 160) || 'Not provided by provider',
    provider: item.source || 'unknown',
    license: clean(item.license, 240) || 'License not supplied; do not use until verified',
    attribution_required: /creative commons|cc by|cc-by|attribution/i.test(item.license || ''),
    query,
    duration_seconds: item.durationSeconds || null,
    review_status: 'needs_admin_review',
  };
}

export async function researchImageExplainer({ analysis, instruction = '' }) {
  if (!analysis?.subject) throw new Error('Image analysis must identify a subject before research can start.');
  const queries = buildResearchQueries(analysis, instruction);
  if (!queries.length) throw new Error('No usable research search terms were found.');

  const researchResults = await Promise.all(queries.map(async (query) => {
    const [encyclopedia, scholarly, commons, pexels, pixabay, pexelsVideo, pixabayVideo] = await Promise.all([
      searchWikipedia(query).catch((error) => ({ provider_error: clean(error.message, 240) })),
      searchOpenAlex(query).catch((error) => ({ provider_error: clean(error.message, 240) })),
      searchWikimediaMulti(query, 3).catch(() => []),
      searchPexelsMulti(query, 2).catch(() => []),
      searchPixabayMulti(query, 2).catch(() => []),
      searchPexelsVideoMulti(query, 1).catch(() => []),
      searchPixabayVideoMulti(query, 1).catch(() => []),
    ]);
    return { query, encyclopedia, scholarly, assets: [
      ...(Array.isArray(commons) ? commons.map((item) => normalizeAsset(item, query, 'image')) : []),
      ...(Array.isArray(pexels) ? pexels.map((item) => normalizeAsset(item, query, 'image')) : []),
      ...(Array.isArray(pixabay) ? pixabay.map((item) => normalizeAsset(item, query, 'image')) : []),
      ...(Array.isArray(pexelsVideo) ? pexelsVideo.map((item) => normalizeAsset(item, query, 'video')) : []),
      ...(Array.isArray(pixabayVideo) ? pixabayVideo.map((item) => normalizeAsset(item, query, 'video')) : []),
    ] };
  }));

  const sources = researchResults.flatMap((result) => [
    ...(Array.isArray(result.encyclopedia) ? result.encyclopedia : []),
    ...(Array.isArray(result.scholarly) ? result.scholarly : []),
  ]);
  const assets = researchResults.flatMap((result) => result.assets);
  const uniqueSources = [...new Map(sources.map((item) => [item.url, item])).values()].slice(0, 20);
  const uniqueAssets = [...new Map(assets.filter((item) => item.media_url).map((item) => [item.media_url, item])).values()].slice(0, 30);

  return {
    subject: analysis.subject,
    queries,
    sources: uniqueSources,
    assets: uniqueAssets,
    provider_health: {
      wikipedia: researchResults.some((r) => Array.isArray(r.encyclopedia)),
      openalex: researchResults.some((r) => Array.isArray(r.scholarly)),
      asset_search: uniqueAssets.length > 0,
    },
    research_limitations: [
      'Search results are research leads, not automatically verified claims. Confirm important facts against the cited source before scripting.',
      'Scholarly search returns bibliographic metadata and may include an abstract when OpenAlex supplies one; it does not imply the full paper is open access.',
      'Asset search results are candidates only. Review the original source page, exact license, attribution requirements, usage restrictions and download rights before production.',
      'Do not assume every result is suitable for commercial use. Items without a clear license remain blocked from production until reviewed.',
    ],
    researched_at: new Date().toISOString(),
  };
}
