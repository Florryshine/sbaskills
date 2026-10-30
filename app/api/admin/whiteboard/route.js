import {NextResponse} from 'next/server';

// Retired intentionally: the old endpoint inserted whiteboard jobs into
// video_scripts, where the legacy stock-video worker could claim them.
export async function POST() {
  return NextResponse.json(
    {error: 'This queue endpoint is retired. Use Video Studio to render directly in your browser.'},
    {status: 410}
  );
}
