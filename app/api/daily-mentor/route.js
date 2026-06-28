import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { groq } from '@/lib/groqAPI';

// Optional: protect with a secret key (set CRON_SECRET in Vercel)
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request) {
  // Verify secret if set
  const authHeader = request.headers.get('x-cron-secret');
  if (CRON_SECRET && authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    // Build prompt for AI to return both message and goal
    const prompt = `You are Mentor Florryshine, a motivating and friendly Nigerian study coach for Shiney Brain Academy.

Write a short, encouraging morning message for students preparing for JAMB, WAEC, or NECO. Keep it under 100 words, practical, and Nigerian-friendly.

Then, give ONE specific daily goal (e.g., "Complete 15 Mathematics practice questions").

Format your response exactly like this:

MESSAGE: [your message]
GOAL: [your specific goal]`;

    let aiResponse = '';
    let usedModel = '';

    // Try Groq first
    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        temperature: 0.7,
      });
      aiResponse = completion.choices[0].message.content.trim();
      usedModel = 'Groq';
    } catch (groqError) {
      console.warn('Groq failed, falling back to Gemini:', groqError.message);
      // Fallback to Gemini
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const geminiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;
        if (!geminiKey) throw new Error('No Gemini key available');
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent(prompt);
        aiResponse = result.response.text().trim();
        usedModel = 'Gemini';
      } catch (geminiError) {
        console.error('Gemini also failed:', geminiError.message);
        // Last fallback: static message
        aiResponse =
          'MESSAGE: 🌅 Good morning! Every day is a chance to become smarter. Stay consistent, trust the process, and believe in yourself. You\'re building a brighter future with every study session.\nGOAL: Complete today\'s lesson and review one past question.';
      }
    }

    // Parse the response to extract message and goal
    const messageMatch = aiResponse.match(/MESSAGE:\s*(.*?)(?:\n|$)/i);
    const goalMatch = aiResponse.match(/GOAL:\s*(.*?)(?:\n|$)/i);
    const message = messageMatch ? messageMatch[1].trim() : aiResponse.slice(0, 200);
    const goal = goalMatch ? goalMatch[1].trim() : 'Stay focused and consistent today!';

    // Insert into database
    const { error } = await supabase
      .from('daily_mentor_messages')
      .insert({
        message: message,
        goal: goal,
        created_at: today,
      });

    if (error) {
      console.error('Insert error:', error);
      return NextResponse.json({ error: 'Database insert failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message,
      goal,
      usedModel,
    });
  } catch (error) {
    console.error('Daily mentor generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}