import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Parses one CSV line, respecting quoted fields that may contain commas.
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = values[idx] || ''));
    rows.push(obj);
  }
  return rows;
}

// Parses the .txt format documented on the upload page:
// 1. Question text
// A. Option
// B. Option
// C. Option
// D. Option
// Answer: B
function parseTxt(text) {
  const lines = text.split('\n');
  const rows = [];
  let current = null;
  let questionLines = [];

  const flush = () => {
    if (!current) return;
    current.question = questionLines.join(' ').trim();
    if (current.question) rows.push(current);
    current = null;
    questionLines = [];
  };

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) flush();
      continue;
    }
    if (/^\d+[).]/.test(line) || /^Q\d*[:.]/i.test(line)) {
      if (current) flush();
      current = { question: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'a', points: 1 };
      questionLines = [line.replace(/^\d+[).]\s*/, '').replace(/^Q\d*[:.]\s*/i, '')];
      continue;
    }
    if (current) {
      const optMatch = line.match(/^([A-D])\s*[).]\s*(.+)/i);
      if (optMatch) {
        const letter = optMatch[1].toLowerCase();
        current[`option_${letter}`] = optMatch[2].trim();
        continue;
      }
      const ansMatch = line.match(/^Answer:\s*([A-D])/i);
      if (ansMatch) {
        current.correct_answer = ansMatch[1].toLowerCase();
        continue;
      }
      questionLines.push(line);
    }
  }
  if (current) flush();
  return rows;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const quizId = formData.get('quizId');

    if (!file || !quizId) {
      return NextResponse.json({ error: 'file and quizId are required' }, { status: 400 });
    }

    const text = await file.text();
    const name = file.name.toLowerCase();

    let parsed = [];
    if (name.endsWith('.csv')) {
      parsed = parseCsv(text).map((r) => ({
        question: r.question || '',
        option_a: r.option_a || r.optiona || '',
        option_b: r.option_b || r.optionb || '',
        option_c: r.option_c || r.optionc || '',
        option_d: r.option_d || r.optiond || '',
        correct_answer: (r.correct_answer || r.correctanswer || 'a').toLowerCase(),
        points: parseInt(r.points) || 1,
      }));
    } else if (name.endsWith('.txt')) {
      parsed = parseTxt(text);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a .txt or .csv file (Excel: save as CSV first).' },
        { status: 400 }
      );
    }

    const total = parsed.length;
    const valid = parsed.filter(
      (q) => q.question && q.option_a && q.option_b && q.option_c && q.option_d && q.correct_answer
    );

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No complete questions found in the file.' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // Find current max order_index for this quiz so new questions append at the end
    const { data: existing } = await supabase
      .from('quiz_questions')
      .select('order_index')
      .eq('quiz_id', quizId)
      .order('order_index', { ascending: false })
      .limit(1);
    const startIndex = existing?.[0]?.order_index != null ? existing[0].order_index + 1 : 0;

    const rows = valid.map((q, i) => ({
      quiz_id: quizId,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      points: q.points || 1,
      order_index: startIndex + i,
    }));

    const { error } = await supabase.from('quiz_questions').insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: valid.length, total });
  } catch (error) {
    console.error('Quiz upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
