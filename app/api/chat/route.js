import { NextResponse } from 'next/server';
import { groq } from '@/lib/groqAPI';

export async function POST(request) {
  try {
    const { messages } = await request.json();
    
    const systemMessage = messages.find(m => m.role === 'system')?.content || 'You are a helpful tutor.';
    const userMessage = messages.find(m => m.role === 'user')?.content || '';

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2000,
      temperature: 0.7,
    });

    const reply = completion.choices[0].message.content.trim();
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}