import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient();

    const { data, error } = await supabase
      .from('content_drafts')
      .select('*')
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Add computed fields for the UI
    const enriched = (data || []).map(d => ({
      ...d,
      readability_score: d.readability_score ?? d.score_readability ?? 0,
      content_score: d.content_score ?? d.score_seo ?? 0,
      images: d.image_prompts?.length || 0,
    }));

    return NextResponse.json({ items: enriched });
  } catch (error) {
    console.error('Drafts API error:', error);
    return NextResponse.json(
      { error: error.message, items: [] },
      { status: 500 }
    );
  }
}