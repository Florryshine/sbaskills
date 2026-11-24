import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';
import { cleanImageRegion } from '@/lib/image-explainer/regions.mjs';
import { researchImageExplainer } from '@/lib/image-explainer/research.mjs';
import { generateExplainerPlan } from '@/lib/image-explainer/script.mjs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MIME_FORMATS = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };
const MODES = new Set(['educational', 'product_ad', 'product_demo', 'scientific', 'technical', 'documentary', 'general']);

function safeText(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}


function normalizeAnalysis(parsed, dimensions, provider) {
  const { width, height } = dimensions;
  const components = (Array.isArray(parsed.components) ? parsed.components : [])
    .slice(0, 100)
    .map((component, index) => {
      const region = cleanImageRegion(component?.region, width, height);
      if (!region) return null;
      return {
        id: safeText(component.id, 80) || `component-${index + 1}`,
        name: safeText(component.name, 120) || `Component ${index + 1}`,
        label_text: safeText(component.label_text, 160) || null,
        description: safeText(component.description, 500),
        function: safeText(component.function, 500),
        region,
        confidence: Math.max(0, Math.min(1, Number(component.confidence) || 0)),
        needs_verification: component.needs_verification !== false,
      };
    }).filter(Boolean);

  return {
    image_type: safeText(parsed.image_type, 60) || 'other',
    subject: safeText(parsed.subject, 180),
    summary: safeText(parsed.summary, 2000),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    components,
    detected_text: (Array.isArray(parsed.detected_text) ? parsed.detected_text : [])
      .slice(0, 200).map((item, index) => {
        const region = cleanImageRegion(item?.region, width, height);
        if (!region) return null;
        return {
          id: safeText(item.id, 80) || `text-${index + 1}`,
          text: safeText(item.text, 500),
          region,
          confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
        };
      }).filter((item) => item && item.text),
    spatial_relationships: Array.isArray(parsed.spatial_relationships)
      ? parsed.spatial_relationships.slice(0, 100).map((v) => safeText(String(v), 300)).filter(Boolean) : [],
    uncertainties: Array.isArray(parsed.uncertainties)
      ? parsed.uncertainties.slice(0, 50).map((v) => safeText(String(v), 300)).filter(Boolean) : [],
    image_dimensions: dimensions,
    provider,
    analysed_at: new Date().toISOString(),
  };
}

