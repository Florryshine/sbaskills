import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient();

    const [
      { count: queued },
      { count: drafts },
      { count: published },
      { count: total }
    ] = await Promise.all([
      supabase.from('content_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('content_queue').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
      supabase.from('content_queue').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('content_queue').select('*', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      queued: queued || 0,
      drafts: drafts || 0,
      published: published || 0,
      total: total || 0,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}