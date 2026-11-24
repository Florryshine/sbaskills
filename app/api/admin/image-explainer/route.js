import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAdminApi } from '@/lib/require-admin-api';
import { createAdminClient } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MODES = new Set(['educational','product_ad','product_demo','scientific','technical','documentary','general']);

function cleanRegion(region, width, height) {
  if (!region || typeof region !== 'object') return null;
  const x = Math.max(0, Math.min(width, Number(region.x) || 0));
  const y = Math.max(0, Math.min(height, Number(region.y) || 0));
  const right = Math.max(x, Math.min(width, Number(region.x) + Number(region.width)));
  const bottom = Math.max(y, Math.min(height, Number(region.y) + Number(region.height)));
  if (right - x < 2 || bottom - y < 2) return null;
  return { x, y, width: right - x, height: bottom - y,
    normalized: { x: x / width, y: y / height, width: (right-x)/width, height: (bottom-y)/height } };
}

async function analyse(buffer, mimeType, dimensions) {
  const keys = [process.env.GEMINI_API_KEY_1,process.env.GEMINI_API_KEY_2,process.env.GEMINI_API_KEY].filter(Boolean);
  if (!keys.length) throw new Error('Image analysis is not configured: add GEMINI_API_KEY to the worker/app environment.');
  const prompt = `Inspect this uploaded image for an Image-to-Explainer video project.
Return strict JSON only with this schema:
{"image_type":"diagram|illustration|photograph|chart|technical_drawing|product|other","subject":"concise subject","summary":"what is visibly shown","confidence":0.0,"components":[{"name":"component name","label_text":"exact visible label or null","description":"visually grounded description","function":"function only when reliably known; otherwise say needs research","region":{"x":0,"y":0,"width":0,"height":0},"confidence":0.0,"needs_verification":false}],"spatial_relationships":[],"uncertainties":[]}
Original image dimensions: ${dimensions.width}x${dimensions.height} pixels. Coordinates must be pixel coordinates relative to this original image, origin at top-left. Do not invent labels or claim a region if uncertain. Keep each region inside the image. Return an empty components array if no components can be reliably located.`;
  let lastError;
  for (const key of keys) {
    const client = new GoogleGenerativeAI(key);
    for (const modelName of ['gemini-2.5-flash','gemini-2.0-flash']) {
      try {
        const model = client.getGenerativeModel({model:modelName});
        const result = await model.generateContent({
          contents:[{role:'user',parts:[{inlineData:{mimeType,data:buffer.toString('base64')}},{text:prompt}]}],
          generationConfig:{responseMimeType:'application/json',temperature:0.15,maxOutputTokens:4096}
        });
        const parsed = JSON.parse(result.response.text().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim());
        const width=dimensions.width, height=dimensions.height;
        const components=(Array.isArray(parsed.components)?parsed.components:[]).map(c=>({
          ...c, region:cleanRegion(c.region,width,height),
          confidence:Math.max(0,Math.min(1,Number(c.confidence)||0))
        })).filter(c=>c.region);
        return {...parsed,components, image_dimensions:dimensions, provider:`Gemini ${modelName}`};
      } catch(e) { lastError=e; }
    }
  }
  throw new Error(lastError?.message || 'All configured vision models failed.');
}

export async function POST(req) {
  const { user, response } = await requireAdminApi();
  if (response) return response;
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({error:'Upload one image to analyse.'},{status:400});
    if (!MIME.has(file.type)) return NextResponse.json({error:'Supported formats: JPG, PNG and WEBP.'},{status:415});
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({error:'Image must be between 1 byte and 10 MB.'},{status:413});
    const mode = MODES.has(form.get('productionMode')) ? form.get('productionMode') : 'educational';
    const instruction = String(form.get('instruction') || '').slice(0,2000);
    const title = String(form.get('title') || file.name || 'Image explainer project').slice(0,160);
    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) return NextResponse.json({error:'Could not read image dimensions.'},{status:400});
    const supabase = createAdminClient();
    const id = crypto.randomUUID();
    const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const storagePath = `${user.id}/${id}/source.${ext}`;
    const {error:uploadError}=await supabase.storage.from('image-explainer-sources').upload(storagePath,buffer,{contentType:file.type,upsert:false});
    if (uploadError) throw new Error(`Source upload failed: ${uploadError.message}. Apply the image explainer migration first.`);
    const analysis = await analyse(buffer,file.type,{width:metadata.width,height:metadata.height});
    const {data:job,error:insertError}=await supabase.from('image_explainer_jobs').insert({
      id,created_by:user.id,title,status:'analysed',stage:'image_analysis_complete',
      stage_message:'Image analysed. Review detected components before continuing.',
      production_mode:mode,user_instruction:instruction,
      spec:{aspect:String(form.get('aspect')||'16:9'),targetSeconds:Number(form.get('duration')||90),language:String(form.get('language')||'English')},
      source_images:[{path:storagePath,name:file.name,mimeType:file.type,width:metadata.width,height:metadata.height,size:file.size}],
      vision_analysis:analysis
    }).select('id,title,status,stage,stage_message,production_mode,source_images,vision_analysis,created_at').single();
    if (insertError) {
      await supabase.storage.from('image-explainer-sources').remove([storagePath]);
      throw new Error(insertError.message);
    }
    return NextResponse.json({job},{status:201});
  } catch(error) {
    console.error('[image-explainer] analysis failed',error);
    return NextResponse.json({error:error.message||'Image analysis failed.'},{status:500});
  }
}

export async function GET() {
  const { response } = await requireAdminApi();
  if (response) return response;
  const supabase=createAdminClient();
  const {data,error}=await supabase.from('image_explainer_jobs')
    .select('id,title,status,stage,stage_message,production_mode,video_url,error_message,created_at,vision_analysis')
    .order('created_at',{ascending:false}).limit(25);
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({jobs:data||[]});
}
