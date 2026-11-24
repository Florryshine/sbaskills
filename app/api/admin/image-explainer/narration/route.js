import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ALLOWED_VOICES = new Set([
  'warm_male', 'bright_female', 'calm_male',
  'friendly_female', 'nigerian_male', 'uk_male',
]);

export async function POST(req) {
  const { response } = await requireAdminApi();
  if (response) return response;

  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'Provide a project id.' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: current, error: readError } = await supabase
      .from('image_explainer_jobs')
      .select('id,title,status,script,spec,narration_manifest')
      .eq('id', body.id)
      .single();

    if (readError || !current) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    const retry = body.retry === true;
    if (!current.script || current.script.review_status !== 'admin_reviewed' ||
        !Array.isArray(current.script.scenes) || current.script.scenes.length === 0) {
      return NextResponse.json({
        error: 'Save an administrator-approved script and storyboard before generating narration.',
      }, { status: 409 });
    }

    if (retry && current.status !== 'failed') {
      return NextResponse.json({ error: 'Only failed narration jobs can be retried.' }, { status: 409 });
    }
    if (!retry && current.status !== 'analysed') {
      return NextResponse.json({ error: 'This project is already processing or is not ready for narration.' }, { status: 409 });
    }
    if (!retry && current.narration_manifest) {
      return NextResponse.json({ error: 'Narration already exists. Use the regeneration workflow to replace it.' }, { status: 409 });
    }

    const requestedVoice = typeof body.voice === 'string' ? body.voice.trim() : '';
    const voice = ALLOWED_VOICES.has(requestedVoice)
      ? requestedVoice
      : (current.spec?.voice || 'friendly_female');

    // Keep completed clips only when retrying with the same voice. This is the
    // durable checkpoint that lets long videos resume instead of starting over.
    const previousProgress = current.spec?.narration_progress;
    const canResume = retry && previousProgress?.voice_preset === voice &&
      Array.isArray(previousProgress.clips);
    const progress = canResume
      ? previousProgress
      : { voice_preset: voice, clips: [] };

    const nextSpec = {
      ...(current.spec || {}),
      voice,
      narration_progress: progress,
    };

    const { data: queuedJob, error: queueError } = await supabase
      .from('image_explainer_jobs')
      .update({
        spec: nextSpec,
        status: 'narrating',
        stage: 'narration_queued',
        stage_message: canResume && progress.clips.length
          ? `Narration queued to resume: ${progress.clips.filter(Boolean).length} scene clips already saved.`
          : 'Approved script queued for background narration. Scene clips will be generated and checkpointed in batches.',
        narration_manifest: null,
        error_message: null,
        attempt_count: 0,
        claim_token: null,
        worker_id: null,
        heartbeat_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select('id,title,status,stage,stage_message,spec')
      .single();

    if (queueError) throw new Error(queueError.message);
    return NextResponse.json({ job: queuedJob, queued: true }, { status: 202 });
  } catch (error) {
    console.error('[image-explainer-narration] queue failed', error);
    return NextResponse.json({
      error: error?.message || 'Could not queue narration.',
    }, { status: 500 });
  }
}
