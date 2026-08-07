// app/api/admin/meme-loops/audio-list/route.js
//
// Same auto-discovery pattern as quote-loops/audio-list — but pointed at
// public/audio/meme-loops/ (laugh tracks / reaction stings), not
// instrumental music. Drop more .mp3 files in that folder and they show
// up here on the next request, no code change needed. See
// public/audio/meme-loops/README.md for where to source more.

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'audio', 'meme-loops');

  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.mp3'))
      .map((f) => `/audio/meme-loops/${f}`);
  } catch (err) {
    console.warn('meme-loops audio folder not readable:', err.message);
  }

  return NextResponse.json({ tracks: files });
}
