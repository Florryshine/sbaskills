import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { buildExplainerTimeline, validateExplainerTimeline } from '@/lib/image-explainer/timeline.mjs';
import { reviewAssetCandidates, approvedAssetsFromBundle } from '@/lib/image-explainer/assets.mjs';

export const runtime = 'nodejs';

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('image_explainer_jobs')
    .select('id,title,status,stage,stage_message,vision_analysis,script,narration_manifest,research_bundle,timeline,timeline_reviewed_at,video_url,storage_path,error_message')
    .eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  const researchBundle = data.research_bundle ? { ...data.research_bundle, assets: (data.research_bundle.assets || []).map((asset, index) => ({ ...asset, id: asset.id || `research-asset-${index + 1}` })) } : null;\n  return NextResponse.json({ job: { ...data, research_bundle: researchBundle } });
}

export async function POST(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const supabase = createAdminClient();
  try {
    const body = await req.json();
    if (!body?.id || !['generate','approve','queue-render','retry-render','review-assets'].includes(body.action)) {
      return NextResponse.json({ error: 'Project id and a valid timeline action are required.' }, { status: 400 });
    }
    const { data: current, error: readError } = await supabase.from('image_explainer_jobs')
      .select('id,title,status,stage,source_images,vision_analysis,script,narration_manifest,research_bundle,timeline,video_url,storage_path,error_message')
      .eq('id', body.id).single();
    if (readError || !current) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    if (body.action === 'review-assets') {
      const researchBundle = reviewAssetCandidates(current.research_bundle || {}, body.updates || []);
      const { data: saved, error } = await supabase.from('image_explainer_jobs').update({ research_bundle: researchBundle, timeline: null, timeline_reviewed_at: null, stage: 'assets_reviewed', stage_message: 'Supporting media review saved. Regenerate the timeline to apply approved assets.', updated_at: new Date().toISOString() }).eq('id', body.id).select('id,title,status,stage,stage_message,research_bundle').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ job: saved });
    }

    if (body.action === 'queue-render' || body.action === 'retry-render') {
      const retry = body.action === 'retry-render';
      if (!current.timeline || current.timeline.review_status !== 'admin_reviewed' || !validateExplainerTimeline(current.timeline, current.script?.scenes?.length || 0)) return NextResponse.json({ error: 'Approve a valid visual timeline before rendering.' }, { status: 409 });
      if (!current.source_images?.[0]?.path || !current.narration_manifest?.clips?.length) return NextResponse.json({ error: 'The original image or narration audio is missing.' }, { status: 409 });
      if (retry && !(current.status === 'failed' && current.stage === 'render_failed')) return NextResponse.json({ error: 'Only a failed render can be retried.' }, { status: 409 });
      if (!retry && current.stage === 'render_queued') return NextResponse.json({ error: 'This project is already waiting in the render queue.' }, { status: 409 });
      const { data: queued, error } = await supabase.from('image_explainer_jobs')
        .update({ status: 'rendering', stage: 'render_queued', stage_message: 'Queued for the Remotion rendering worker. It runs automatically.', error_message: null, claim_token: null, worker_id: null, heartbeat_at: null, render_attempt_count: 0, updated_at: new Date().toISOString() })
        .eq('id', body.id).select('id,title,status,stage,stage_message,video_url,storage_path').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ job: queued });
    }

    if (body.action === 'generate') {
      if (!current.script || current.script.review_status !== 'admin_reviewed' || !current.vision_analysis?.reviewed_by_admin || !current.narration_manifest?.clips?.length) {
        return NextResponse.json({ error: 'Approve the image map and script, then generate all narration clips before building the visual timeline.' }, { status: 409 });
      }
      const timeline = buildExplainerTimeline({
        script: current.script,
        narrationManifest: current.narration_manifest,
        imageDimensions: current.vision_analysis.image_dimensions || current.vision_analysis,
        components: current.vision_analysis.components || [],
        approvedAssets: approvedAssetsFromBundle(current.research_bundle),
      });
      if (!validateExplainerTimeline(timeline, current.script.scenes.length)) throw new Error('Generated timeline failed structural validation.');
      const { data: saved, error } = await supabase.from('image_explainer_jobs')
        .update({ timeline, timeline_reviewed_at: null, status: 'analysed', stage: 'timeline_review', stage_message: 'Audio-aligned visual timeline generated. Review timing, camera moves, overlays and subtitles.', updated_at: new Date().toISOString() })
        .eq('id', body.id).select('id,title,status,stage,stage_message,timeline').single();
      if (error) throw new Error(error.message);
      return NextResponse.json({ job: saved });
    }

    if (!current.timeline || !validateExplainerTimeline(current.timeline, current.script?.scenes?.length || 0)) {
      return NextResponse.json({ error: 'Generate and validate a visual timeline before approving it.' }, { status: 409 });
    }
    const approved = { ...current.timeline, review_status: 'admin_reviewed', reviewed_at: new Date().toISOString() };
    const { data: saved, error } = await supabase.from('image_explainer_jobs')
      .update({ timeline: approved, timeline_reviewed_at: new Date().toISOString(), status: 'analysed', stage: 'timeline_approved', stage_message: 'Visual timeline approved and ready for the rendering phase.', updated_at: new Date().toISOString() })
      .eq('id', body.id).select('id,title,status,stage,stage_message,timeline,timeline_reviewed_at').single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ job: saved });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Timeline operation failed.' }, { status: 400 });
  }
}
