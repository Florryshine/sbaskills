import { requireAdminApi } from '@/lib/require-admin-api';
import { NextResponse } from 'next/server';
import { renderTegakiStyleImage } from '@/lib/tegaki-engine/render';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_STYLES = new Set([
  'classic-notebook', 'premium-notes', 'exam-revision',
  'colourful-classroom', 'dark-chalkboard', 'digital-study-pad',
]);

export async function POST(request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const title = String(body.title || '').trim().slice(0, 100);
    const text = String(body.text || '').trim().slice(0, 3200);
    const styleId = String(body.styleId || 'classic-notebook');
    if (!ALLOWED_STYLES.has(styleId)) {
      return NextResponse.json({ error: 'Unsupported Tegaki visual style.' }, { status: 400 });
    }
    if (!title || !text) {
      return NextResponse.json({ error: 'Add a lesson title and lesson text before previewing.' }, { status: 400 });
    }

    const sections = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 18).map((line) => {
      if (/^[-•*]\s*/.test(line)) return { type: 'bullet', text: line.replace(/^[-•*]\s*/, '') };
      if (/^\d+[.)]\s*/.test(line)) return { type: 'numbered', text: line.replace(/^\d+[.)]\s*/, '') };
      if (/^(definition|example|formula|note|key points?):/i.test(line)) return { type: 'subheading', text: line };
      return { type: 'paragraph', text: line };
    });
    if (!sections.length) return NextResponse.json({ error: 'Enter at least one lesson paragraph.' }, { status: 400 });

    const png = await renderTegakiStyleImage({
      styleId,
      title,
      subject: String(body.subject || 'General').slice(0, 40),
      category: 'Tegaki Lesson',
      exam: 'JAMB',
      sections,
    });
    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to render this Tegaki preview.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
