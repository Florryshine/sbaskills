import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { validateLessonContent } from '@/lib/bite-sized/validator';

export async function POST(request) {
  const supabase = createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const lessonId = typeof body?.lessonId === 'string' ? body.lessonId : '';
  const publish = body?.publish !== false;
  if (!lessonId) return NextResponse.json({ error: 'lessonId is required.' }, { status: 400 });

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, description, content_type, learning_blueprint, generation_diagnostics')
    .eq('id', lessonId)
    .single();
  if (lessonError || !lesson) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  if (lesson.content_type !== 'bite_sized') return NextResponse.json({ error: 'Only bite-sized lessons use this workflow.' }, { status: 400 });

  if (!publish) {
    const { error } = await supabase.from('lessons').update({ is_published: false, generation_status: 'draft' }).eq('id', lessonId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, published: false, generationStatus: 'draft' });
  }

  const { data: screens, error: screensError } = await supabase
    .from('lesson_screens')
    .select('*')
    .eq('lesson_id', lessonId)
    .order('order_index', { ascending: true });
  if (screensError) return NextResponse.json({ error: screensError.message }, { status: 500 });

  const content = {
    lesson: {
      title: lesson.title,
      description: lesson.description,
      objectives: lesson.learning_blueprint?.objectives || [],
    },
    learningBlueprint: lesson.learning_blueprint || {},
    screens: screens || [],
  };
  const validation = validateLessonContent(content, { forPublish: true });
  if (!validation.valid) {
    await supabase.from('lessons').update({ generation_status: 'needs_review', generation_diagnostics: validation.diagnostics }).eq('id', lessonId);
    return NextResponse.json({ error: 'Publishing is blocked until validation errors are resolved.', diagnostics: validation.diagnostics }, { status: 422 });
  }

  const { error: updateError } = await supabase
    .from('lessons')
    .update({
      is_published: true,
      generation_status: 'published',
      generation_diagnostics: validation.diagnostics,
    })
    .eq('id', lessonId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ success: true, published: true, generationStatus: 'published', diagnostics: validation.diagnostics });
}
