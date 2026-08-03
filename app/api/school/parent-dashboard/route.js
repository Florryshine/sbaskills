import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET /api/school/parent-dashboard
// Returns everything the signed-in parent can see: their linked children,
// each child's report cards (all terms, for a progress view), and recent
// daily observations. Relies entirely on RLS (is_parent_of helper) so it
// only ever returns the caller's own linked children's data.
export async function GET() {
  const supabase = createRouteHandlerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'parent') {
    return NextResponse.json({ error: 'This dashboard is for parent accounts.' }, { status: 403 });
  }

  const { data: links, error: linksError } = await supabase
    .from('parent_links')
    .select('student_id, student:student_id(id, full_name, student_level, email)')
    .eq('parent_id', user.id);

  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });

  const studentIds = (links || []).map(l => l.student_id);
  if (studentIds.length === 0) {
    return NextResponse.json({ children: [] });
  }

  const [{ data: reportCards }, { data: observations }] = await Promise.all([
    supabase
      .from('report_cards')
      .select('id, student_id, term, session, class_level, subject_scores, teacher_comment, principal_comment, position_in_class, class_size, created_at')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('student_observations')
      .select('id, student_id, date, status, note')
      .in('student_id', studentIds)
      .order('date', { ascending: false })
      .limit(60),
  ]);

  const children = (links || []).map(link => ({
    ...link.student,
    reportCards: (reportCards || []).filter(rc => rc.student_id === link.student_id),
    observations: (observations || []).filter(o => o.student_id === link.student_id),
  }));

  return NextResponse.json({ children });
}
