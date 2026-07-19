// app/api/content-factory/generate/route.js
import { NextResponse } from 'next/server';
import { runContentFactory } from '@/lib/content-factory';

export async function POST(request) {
  try {
    const { knowledgeAssetId, platforms } = await request.json();
    if (!knowledgeAssetId) {
      return NextResponse.json({ error: 'knowledgeAssetId is required' }, { status: 400 });
    }
    const results = await runContentFactory(knowledgeAssetId, platforms);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Content factory generate error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
