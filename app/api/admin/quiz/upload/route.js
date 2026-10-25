import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { parseQuizTxt, parseQuizCsv, parseQuizObjects } from '@/lib/quizParser';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const quizId = formData.get('quizId');
    if (!file || !quizId) {
      return NextResponse.json({ error: 'file and quizId are required' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    let result;
    if (name.endsWith('.txt')) {
      result = parseQuizTxt(await file.text());
    } else if (name.endsWith('.csv')) {
      result = parseQuizCsv(await file.text());
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      result = parseQuizObjects(XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false }));
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Upload .txt, .csv, .xlsx or .xls.' }, { status: 400 });
    }

    const { questions, skipped } = result;
    const total = questions.length + skipped.length;
    if (questions.length === 0) {
      return NextResponse.json({ error: 'No complete questions found in the file.', skipped }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();
    const { data: existing } = await supabase
      .from('quiz_questions')
      .select('order_index')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: false })
      .limit(1);
    const startIndex = existing?.[0]?.order_index != null ? existing[0].order_index + 1 : 0;

    const rows = questions.map((q, i) => ({
      quiz_id: quizId,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation || null,
      points: q.points || 1,
      order_index: startIndex + i,
    }));

    const { error } = await supabase.from('quiz_questions').insert(rows);
    if (error) {
      const hint = /explanation/i.test(error.message)
        ? ' (The explanation column is missing. Run migration 20261016_quiz_question_explanations.sql.)'
        : '';
      return NextResponse.json({ error: error.message + hint }, { status: 500 });
    }

    return NextResponse.json({
      saved: rows.length,
      total,
      with_explanation: rows.filter((r) => r.explanation).length,
      skipped,
    });
  } catch (error) {
    console.error('Quiz upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}