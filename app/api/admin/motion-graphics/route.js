import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ORIENTATIONS = new Set(['9:16', '16:9', '1:1']);
const INTENSITIES = new Set(['calm', 'balanced', 'bold']);
const JOB_TYPES = new Set(['direction', 'render']);
const ACTIVE_STATUSES = new Set(['queued', 'directing', 'rendering']);

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
        supabase.from('motion_projects').select('*').eq('id', projectId).maybeSingle(),
        supabase.from('motion_jobs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
      ]);
      if (projectError) return jsonError(projectError.message, 500);
      if (!project) return jsonError('Motion Graphics project not found.', 404);
      if (jobsError) return jsonError(jobsError.message, 500);
      return NextResponse.json({ project, jobs: jobs || [] });
    }

    const [{ data: projects, error }, { data: workers, error: workerError }] = await Promise.all([
      supabase.from('motion_projects')
        .select('id,title,custom_topic,orientation,visual_intensity,music_style,narration_mode,use_sfx,subtitles,status,stage,stage_message,progress,error_message,video_url,video_size_bytes,duration_seconds,direction,created_at,updated_at')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('motion_workers').select('worker_id,last_seen_at,current_job_id,info').order('last_seen_at', { ascending: false }).limit(10),
    ]);
    if (error) return jsonError(error.message, 500);
    if (workerError) return jsonError(workerError.message, 500);
    return NextResponse.json({
      projects: (projects || []).map(({ direction, ...project }) => ({
        ...project,
        has_direction: Boolean(direction?.direction),
        direction_label: direction?.direction?.label || null,
        domain: direction?.analysis?.domain || null,
      })),
      workers: workers || [],
      userId: user.id,
    });
  } catch (error) {
    console.error('[motion-graphics] GET failed:', error);
    return jsonError(error.message || 'Could not load Motion Graphics Studio.', 500);
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
      const script = String(body.script || '').trim().slice(0, 12000);
      const topic = String(body.topic || body.title || '').trim().slice(0, 180);
      const knowledgeAssetId = body.knowledgeAssetId || null;
      const orientation = ORIENTATIONS.has(body.orientation) ? body.orientation : '9:16';
      const intensity = INTENSITIES.has(body.visualIntensity) ? body.visualIntensity : 'balanced';
      const musicStyle = ['pulse', 'tech', 'cinematic', 'epic', 'chill', 'dark', 'bright'].includes(body.musicStyle)
        ? body.musicStyle : null;
      const narrationMode = ['tts', 'uploaded', 'silent'].includes(body.narrationMode) ? body.narrationMode : 'tts';
      const narrationUrl = String(body.narrationUrl || '').trim().slice(0, 2000) || null;
      if (!topic && !knowledgeAssetId && !script) {
        return jsonError('Provide a topic, a script, or select a Knowledge Asset.');
      }
      if (narrationMode === 'uploaded' && !narrationUrl) {
        return jsonError('Uploaded narration mode needs a narration audio URL.');
      }

      if (knowledgeAssetId) {
        const { data: asset, error: assetError } = await supabase
          .from('knowledge_assets').select('id').eq('id', knowledgeAssetId).maybeSingle();
        if (assetError) return jsonError(assetError.message, 500);
        if (!asset) return jsonError('The selected Knowledge Asset was not found.', 404);
      }

      const source = script ? 'script' : knowledgeAssetId ? 'asset' : 'topic';
      const { data: project, error: projectError } = await supabase
        .from('motion_projects')
        .insert({
          title: (topic || script.split(/(?<=[.!?])\s/)[0] || 'Motion Graphics Video').slice(0, 180),
          custom_topic: topic || null,
          knowledge_asset_id: knowledgeAssetId,
          script_text: script || null,
          source,
          orientation,
          fps: 30,
          visual_intensity: intensity,
          music_style: musicStyle,
          narration_mode: narrationMode,
          narration_url: narrationUrl,
          use_sfx: body.useSfx !== false,
          subtitles: body.subtitles !== false,
          brand_line: String(body.brandLine || 'Shiney Brain Academy').slice(0, 120),
          status: 'queued',
          stage: 'queued',
          stage_message: 'Waiting for a Motion Graphics worker...',
          created_by: user.id,
        })
        .select('*').single();
      if (projectError) return jsonError(projectError.message, 500);

      const { data: job, error: jobError } = await supabase
        .from('motion_jobs')
        .insert({
          project_id: project.id,
          job_type: 'direction',
          status: 'queued',
          stage: 'queued',
          stage_message: 'Waiting for a Motion Graphics worker...',
          payload: { subject: String(body.subject || 'General').slice(0, 80) },
          created_by: user.id,
        })
        .select('*').single();
      if (jobError) {
        await supabase.from('motion_projects').delete().eq('id', project.id);
        return jsonError(jobError.message, 500);
      }
      return NextResponse.json({ project, job }, { status: 201 });
    }

    if (action === 'enqueue') {
      const projectId = String(body.projectId || '');
      const jobType = String(body.jobType || '');
      if (!projectId || !JOB_TYPES.has(jobType)) return jsonError('A valid projectId and jobType are required.');
      const { data: project, error: projectError } = await supabase
        .from('motion_projects').select('id,status,direction,scenes').eq('id', projectId).maybeSingle();
      if (projectError) return jsonError(projectError.message, 500);
      if (!project) return jsonError('Motion Graphics project not found.', 404);
      if (jobType === 'render' && (!project.direction || !project.scenes?.length)) {
        return jsonError('Generate the creative direction before rendering.');
      }

      const { data: active, error: activeError } = await supabase
        .from('motion_jobs').select('id,status').eq('project_id', projectId)
        .eq('job_type', jobType).in('status', ['queued', 'processing']).limit(1);
      if (activeError) return jsonError(activeError.message, 500);
      if (active?.length) return jsonError('A job of this type is already queued or processing.', 409);

      const { data: job, error: jobError } = await supabase.from('motion_jobs').insert({
        project_id: projectId, job_type: jobType, status: 'queued', stage: 'queued',
        stage_message: 'Waiting for a Motion Graphics worker...', created_by: user.id,
        payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
      }).select('*').single();
      if (jobError) return jsonError(jobError.message, 500);

      await supabase.from('motion_projects').update({
        status: 'queued',
        stage: 'queued',
        stage_message: 'Waiting for a Motion Graphics worker...',
        progress: 0,
        error_message: null,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      return NextResponse.json({ job }, { status: 202 });
    }

    return jsonError('Unsupported action.');
  } catch (error) {
    console.error('[motion-graphics] POST failed:', error);
    return jsonError(error.message || 'Could not create the Motion Graphics job.', 500);
  }
}

