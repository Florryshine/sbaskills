import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = createRouteHandlerClient();
    // Try to count rows in content_queue
    const { count, error } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return NextResponse.json({ success: true, count });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}