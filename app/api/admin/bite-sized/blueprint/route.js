import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generateLearningBlueprint } from '@/lib/bite-sized/blueprint';

async function getAdminContext() {
  const supabase = createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, response: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile?.role !== 'admin') {
    return { supabase, response: NextResponse.json({ error: 'Admin access required.' }, { status: 403 }) };
  }

  return { supabase, user };
}

export async function POST(request) {
  const { supabase, response } = await getAdminContext();
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const lessonId = typeof body?.lessonId === 'string' ? body.lessonId : '';
  const knowledgeAssetId = typeof body?.knowledgeAssetId === 'string' ? body.knowledgeAssetId : '';
  const rawNotes = typeof body?.rawNotes === 'string' ? body.rawNotes : '';
  const administratorInstructions = typeof body?.administratorInstructions === 'string'
    ? body.administratorInstructions
    : '';

  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required.' }, { status: 400 });
  }
  if (!knowledgeAssetId && !rawNotes.trim()) {
    return NextResponse.json({ error: 'Provide a Knowledge Asset or raw notes.' }, { status: 400 });
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, course_id, title, description, content_type')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  }

  let asset = null;
  if (knowledgeAssetId) {
    const { data, error: assetError } = await supabase
      .from('knowledge_assets')
      .select('*')
      .eq('id', knowledgeAssetId)
      .single();

    if (assetError || !data) {
      return NextResponse.json({ error: 'Knowledge Asset not found.' }, { status: 404 });
    }
    asset = data;
  }

  try {
    const { blueprint, diagnostics } = await generateLearningBlueprint({
      asset,
      rawNotes,
      administratorInstructions,
    });

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        content_type: 'bite_sized',
        learning_blueprint: blueprint,
        generation_status: 'blueprint_ready',
        content_version: 1,
      })
      .eq('id', lessonId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lessonId,
      contentType: 'bite_sized',
      generationStatus: 'blueprint_ready',
      blueprint,
      diagnostics,
    });
  } catch (error) {
    console.error('[BiteSized Blueprint] Generation failed:', error);

    await supabase
      .from('lessons')
      .update({
        content_type: 'bite_sized',
        generation_status: 'generation_failed',
      })
      .eq('id', lessonId);

    return NextResponse.json(
      {
        error: error.message || 'Learning Blueprint generation failed.',
        diagnostics: error.diagnostics || [],
      },
      { status: 502 }
    );
  }
}
