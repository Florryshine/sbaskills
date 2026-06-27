import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generateShineMessage } from '@/lib/groqAPI';

export async function GET(request) {
  // Optional: protect with a secret key to prevent public access
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  try {
    const supabase = createRouteHandlerClient();
    const today = new Date().toISOString().split('T')[0];

    // Check if today's message already exists
    const { data: existing } = await supabase
      .from('daily_mentor_messages')
      .select('id')
      .eq('created_at', today)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: 'Already generated for today' });
    }

    // Generate a motivational message using AI
    const studentProfile = {
      name: 'Student',
      stage: 'JAMB',
      exam: 'JAMB',
      target_scores: '280+',
      weak_subjects: 'Physics, Chemistry',
      confidence: 6,
      skills: 'Studying',
      skill_progress: '50%',
      goals: 'Pass JAMB',
      availability: '4 hours daily',
      exam_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      last_active: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    };

    const fullMessage = await generateShineMessage(studentProfile);

    // Try to extract a goal from the message (fallback)
    let goal = '';
    const goalMatch = fullMessage.match(/goal:\s*(.+)/i);
    if (goalMatch) {
      goal = goalMatch[1];
      const message = fullMessage.replace(/goal:\s*.+/i, '').trim();
    }

    // Insert into database
    const { error } = await supabase
      .from('daily_mentor_messages')
      .insert({
        message: fullMessage,
        goal: goal,
        created_at: today,
      });

    if (error) {
      console.error('Error inserting daily mentor:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: fullMessage, goal });
  } catch (error) {
    console.error('Daily mentor generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}