import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = String(searchParams.get('subject') || '').trim().slice(0, 50);
    if (!subject) return NextResponse.json({ error: 'Choose a subject.' }, { status: 400 });
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('knowledge_assets')
      .select('id, keyword, subject, summary, exam_type')
      .eq('subject', subject)
      .order('keyword', { ascending: true })
      .limit(100);
    if (error) throw error;
    return NextResponse.json({ assets: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unable to load Knowledge Assets.' }, { status: 500 });
  }
}
