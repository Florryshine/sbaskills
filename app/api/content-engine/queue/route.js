import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

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
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

    const items = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 2) continue;
      const item = {
        keyword: values[0],
        category: values[1] || 'General',
        priority: values[2] || 'Medium',
        priority_order: i,
        status: 'pending',
      };
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