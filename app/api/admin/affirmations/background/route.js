import { NextResponse } from 'next/server';
import { searchPexelsVideoMulti, searchPixabayVideoMulti } from '@/lib/image-search';

export async function POST(request) {
  try {
    const { query } = await request.json();
    const q = String(query || 'peaceful nature scenery').trim().slice(0, 120);
    for (const search of [searchPexelsVideoMulti, searchPixabayVideoMulti]) {
      try {
        const hits = await search(q, 8);
        const usable = hits.filter((hit) => hit?.url);
        if (usable.length) {
          const pick = usable[0];
          return NextResponse.json({ background: { type: 'video', url: pick.url, source: pick.source, sourceUrl: pick.sourceUrl } });
        }
      } catch (error) { console.warn('Affirmation stock search failed:', error.message); }
    }
    return NextResponse.json({ error: 'No stock video found. Try a different scenery search.' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Background search failed.' }, { status: 500 });
  }
}