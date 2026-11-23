import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generateInteractiveLesson } from '@/lib/bite-sized/screens';
import { validateLessonContent } from '@/lib/bite-sized/validator';
import { createAdminClient } from '@/lib/supabase-admin';
import {
  downloadImageBuffer,
  searchPexelsMulti,
  searchPixabayMulti,
  searchWikimediaMulti,
} from '@/lib/image-search';

const IMAGE_BUCKET = 'lesson-screen-images';

function imageExtension(url) {
  const extension = String(url || '').split('?')[0].split('.').pop()?.toLowerCase();
  return ['png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
}

async function attachGeneratedImages(screens, lessonId) {
  const admin = createAdminClient();
  let attached = 0;
  const results = [];

  for (const screen of screens) {
    if (!screen.imageQuery) {
      results.push(screen);
      continue;
    }
    try {
      const providers = [searchPexelsMulti, searchPixabayMulti, searchWikimediaMulti];
      let candidate = null;
      for (const search of providers) {
        const matches = await search(screen.imageQuery, 2);
        candidate = matches.find((item) => item?.url);
        if (candidate) break;
      }
      if (!candidate) {
        results.push(screen);
        continue;
      }
      const buffer = await downloadImageBuffer(candidate.url);
      const extension = imageExtension(candidate.url);
      const path = `lesson-screens/${lessonId}/${screen.orderIndex}.${extension}`;
      const { error: uploadError } = await admin.storage.from(IMAGE_BUCKET).upload(path, buffer, {
        contentType: `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = admin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
      attached += 1;
      results.push({
        ...screen,
        imageUrl: publicUrl.publicUrl,
        imageCredit: [candidate.source, candidate.photographer, candidate.sourceUrl, candidate.license]
          .filter(Boolean)
          .join(' · '),
      });
    } catch (error) {
      console.warn('[BiteSized Screens] Image attachment failed for screen:', screen.orderIndex, error.message);
      results.push(screen);
    }
  }
  return { screens: results, attached };
}

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

function screenRow(screen, lessonId, contentVersion) {
  return {
    lesson_id: lessonId,
    order_index: screen.orderIndex,
    type: screen.type,
    headline: screen.headline || screen.title || null,
    body: screen.body || null,
    image_query: screen.imageQuery || null,
    image_alt: screen.imageAlt || null,
    image_url: screen.imageUrl || null,
    image_credit: screen.imageCredit || null,
    question: screen.question || null,
    concept: screen.concept || null,
    objective_index: Number.isInteger(screen.objectiveIndex) ? screen.objectiveIndex : null,
    difficulty: screen.difficulty || null,
    interaction_type: screen.interactionType || null,
    blueprint_refs: Array.isArray(screen.blueprintRefs) ? screen.blueprintRefs : [],
    required: screen.required !== false,
    schema_version: 1,
    content_version: contentVersion,
  };
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
  if (!lessonId) {
    return NextResponse.json({ error: 'lessonId is required.' }, { status: 400 });
  }

  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('id, title, description, content_type, learning_blueprint, content_version')
    .eq('id', lessonId)
    .single();

  if (lessonError || !lesson) {
    return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  }

  const blueprint = body?.blueprint && typeof body.blueprint === 'object'
    ? body.blueprint
    : lesson.learning_blueprint;

  if (!blueprint || typeof blueprint !== 'object') {
    return NextResponse.json({ error: 'An approved Learning Blueprint is required.' }, { status: 400 });
  }

  try {
    const { content, diagnostics } = await generateInteractiveLesson({
      blueprint,
      lessonTitle: lesson.title,
      lessonDescription: lesson.description,
    });
    const imageResult = await attachGeneratedImages(content.screens, lessonId);
    content.screens = imageResult.screens;
    const contentValidation = validateLessonContent(content, { forPublish: false });
    const contentVersion = Number.isInteger(lesson.content_version) && lesson.content_version > 0
      ? lesson.content_version
      : 1;

    const rows = content.screens.map((screen) => screenRow(screen, lessonId, contentVersion));
    const { error: deleteError } = await supabase.from('lesson_screens').delete().eq('lesson_id', lessonId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase.from('lesson_screens').insert(rows);
    if (insertError) throw insertError;

    const combinedDiagnostics = [...diagnostics, ...contentValidation.diagnostics];
    const requestedImages = content.screens.filter((screen) => Boolean(screen.imageQuery)).length;
    if (requestedImages > imageResult.attached) {
      combinedDiagnostics.push({
        severity: 'warning',
        code: 'some_lesson_images_not_attached',
        message: `${imageResult.attached} of ${requestedImages} planned instructional images were attached automatically. Open the editor to find and attach alternatives for any remaining image queries.`,
        path: 'screens.images',
      });
    }
    const nextStatus = combinedDiagnostics.some((item) => item.severity === 'error')
      ? 'needs_review'
      : 'screens_ready';

    const { error: updateError } = await supabase
      .from('lessons')
      .update({
        content_type: 'bite_sized',
        learning_blueprint: content.learningBlueprint,
        generation_status: nextStatus,
        generation_diagnostics: combinedDiagnostics,
      })
      .eq('id', lessonId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      lessonId,
      generationStatus: nextStatus,
      screenCount: rows.length,
      imageCount: imageResult.attached,
      plannedImageCount: requestedImages,
      diagnostics: combinedDiagnostics,
      screens: content.screens,
    });
  } catch (error) {
    console.error('[BiteSized Screens] Generation failed:', error);

    await supabase
      .from('lessons')
      .update({
        content_type: 'bite_sized',
        generation_status: 'generation_failed',
        generation_diagnostics: error.diagnostics || [{
          severity: 'error',
          code: 'screen_generation_failed',
          message: error.message || 'Screen generation failed.',
        }],
      })
      .eq('id', lessonId);

    return NextResponse.json(
      {
        error: error.message || 'Interactive lesson generation failed.',
        diagnostics: error.diagnostics || [],
      },
      { status: 502 }
    );
  }
}
