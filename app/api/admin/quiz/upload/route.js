import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient();
    const formData = await request.formData();
    const file = formData.get('file');
    const quizId = formData.get('quizId');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const fileName = file.name.toLowerCase();
    let questions = [];

    if (fileName.endsWith('.txt')) {
      const text = new TextDecoder().decode(buffer);
      questions = parseTextQuestions(text);
    } else if (fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      questions = rows.map(row => ({
        question: row.Question || row.question || '',
        options: [
          row.OptionA || row.optionA || '',
          row.OptionB || row.optionB || '',
          row.OptionC || row.optionC || '',
          row.OptionD || row.optionD || '',
        ],
        correct: row.CorrectAnswer || row.correctAnswer || row.Answer || row.answer || '',
      }));
    } else {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions found' }, { status: 400 });
    }

    let saved = 0;
    for (const q of questions) {
      if (!q.question || q.options.some(opt => !opt) || !q.correct) continue;
      const { error } = await supabase.from('quiz_questions').insert({
        quiz_id: quizId,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        option_d: q.options[3],
        correct_answer: q.correct,
      });
      if (!error) saved++;
    }

    return NextResponse.json({ success: true, saved, total: questions.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseTextQuestions(text) {
  const lines = text.split('\n');
  const questions = [];
  let current = null, options = [], correct = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.match(/^\d+\./)) {
      if (current) questions.push({ question: current, options, correct });
      current = trimmed.replace(/^\d+\.\s*/, '');
      options = [];
      correct = null;
    } else if (trimmed.match(/^[A-D]\./)) {
      options.push(trimmed.replace(/^[A-D]\.\s*/, ''));
    } else if (trimmed.match(/^(Answer|Correct):\s*([A-D])/i)) {
      const match = trimmed.match(/^(Answer|Correct):\s*([A-D])/i);
      if (match) correct = match[2];
    }
  }
  if (current) questions.push({ question: current, options, correct });
  return questions;
}