async function analyse(buffer, mimeType, dimensions) {
  const keys = [
    process.env.GEMINI_API_KEY_1, process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3, process.env.GEMINI_API_KEY,
  ].filter(Boolean);
  if (!keys.length) throw new Error('Image analysis is not configured. Add a Gemini API key to the app environment.');
  const prompt = `Inspect this uploaded image for an Image-to-Explainer video project.
Return strict JSON only:
{"image_type":"diagram|illustration|photograph|chart|technical_drawing|product|other","subject":"concise subject","summary":"what is visibly shown","confidence":0.0,"components":[{"name":"component name","label_text":"exact visible label or null","description":"visually grounded description","function":"only state a function if reliably known; otherwise say needs research","region":{"x":0,"y":0,"width":0,"height":0},"confidence":0.0,"needs_verification":true}],"detected_text":[{"text":"exact text visible in the image","region":{"x":0,"y":0,"width":0,"height":0},"confidence":0.0}],"spatial_relationships":["relationships visible in the image"],"uncertainties":["things that cannot be determined from pixels alone"]}
Original image dimensions: ${dimensions.width}x${dimensions.height} pixels. Coordinates are pixel coordinates relative to the original image, origin at top-left. Every region must be inside the image. Transcribe all legible visible text in detected_text with pixel bounding boxes (up to 200 blocks). Do not invent labels, functions, or regions. Distinguish visible observations from inferred function. Return at most 100 components.`;

  let lastError;
  for (const key of keys) {
    const client = new GoogleGenerativeAI(key);
    for (const modelName of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [
            { inlineData: { mimeType, data: buffer.toString('base64') } },
            { text: prompt },
          ] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: 4096 },
        });
        const parsed = JSON.parse(result.response.text().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim());
        return normalizeAnalysis(parsed, dimensions, `Gemini ${modelName}`);
      } catch (error) {
        lastError = error;
        if (/SAFETY|blocked/i.test(error?.message || '')) throw new Error('The vision provider declined this image. Try another image.');
      }
    }
  }
  throw new Error(lastError?.message || 'All configured vision models failed.');
}

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;

  let supabase;
  let jobId;
  let storagePath;
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Upload one image to analyse.' }, { status: 400 });
    }
    if (!Object.hasOwn(MIME_FORMATS, file.type)) {
      return NextResponse.json({ error: 'Supported formats: JPG, PNG and WEBP.' }, { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be between 1 byte and 10 MB.' }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
    if (metadata.format !== MIME_FORMATS[file.type]) {
      return NextResponse.json({ error: 'The file contents do not match the selected image format.' }, { status: 415 });
    }
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) {
      return NextResponse.json({ error: 'Image dimensions are invalid or exceed the 40-megapixel safety limit.' }, { status: 413 });
    }

    const modeValue = form.get('productionMode');
    const mode = MODES.has(modeValue) ? modeValue : 'educational';
    const instruction = safeText(form.get('instruction'), 2000);
    const title = safeText(form.get('title'), 160) || safeText(file.name, 160) || 'Image explainer project';
    const aspectValue = safeText(form.get('aspect'), 10);
    const aspect = ['16:9', '9:16', '1:1'].includes(aspectValue) ? aspectValue : '16:9';
    const durationValue = Number(form.get('duration') || 90);
    const targetSeconds = Number.isFinite(durationValue) ? Math.max(20, Math.min(900, durationValue)) : 90;
    const language = safeText(form.get('language'), 40) || 'English';

    supabase = createAdminClient();
    jobId = randomUUID();
    const ext = MIME_FORMATS[file.type] === 'jpeg' ? 'jpg' : MIME_FORMATS[file.type];
    storagePath = `${user.id}/${jobId}/source.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('image-explainer-sources')
      .upload(storagePath, buffer, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Source upload failed: ${uploadError.message}. Apply the image-explainer migration first.`);

    const sourceImage = {
      path: storagePath, name: safeText(file.name, 180) || `source.${ext}`,
      mimeType: file.type, width: metadata.width, height: metadata.height, size: file.size,
    };
    const { error: insertError } = await supabase.from('image_explainer_jobs').insert({
      id: jobId, created_by: user.id, title, status: 'analysing', stage: 'image_analysis',
      stage_message: 'Image securely uploaded. AI is identifying visible components.',
      production_mode: mode, user_instruction: instruction,
      spec: { aspect, targetSeconds, language },
      source_images: [sourceImage],
    });
    if (insertError) {
      await supabase.storage.from('image-explainer-sources').remove([storagePath]);
      storagePath = null;
      throw new Error(insertError.message);
    }

    const analysis = await analyse(buffer, file.type, { width: metadata.width, height: metadata.height });
    const { data: job, error: updateError } = await supabase.from('image_explainer_jobs')
      .update({
        status: 'analysed', stage: 'image_analysis_complete',
        stage_message: `Detected ${analysis.components.length} image components. Review and correct the regions.`,
        vision_analysis: analysis, error_message: null, updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select('id,title,status,stage,stage_message,production_mode,spec,source_images,vision_analysis,created_at')
      .single();
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    console.error('[image-explainer] upload/analysis failed', error);
    if (supabase && jobId) {
      await supabase.from('image_explainer_jobs').update({
        status: 'failed', stage: 'image_analysis_failed',
        stage_message: 'Image analysis failed. The saved source can be retried.',
        error_message: safeText(error?.message || 'Image analysis failed.', 1000),
        updated_at: new Date().toISOString(),
      }).eq('id', jobId);
    } else if (supabase && storagePath) {
      await supabase.storage.from('image-explainer-sources').remove([storagePath]);
    }
    return NextResponse.json({
      error: error?.message || 'Image analysis failed.',
      jobId: jobId || null,
    }, { status: 500 });
  }
}

export async function PATCH(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  try {
    const body = await req.json();
    if (!body?.id) return NextResponse.json({ error: 'Provide a project id.' }, { status: 400 });
    const supabase = createAdminClient();
    const { data: current, error: readError } = await supabase.from('image_explainer_jobs')
      .select('id,title,status,vision_analysis,source_images,user_instruction,production_mode,spec,research_bundle,script,storyboard,narration_manifest').eq('id', body.id).single();
    if (readError || !current) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });

    if (body.action === 'research') {
      if (!current.vision_analysis?.subject) {
        return NextResponse.json({ error: 'Complete image analysis before starting research.' }, { status: 409 });
      }
      const { error: stageError } = await supabase.from('image_explainer_jobs')
        .update({
          status: 'researching', stage: 'research_discovery',
          stage_message: 'Searching reference sources, scholarly metadata and supporting media.',
          error_message: null, updated_at: new Date().toISOString(),
        }).eq('id', body.id);
      if (stageError) throw new Error(stageError.message);
      try {
        const bundle = await researchImageExplainer({
          analysis: current.vision_analysis,
          instruction: current.user_instruction || '',
        });
        const { data: researchedJob, error: saveError } = await supabase.from('image_explainer_jobs')
          .update({
            status: 'analysed', stage: 'research_complete',
            stage_message: `Research complete: ${bundle.sources.length} reference sources and ${bundle.assets.length} media candidates found. Review before use.`,
            research_bundle: bundle, error_message: null, updated_at: new Date().toISOString(),
          })
          .eq('id', body.id)
          .select('id,title,status,stage,stage_message,research_bundle')
          .single();
        if (saveError) throw new Error(saveError.message);
        return NextResponse.json({ job: researchedJob });
      } catch (researchError) {
        await supabase.from('image_explainer_jobs').update({
          status: 'analysed', stage: 'research_failed',
          stage_message: 'Research did not finish. Your image analysis is preserved; you can retry.',
          error_message: safeText(researchError?.message || 'Research failed.', 1000),
          updated_at: new Date().toISOString(),
        }).eq('id', body.id);
        throw researchError;
      }
    }

    if (body.action === 'generate-script') {
      if (!current.vision_analysis?.subject) {
        return NextResponse.json({ error: 'Complete image analysis before generating a script.' }, { status: 409 });
      }
      if (!current.vision_analysis?.reviewed_by_admin) {
        return NextResponse.json({ error: 'Review and save the image regions before generating the script.' }, { status: 409 });
      }
      if (!current.research_bundle) {
        return NextResponse.json({ error: 'Run research and asset discovery before generating the script.' }, { status: 409 });
      }
      const { error: stageError } = await supabase.from('image_explainer_jobs')
        .update({
          status: 'scripting', stage: 'script_storyboard_generation',
          stage_message: 'Writing narration and directing the visual storyboard.',
          error_message: null, updated_at: new Date().toISOString(),
        }).eq('id', body.id);
      if (stageError) throw new Error(stageError.message);
      try {
        const generated = await generateExplainerPlan({
          job: current,
          analysis: current.vision_analysis,
          research: current.research_bundle,
          instruction: current.user_instruction || '',
        });
        const validComponentIds = new Set((current.vision_analysis.components || []).map((item) => item.id));
        for (const scene of generated.plan.scenes) {
          scene.visual.component_ids = scene.visual.component_ids.filter((id) => validComponentIds.has(id));
        }
        const { data: plannedJob, error: saveError } = await supabase.from('image_explainer_jobs')
          .update({
            status: 'analysed', stage: 'script_storyboard_ready',
            stage_message: `Draft script and storyboard ready: ${generated.plan.scenes.length} directed scenes. Human review required.`,
            script: generated.plan, storyboard: generated.plan.scenes,
            error_message: null, updated_at: new Date().toISOString(),
          })
          .eq('id', body.id)
          .select('id,title,status,stage,stage_message,script,storyboard')
          .single();
        if (saveError) throw new Error(saveError.message);
        return NextResponse.json({ job: { ...plannedJob, script_provider: generated.provider } });
      } catch (generationError) {
        await supabase.from('image_explainer_jobs').update({
          status: 'analysed', stage: 'script_generation_failed',
          stage_message: 'Script generation failed. Your image analysis and research are preserved; retry when ready.',
          error_message: safeText(generationError?.message || 'Script generation failed.', 1000),
          updated_at: new Date().toISOString(),
        }).eq('id', body.id);
        throw generationError;
      }
    }

    if (body.action === 'save-script') {
      if (!current.vision_analysis?.reviewed_by_admin || !current.research_bundle) {
        return NextResponse.json({ error: 'The reviewed image map and research bundle are required.' }, { status: 409 });
      }
      const { normalizeExplainerPlan } = await import('@/lib/image-explainer/script.mjs');
      const targetSeconds = Math.max(20, Math.min(900, Number(current.spec?.targetSeconds) || 90));
      const plan = normalizeExplainerPlan(body.script, { targetSeconds, aspect: current.spec?.aspect || '16:9' });
      const componentIds = new Set((current.vision_analysis.components || []).map((item) => item.id));
      for (const scene of plan.scenes) {
        scene.visual.component_ids = scene.visual.component_ids.filter((id) => componentIds.has(id));
      }
      const { data: savedJob, error: saveError } = await supabase.from('image_explainer_jobs')
        .update({
          script: { ...plan, review_status: 'admin_reviewed', reviewed_at: new Date().toISOString() },
          storyboard: plan.scenes,
          status: 'analysed', stage: 'script_storyboard_reviewed',
          stage_message: 'Script and storyboard saved after administrator review.',
          error_message: null, updated_at: new Date().toISOString(),
        }).eq('id', body.id)
        .select('id,title,status,stage,stage_message,script,storyboard').single();
      if (saveError) throw new Error(saveError.message);
      return NextResponse.json({ job: savedJob });
    }

    if (body.action === 'queue-narration' || body.action === 'retry-narration') {
      const isRetry = body.action === 'retry-narration';
      if (!current.script || current.script.review_status !== 'admin_reviewed' || !Array.isArray(current.script.scenes) || !current.script.scenes.length) {
        return NextResponse.json({ error: 'Save an administrator-approved script and storyboard before generating narration.' }, { status: 409 });
      }
      if (isRetry && current.status !== 'failed') {
        return NextResponse.json({ error: 'Only failed narration jobs can be retried.' }, { status: 409 });
      }
      if (!isRetry && current.status !== 'analysed') {
        return NextResponse.json({ error: 'Only a reviewed project that is not already processing narration can be queued.' }, { status: 409 });
      }
      if (!isRetry && current.narration_manifest) {
        return NextResponse.json({ error: 'Narration already exists. Use regenerate narration if you want to replace it.' }, { status: 409 });
      }
      const requestedVoice = safeText(body.voice, 80);
      const allowedVoices = new Set(['warm_male','bright_female','calm_male','friendly_female','nigerian_male','uk_male']);
      const voice = allowedVoices.has(requestedVoice) ? requestedVoice : (current.spec?.voice || 'friendly_female');
      const nextSpec = { ...(current.spec || {}), voice };
      const { data: queuedJob, error: queueError } = await supabase.from('image_explainer_jobs')
        .update({
          spec: nextSpec,
          status: 'narrating',
          stage: 'narration_queued',
          stage_message: 'Approved script queued for background narration. The worker checks the queue automatically.',
          narration_manifest: null,
          error_message: null,
          attempt_count: 0,
          claim_token: null, worker_id: null, heartbeat_at: null,
          updated_at: new Date().toISOString(),
        }).eq('id', body.id)
        .select('id,title,status,stage,stage_message,spec')
        .single();
      if (queueError) throw new Error(queueError.message);
      return NextResponse.json({ job: queuedJob, queued: true });
    }

    if (body.action === 'retry-analysis') {
      if (current.status !== 'failed' || current.vision_analysis) {
        return NextResponse.json({ error: 'Only failed projects without a completed image analysis can be retried.' }, { status: 409 });
      }
      const source = current.source_images?.[0];
      if (!source?.path || !source?.mimeType || !source?.width || !source?.height) {
        return NextResponse.json({ error: 'The saved source image metadata is incomplete.' }, { status: 409 });
      }
      const { data: downloaded, error: downloadError } = await supabase.storage
        .from('image-explainer-sources').download(source.path);
      if (downloadError || !downloaded) throw new Error(downloadError?.message || 'Could not retrieve the saved source image.');
      const buffer = Buffer.from(await downloaded.arrayBuffer());
      const analysis = await analyse(buffer, source.mimeType, { width: source.width, height: source.height });
      const { data: retriedJob, error: retryError } = await supabase.from('image_explainer_jobs')
        .update({
          status: 'analysed', stage: 'image_analysis_complete',
          stage_message: `Analysis retry complete. Detected ${analysis.components.length} image components.`,
          vision_analysis: analysis, error_message: null, updated_at: new Date().toISOString(),
        })
        .eq('id', body.id)
        .select('id,title,status,stage,stage_message,production_mode,spec,source_images,vision_analysis,created_at')
        .single();
      if (retryError) throw new Error(retryError.message);
      return NextResponse.json({ job: retriedJob });
    }

    if (!Array.isArray(body.components) || body.components.length > 100) {
      return NextResponse.json({ error: 'Provide no more than 100 components.' }, { status: 400 });
    }
    if (!['analysed', 'failed'].includes(current.status) || !current.vision_analysis) {
      return NextResponse.json({ error: 'Only analysed projects can have their detected regions edited.' }, { status: 409 });
    }
    const dimensions = current.vision_analysis.image_dimensions || current.source_images?.[0];
    const width = Number(dimensions?.width), height = Number(dimensions?.height);
    if (!width || !height) return NextResponse.json({ error: 'Source image dimensions are missing.' }, { status: 409 });

    const components = body.components.map((component, index) => {
      const region = cleanImageRegion(component?.region, width, height);
      if (!region) throw new Error(`Component ${index + 1} has an invalid or empty region.`);
      return {
        id: safeText(component.id, 80) || `component-${index + 1}`,
        name: safeText(component.name, 120) || `Component ${index + 1}`,
        label_text: safeText(component.label_text, 160) || null,
        description: safeText(component.description, 500),
        function: safeText(component.function, 500),
        region,
        confidence: Math.max(0, Math.min(1, Number(component.confidence) || 0)),
        needs_verification: Boolean(component.needs_verification),
      };
    });
    const visionAnalysis = {
      ...current.vision_analysis,
      components,
      reviewed_at: new Date().toISOString(),
      reviewed_by_admin: true,
    };
    const { data: job, error: updateError } = await supabase.from('image_explainer_jobs')
      .update({
        vision_analysis: visionAnalysis,
        stage_message: 'Detected components and image regions reviewed by an administrator.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.id)
      .select('id,title,status,stage,stage_message,vision_analysis')
      .single();
    if (updateError) throw new Error(updateError.message);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not save image regions.' }, { status: 400 });
  }
}

export async function GET(req) {
  const { response } = await requireAdminApi();
  if (response) return response;
  const supabase = createAdminClient();
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const { data: job, error } = await supabase.from('image_explainer_jobs')
      .select('id,title,status,stage,stage_message,production_mode,spec,source_images,vision_analysis,research_bundle,script,storyboard,narration_manifest,error_message,created_at')
      .eq('id', id).single();
    if (error || !job) return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    const sourcePath = job.source_images?.[0]?.path;
    let sourceUrl = null;
    if (sourcePath) {
      const { data: signed, error: signedError } = await supabase.storage
        .from('image-explainer-sources').createSignedUrl(sourcePath, 15 * 60);
      if (!signedError) sourceUrl = signed?.signedUrl || null;
    }
    const narrationAudioUrls = {};
    for (const clip of job.narration_manifest?.clips || []) {
      if (!clip.storage_path) continue;
      const { data: signedAudio } = await supabase.storage.from('image-explainer-audio')
        .createSignedUrl(clip.storage_path, 15 * 60);
      if (signedAudio?.signedUrl) narrationAudioUrls[clip.scene_index] = signedAudio.signedUrl;
    }
    return NextResponse.json({ job, sourceUrl, narrationAudioUrls });
  }
  const { data, error } = await supabase.from('image_explainer_jobs')
    .select('id,title,status,stage,stage_message,production_mode,video_url,error_message,created_at,vision_analysis,research_bundle,script,storyboard,narration_manifest')
    .order('created_at', { ascending: false }).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data || [] });
}
