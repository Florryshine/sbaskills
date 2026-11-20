import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;

const ORIENTATIONS = new Set(['9:16', '16:9', '1:1']);
const JOB_TYPES = new Set(['script', 'narrate', 'render']);

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const supabase = createAdminClient();
    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');

    if (projectId) {
      const [{ data: project, error: projectError }, { data: jobs, error: jobsError }] = await Promise.all([
        supabase.from('cartoon_projects').select('*').eq('id', projectId).maybeSingle(),
        supabase.from('cartoon_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (projectError) return jsonError(projectError.message, 500);
      if (!project) return jsonError('Cartoon project not found.', 404);
      if (jobsError) return jsonError(jobsError.message, 500);
      return NextResponse.json({ project, jobs: jobs || [] });
    }

    const [{ data: projects, error }, { data: workers, error: workerError }] = await Promise.all([
      supabase.from('cartoon_projects').select('id,title,custom_topic,orientation,status,stage,stage_message,progress,error_message,video_url,duration_seconds,spec,narration,created_at,updated_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('cartoon_workers').select('worker_id,last_seen_at,current_job_id,info').order('last_seen_at', { ascending: false }).limit(10),
    ]);
    if (error) return jsonError(error.message, 500);
    if (workerError) return jsonError(workerError.message, 500);
    return NextResponse.json({ projects: (projects || []).map(({ spec, narration, ...project }) => ({
      ...project,
      has_spec: Boolean(spec),
      has_narration: Boolean(spec?.scenes?.length) && spec.scenes.every(scene =>
        Boolean(narration?.[scene.id]?.audioUrl && narration?.[scene.id]?.durationSeconds)
      ),
    })), workers: workers || [], userId: user.id });
  } catch (error) {
    console.error('[cartoon-studio] GET failed:', error);
    return jsonError(error.message || 'Could not load Cartoon Studio.', 500);
  }
}

export async function POST(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const action = body.action || 'create';

    if (action === 'create') {
      const title = String(body.title || body.topic || '').trim().slice(0, 180);
      const topic = String(body.topic || body.title || '').trim().slice(0, 180);
      const knowledgeAssetId = body.knowledgeAssetId || null;
      const orientation = ORIENTATIONS.has(body.orientation) ? body.orientation : '9:16';
      if (!topic && !knowledgeAssetId) return jsonError('Provide a topic or select a Knowledge Asset.');

      if (knowledgeAssetId) {
        const { data: asset, error: assetError } = await supabase
          .from('knowledge_assets').select('id').eq('id', knowledgeAssetId).maybeSingle();
        if (assetError) return jsonError(assetError.message, 500);
        if (!asset) return jsonError('The selected Knowledge Asset was not found.', 404);
      }

      const { data: project, error: projectError } = await supabase
        .from('cartoon_projects')
        .insert({
          title: title || topic || 'Untitled Cartoon',
          custom_topic: topic || null,
          knowledge_asset_id: knowledgeAssetId,
          orientation,
          subtitles: body.subtitles !== false,
          status: 'queued',
          stage: 'queued',
          stage_message: 'Waiting for a Cartoon worker...',
          created_by: user.id,
        })
        .select('*').single();
      if (projectError) return jsonError(projectError.message, 500);

      const { data: job, error: jobError } = await supabase
        .from('cartoon_jobs')
        .insert({
          project_id: project.id,
          job_type: 'script',
          status: 'queued',
          stage: 'queued',
          stage_message: 'Waiting for a Cartoon worker...',
          payload: { topic, subject: String(body.subject || 'General').slice(0, 80) },
          created_by: user.id,
        })
        .select('*').single();
      if (jobError) {
        await supabase.from('cartoon_projects').delete().eq('id', project.id);
        return jsonError(jobError.message, 500);
      }
      return NextResponse.json({ project, job }, { status: 201 });
    }

    if (action === 'enqueue') {
      const projectId = String(body.projectId || '');
      const jobType = String(body.jobType || '');
      if (!projectId || !JOB_TYPES.has(jobType)) return jsonError('A valid projectId and jobType are required.');
      const { data: project, error: projectError } = await supabase
        .from('cartoon_projects').select('id,status,spec,narration').eq('id', projectId).maybeSingle();
      if (projectError) return jsonError(projectError.message, 500);
      if (!project) return jsonError('Cartoon project not found.', 404);
      if (jobType === 'render' && !project.spec) return jsonError('Generate the storyboard before rendering.');
      if (jobType === 'render') {
        const narration = project.narration && typeof project.narration === 'object' ? project.narration : {};
        const complete = project.spec.scenes?.length && project.spec.scenes.every(scene =>
          narration[scene.id]?.audioUrl && narration[scene.id]?.durationSeconds
        );
        if (!complete) return jsonError('Complete narration for every scene before rendering. Queue narration first.');
      }
      if (jobType === 'narrate' && !project.spec) return jsonError('Generate the storyboard before narration.');

      const { data: active, error: activeError } = await supabase
        .from('cartoon_jobs').select('id,status').eq('project_id', projectId)
        .eq('job_type', jobType).in('status', ['queued', 'processing']).limit(1);
      if (activeError) return jsonError(activeError.message, 500);
      if (active?.length) return jsonError('A job of this type is already queued or processing.', 409);

      const { data: job, error: jobError } = await supabase.from('cartoon_jobs').insert({
        project_id: projectId, job_type: jobType, status: 'queued', stage: 'queued',
        stage_message: 'Waiting for a Cartoon worker...', created_by: user.id,
        payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
      }).select('*').single();
      if (jobError) return jsonError(jobError.message, 500);

      await supabase.from('cartoon_projects').update({
        status: jobType === 'narrate' ? 'narrating' : 'queued',
        stage: 'queued', stage_message: 'Waiting for a Cartoon worker...',
        error_message: null, updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      return NextResponse.json({ job }, { status: 202 });
    }

    return jsonError('Unsupported action.');
  } catch (error) {
    console.error('[cartoon-studio] POST failed:', error);
    return jsonError(error.message || 'Could not create Cartoon Studio job.', 500);
  }
}
