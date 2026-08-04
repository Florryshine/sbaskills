import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// Minimal CSV line parser that respects double-quoted fields (so commas
// inside a quoted "learning objective, with a comma" don't split the row,
// and "" inside a quoted field becomes a literal ").
function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

// Multi-value hint cells (exam_type, learning_objectives) are semicolon-
// separated within their single CSV field, e.g. "JAMB;WAEC" or
// "Define isotopes.;Differentiate isotopes from isobars."
function parseMultiValue(raw) {
  if (!raw) return [];
  return raw.split(';').map((v) => v.trim()).filter(Boolean);
}

export async function GET(request) {
  try {
    const supabase = createRouteHandlerClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit')) || 50;

    let query = supabase
      .from('content_queue')
      .select('*')
      .order('priority_order', { ascending: true })
      .limit(limit);

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ items: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());

    // Required: keyword. Everything else is optional and matched by header
    // name so column order doesn't matter and old 3-column CSVs still work.
    const keywordIdx = headers.indexOf('keyword');
    const categoryIdx = headers.indexOf('category');
    const priorityIdx = headers.indexOf('priority');
    const subjectIdx = headers.indexOf('subject');
    const examTypeIdx = headers.indexOf('exam_type');
    const objectivesIdx = headers.indexOf('learning_objectives');

    if (keywordIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must include a "keyword" column' },
        { status: 400 }
      );
    }

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const keyword = values[keywordIdx];
      if (!keyword) continue;

      const item = {
        keyword,
        category: (categoryIdx > -1 && values[categoryIdx]) || 'General',
        priority: (priorityIdx > -1 && values[priorityIdx]) || 'Medium',
        priority_order: i,
        status: 'pending',
      };

      // Optional AI-hint fields — steer generation toward exact exam
      // context instead of the model guessing cold. Left blank/omitted is
      // fine; the generate step still does full independent research.
      if (subjectIdx > -1 && values[subjectIdx]) {
        item.subject_hint = values[subjectIdx];
      }
      if (examTypeIdx > -1 && values[examTypeIdx]) {
        item.exam_type_hint = parseMultiValue(values[examTypeIdx]);
      }
      if (objectivesIdx > -1 && values[objectivesIdx]) {
        item.learning_objectives_hint = parseMultiValue(values[objectivesIdx]);
      }

      items.push(item);
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid rows found' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient();

    // Find which keywords already exist in the queue
    const incomingKeywords = items.map(item => item.keyword);
    const { data: existingRows, error: existingError } = await supabase
      .from('content_queue')
      .select('keyword')
      .in('keyword', incomingKeywords);

    if (existingError) throw existingError;

    const existingKeywords = new Set((existingRows || []).map(row => row.keyword));
    const newItems = items.filter(item => !existingKeywords.has(item.keyword));
    const duplicateKeywords = items
      .filter(item => existingKeywords.has(item.keyword))
      .map(item => item.keyword);

    // Mark duplicates as draft instead of rejecting the whole batch
    if (duplicateKeywords.length > 0) {
      const { error: updateError } = await supabase
        .from('content_queue')
        .update({ status: 'draft' })
        .in('keyword', duplicateKeywords);

      if (updateError) throw updateError;
    }

    // Insert only the genuinely new keywords
    let insertedCount = 0;
    if (newItems.length > 0) {
      const { data, error } = await supabase
        .from('content_queue')
        .insert(newItems)
        .select();

      if (error) throw error;
      insertedCount = data.length;
    }

    return NextResponse.json({
      success: true,
      count: insertedCount,
      duplicates: duplicateKeywords.length,
      message: `${insertedCount} new keywords added, ${duplicateKeywords.length} duplicates marked as draft`,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}