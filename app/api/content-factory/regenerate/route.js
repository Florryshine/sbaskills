// app/api/content-factory/regenerate/route.js
import { NextResponse } from 'next/server';
import { regenerateOne } from '@/lib/content-factory';

export async function POST(request) {
  try {
    const { contentAssetId } = await request.json();
    if (!contentAssetId) {
      return NextResponse.json({ error: 'contentAssetId is required' }, { status: 400 });
    }
    const updated = await regenerateOne(contentAssetId);
    return NextResponse.json({ success: true, contentAsset: updated });
  } catch (error) {
    console.error('Regenerate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
