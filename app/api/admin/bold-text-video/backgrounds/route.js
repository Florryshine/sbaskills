import { NextResponse } from 'next/server';
import { searchPexelsVideoMulti, searchPixabayVideoMulti, searchPexelsMulti, searchPixabayMulti } from '@/lib/image-search';

export async function POST(request) {
  try {
    const body = await request.json();
    const query = String(body.query || '').trim().slice(0, 160);
    const kind = body.kind === 'photo' ? 'photo' : 'video';
    if (!query) return NextResponse.json({ results: [] });
    const searches = kind === 'video'
      ? [searchPexelsVideoMulti, searchPixabayVideoMulti]
      : [searchPexelsMulti, searchPixabayMulti];
    const results = [];
    for (const search of searches) {
      try {
        const hits = await search(query, 6);
        for (const hit of hits) {
          if (hit.url && !results.some((item) => item.url === hit.url)) {
            results.push({ ...hit, type: kind });
          }
        }
      } catch (error) {
        console.warn('Bold video background search failed:', error.message);
      }
      if (results.length >= 6) break;
    }
    return NextResponse.json({ results: results.slice(0, 8), warning: results.length ? null : 'No stock results found. Try a simpler search phrase or choose a gradient.' });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Background search failed.' }, { status: 500 });
  }
}
