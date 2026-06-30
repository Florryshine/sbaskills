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

    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Drafts API error:', error);
    return NextResponse.json(
      { error: error.message, items: [] },
      { status: 500 }
    );
  }
}