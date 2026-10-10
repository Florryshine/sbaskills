import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createRouteHandlerClient } from '@/lib/supabase-server';

const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12000;
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_WINDOW_MS = 60 * 1000;
// Best-effort per-instance protection. For a strict cross-instance limit, use a shared store.
const requestWindows = globalThis.__sbaChatRequestWindows || new Map();
globalThis.__sbaChatRequestWindows = requestWindows;

function checkRateLimit(userId) {
  const now = Date.now();
  const current = requestWindows.get(userId);
  if (!current || now - current.windowStartedAt >= RATE_WINDOW_MS) {
    requestWindows.set(userId, { windowStartedAt: now, count: 1 });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= MAX_REQUESTS_PER_MINUTE) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - current.windowStartedAt)) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // This is a paid-provider proxy: never allow anonymous visitors to spend our API quota.
    if (authError || !user) {
      return NextResponse.json({ error: 'Please sign in to use the AI tutor.' }, { status: 401 });
    }

    const limit = checkRateLimit(user.id);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'You have sent too many AI tutor requests. Please wait a moment and try again.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEY_1;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI tutor is temporarily unavailable.' }, { status: 503 });
    }

    const body = await request.json();
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return NextResponse.json({ error: 'Invalid message history.' }, { status: 400 });
    }

    const safeMessages = messages
      .filter((message) =>
        message &&
        ['system', 'user', 'assistant'].includes(message.role) &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0
      )
      .map((message) => ({ role: message.role, content: message.content.trim() }));

    if (safeMessages.length === 0) {
      return NextResponse.json({ error: 'Please enter a message.' }, { status: 400 });
    }

    const totalChars = safeMessages.reduce((total, message) => total + message.content.length, 0);
    if (totalChars > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: 'This conversation is too long. Please start a new question.' }, { status: 413 });
    }

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      messages: safeMessages,
      model: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: 'No response was generated. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ error: 'Failed to generate response. Please try again later.' }, { status: 500 });
  }
}