// Edit scene text, regenerate a single scene's composition, or update settings.
export async function PATCH(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  try {
    const body = await request.json();
    const supabase = createAdminClient();
    const projectId = String(body.projectId || '');
    if (!projectId) return jsonError('projectId is required.');
    const { data: project, error: projectError } = await supabase
      .from('motion_projects').select('*').eq('id', projectId).maybeSingle();
    if (projectError) return jsonError(projectError.message, 500);
    if (!project) return jsonError('Motion Graphics project not found.', 404);
    if (ACTIVE_STATUSES.has(project.status)) {
      return jsonError('The project is currently being processed. Wait for the worker to finish.', 409);
    }

    const action = body.action || 'update';

    if (action === 'regen-scene') {
      const sceneId = String(body.sceneId || '');
      const scenes = Array.isArray(project.scenes) ? [...project.scenes] : null;
      const direction = project.direction?.direction;
      if (!scenes || !direction) return jsonError('Generate the creative direction first.');
      const index = scenes.findIndex((s) => s.id === sceneId);
      if (index === -1) return jsonError('Scene not found.', 404);
      if (!project.direction?.seed) return jsonError('Direction seed missing; regenerate the direction.');

      // Deterministic single-scene re-plan with a fresh variation seed.
      const { analyzeScript } = await import('@/lib/motion/script-analyzer.js');
      const { planScenes } = await import('@/lib/motion/scene-planner.js');
      const analyzed = analyzeScript(scenes[index].narration, {
        seed: (project.direction.seed + (sceneId.charCodeAt(0) || 7) * 31 + Number(body.bump || 1) * 7919) >>> 0,
        maxScenes: 1,
      });
      const single = analyzed.scenes[0];
      single.index = scenes[index].index;
      single.id = sceneId;
      const replanned = planScenes({
        scenes: [single],
        direction,
        seed: (project.direction.seed + (Number(body.bump || 1) + index) * 2654435761) >>> 0,
        narrationDurations: { [sceneId]: scenes[index].durationSeconds },
      });
      const next = {
        ...replanned[0],
        id: sceneId,
        index: scenes[index].index,
        heading: scenes[index].heading,
        narration: scenes[index].narration,
        durationSeconds: scenes[index].durationSeconds,
      };
      scenes[index] = next;
      const { error: saveError } = await supabase.from('motion_projects').update({
        scenes, updated_at: new Date().toISOString(),
      }).eq('id', projectId);
      if (saveError) return jsonError(saveError.message, 500);
      return NextResponse.json({ scene: next });
    }

    if (action === 'update') {
      const updates = {};
      if (Array.isArray(body.scenes)) {
        const oldById = new Map((project.scenes || []).map((s) => [s.id, s]));
        updates.scenes = body.scenes.map((scene, i) => {
          const safe = scene && typeof scene === 'object' ? scene : {};
          const id = String(safe.id || `s${i + 1}`);
          const old = oldById.get(id) || {};
          const narration = String(safe.narration ?? old.narration ?? '').slice(0, 500);
          const heading = String(safe.heading ?? old.heading ?? narration.slice(0, 40)).slice(0, 60);
          const changed = old.narration !== narration;
          return {
            ...old, ...safe,
            id,
            narration,
            heading: heading || narration.slice(0, 40).toUpperCase(),
            durationSeconds: changed || !old.durationSeconds
              ? Number((narration.split(/\s+/).filter(Boolean).length / 2.6 + 1.1).toFixed(3))
              : old.durationSeconds,
          };
        });
      }
      if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim().slice(0, 180);
      if (body.musicStyle !== undefined) {
        updates.music_style = ['pulse', 'tech', 'cinematic', 'epic', 'chill', 'dark', 'bright'].includes(body.musicStyle) ? body.musicStyle : null;
        if (project.audio_meta?.music) {
          const audioMeta = { ...(project.audio_meta || {}) };
          delete audioMeta.music;
          updates.audio_meta = audioMeta;
        }
      }
      if (body.useSfx !== undefined) {
        updates.use_sfx = Boolean(body.useSfx);
        if (!updates.useSfx && project.audio_meta?.sfx) {
          const audioMeta = { ...(project.audio_meta || {}) };
          delete audioMeta.sfx;
          updates.audio_meta = audioMeta;
        }
      }
      if (body.subtitles !== undefined) updates.subtitles = Boolean(body.subtitles);
      if (body.visualIntensity && INTENSITIES.has(body.visualIntensity)) updates.visual_intensity = body.visualIntensity;
      if (body.orientation && ORIENTATIONS.has(body.orientation)) updates.orientation = body.orientation;
      if (body.narrationUrl !== undefined) updates.narration_url = String(body.narrationUrl || '').trim().slice(0, 2000) || null;
      if (!Object.keys(updates).length) return jsonError('Nothing to update.');
      updates.updated_at = new Date().toISOString();

      const { data: updated, error: updateError } = await supabase
        .from('motion_projects').update(updates).eq('id', projectId).select('*').single();
      if (updateError) return jsonError(updateError.message, 500);
      return NextResponse.json({ project: updated });
    }

    return jsonError('Unsupported action.');
  } catch (error) {
    console.error('[motion-graphics] PATCH failed:', error);
    return jsonError(error.message || 'Could not update the project.', 500);
  }
}

export async function DELETE(request) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  try {
    const url = new URL(request.url);
    const projectId = url.searchParams.get('id');
    if (!projectId) return jsonError('id query parameter is required.');
    const supabase = createAdminClient();
    const { error } = await supabase.from('motion_projects').delete().eq('id', projectId);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[motion-graphics] DELETE failed:', error);
    return jsonError(error.message || 'Could not delete the project.', 500);
  }
}
