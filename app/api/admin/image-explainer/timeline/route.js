import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { buildExplainerTimeline, validateExplainerTimeline } from '@/lib/image-explainer/timeline.mjs';

export const runtime = 'nodejs';

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Project id is required.' }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('image_explainer_jobs')
    .select('id,title,status,stage,stage_message,vision_analysis,script,narration_manifest,timeline,timeline_reviewed_at')
    .eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
  return NextResponse.json({ job: data });
}

export async function POST(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const supabase = createAdminClient();
  try {
    const body = await req.json();
    if (!body?.id || !['generate','approve'].includes(body.action)) {
      return NextResponse.json({ error: 'Project id and a valid timeline action are required.' }, { status: 400 });
    }
    const { data: current, error: readError } = await supabase.from('image_explainer_jobs')
      .select('id,status,vision_analysis,script,narration_manifest,timeline')
      .eq('id', body.id).single();
    if (readError || !current) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    if (body.action === 'generate') {
      if (!current.script || current.script.review_status !== 'admin_reviewed' || !current.vision_analysis?.reviewed_by_admin || !current.narration_manifest?.clips?.length) {
        return NextResponse.json({ error: 'Approve the image map and script, then generate all narration clips before building the visual timeline.' }, { status: 409 });
      }
      const timeline = buildExplainerTimeline({
        script: current.script,
        narrationManifest: current.narration_manifest,
        imageDimensions: current.vision_analysis.image_dimensions || current.vision_analysis,
        components: current.vision_analysis.components || [],
        approvedAssets: body.approvedAssets || [],
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
