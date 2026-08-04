// app/api/admin/quote-loops/audio-list/route.js
//
// Auto-discovers whatever .mp3 files have been dropped into
// public/audio/quote-loops/ — no manifest to maintain, no filenames to
// hardcode. Add more tracks to that folder later and they just show up
// here on the next request. See public/audio/quote-loops/README.md for
// where to source them (this route can't fetch external audio itself —
// network access here is limited to Pexels/Pixabay/Wikimedia).

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'audio', 'quote-loops');

  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.mp3'))
      .map((f) => `/audio/quote-loops/${f}`);
  } catch (err) {
    // Folder missing entirely (fresh clone before anyone's added tracks) —
    // not an error, just an empty list.
    console.warn('quote-loops audio folder not readable:', err.message);
  }

  return NextResponse.json({ tracks: files });
}
