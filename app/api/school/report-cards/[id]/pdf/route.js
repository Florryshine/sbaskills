import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { ReportCardDocument } from '@/lib/pdf/ReportCardDocument';

export const dynamic = 'force-dynamic';

// GET /api/school/report-cards/[id]/pdf
// Streams a printable PDF for a single report card. Accessible to school
// staff for that school, or to the student it belongs to.
export async function GET(request, { params }) {
  const { id } = params;
  const supabase = createRouteHandlerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { data: reportCard, error } = await supabase
    .from('report_cards')
    .select('*, profiles:student_id(full_name, email, student_level), schools:school_id(id, name, slug)')
    .eq('id', id)
    .single();

  if (error || !reportCard) {
    return NextResponse.json({ error: 'Report card not found.' }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', user.id)
    .single();

  const isOwner = reportCard.student_id === user.id;
  const isStaffForSchool = profile && ['teacher', 'principal', 'admin'].includes(profile.role) &&
    (profile.role === 'admin' || profile.school_id === reportCard.school_id);

  if (!isOwner && !isStaffForSchool) {
    return NextResponse.json({ error: 'Not authorized to view this report card.' }, { status: 403 });
  }

  const pdfBuffer = await renderToBuffer(
    React.createElement(ReportCardDocument, { school: reportCard.schools, reportCard })
  );

  const fileName = `${(reportCard.profiles?.full_name || 'report-card').replace(/\s+/g, '-')}-${reportCard.term}-${reportCard.session}.pdf`.replace(/\//g, '-');

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  });
}
