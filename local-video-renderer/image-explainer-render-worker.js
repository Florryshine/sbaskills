#!/usr/bin/env bun
// Phase 6 durable Remotion renderer. All heavy work runs on GitHub Actions, never in a Vercel request.
import 'dotenv/config';
import {createClient} from '@supabase/supabase-js';
import {bundle} from '@remotion/bundler';
import {renderMedia,selectComposition} from '@remotion/renderer';
import {readFile,writeFile,mkdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hostname} from 'node:os';
import {randomUUID} from 'node:crypto';
import {validateExplainerTimeline} from '../lib/image-explainer/timeline.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL||process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Supabase URL and service-role key are required.');
const supabase=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const workerId=`${hostname()}-image-explainer-render-${process.pid}-${randomUUID().slice(0,8)}`;
const maxMs=Number(process.env.IMAGE_EXPLAINER_RENDER_MAX_MS||40*60*1000);
const fps=30;

async function update(job,patch){
 const {data,error}=await supabase.from('image_explainer_jobs').update({...patch,heartbeat_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',job.id).eq('claim_token',job.claim_token).select('id').maybeSingle();
 if(error) throw new Error('Render job update failed: '+error.message);
 if(!data) throw new Error('Render lease was lost.');
}
async function download(bucket,storagePath,destination){
 const {data,error}=await supabase.storage.from(bucket).download(storagePath);
 if(error||!data) throw new Error(`Could not download ${bucket}/${storagePath}: ${error?.message||'empty file'}`);
 const bytes=Buffer.from(await data.arrayBuffer());
 if(!bytes.length) throw new Error(`Downloaded asset is empty: ${storagePath}`);
 await mkdir(path.dirname(destination),{recursive:true}); await writeFile(destination,bytes);
 return bytes.length;
}
async function process(job){
 let leaseLost=false;
 const heartbeatTimer=setInterval(()=>{supabase.from('image_explainer_jobs').update({heartbeat_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',job.id).eq('claim_token',job.claim_token).select('id').maybeSingle().then(({data,error})=>{if(error||!data)leaseLost=true;}).catch(()=>{leaseLost=true;});},30000);
 heartbeatTimer.unref?.();
 const work=path.join(tmpdir(),`image-explainer-render-${job.id}-${randomUUID()}`);
 const publicDir=path.join(work,'public'),out=path.join(work,'output.mp4');
 try{
  if(job.timeline?.review_status!=='admin_reviewed'||!validateExplainerTimeline(job.timeline,job.script?.scenes?.length||0)) throw new Error('Only a validated, administrator-approved visual timeline can be rendered.');
  if(!Array.isArray(job.source_images)||!job.source_images[0]?.path) throw new Error('The original source image is missing.');
  await mkdir(publicDir,{recursive:true});
  const src=job.source_images[0],ext=src.mimeType==='image/png'?'png':src.mimeType==='image/webp'?'webp':'jpg';
  const sourceFile=`source/source.${ext}`;
  await update(job,{stage_message:'Downloading original image and approved narration clips.'});
  await download('image-explainer-sources',src.path,path.join(publicDir,sourceFile));
  const renderScenes=[];
  for(let i=0;i<job.timeline.scenes.length;i++){
   const scene=job.timeline.scenes[i];
   const clip=job.narration_manifest.clips[i];
   if(!clip||clip.storage_path!==scene.audio.storage_path) throw new Error(`Narration mismatch in scene ${i+1}.`);
   const audioExt=clip.mime_type==='audio/wav'?'wav':'mp3';
   const audioFile=`audio/scene-${String(i+1).padStart(3,'0')}.${audioExt}`;
   await download('image-explainer-audio',clip.storage_path,path.join(publicDir,audioFile));
   renderScenes.push({...scene,audio_file:audioFile});
   await update(job,{stage_message:`Prepared narration ${i+1} of ${job.timeline.scenes.length}.`});
  }
  const vertical=job.timeline.aspect==='9:16',square=job.timeline.aspect==='1:1';
  const dimensions=square?{width:1080,height:1080}:vertical?{width:1080,height:1920}:{width:1920,height:1080};
  const inputProps={sourceImage:`source/source.${ext}`,scenes:renderScenes,title:job.title,aspect:job.timeline.aspect,durationInFrames:job.timeline.total_frames,sourceDimensions:job.timeline.source_dimensions};
  const entry=path.join(root,'remotion','index.js');
  await update(job,{stage:'render_processing',stage_message:'Bundling Remotion composition.'});
  const serveUrl=await bundle({entryPoint:entry,publicDir,webpackOverride:c=>c});
  const composition=await selectComposition({serveUrl,id:'ImageExplainerVideo',inputProps});
  await update(job,{stage_message:'Rendering H.264 video with scene animation, callouts, subtitles and narration.'});
  await renderMedia({composition:{...composition,...dimensions,fps,durationInFrames:job.timeline.total_frames},serveUrl,codec:'h264',outputLocation:out,inputProps,concurrency:Math.max(1,Math.min(4,Number(process.env.REMOTION_CONCURRENCY||2))),imageFormat:'jpeg',jpegQuality:92,x264Preset:'medium',crf:18,overwrite:true});
  if(leaseLost) throw new Error('Render lease was lost during rendering.');
  const info=await stat(out); if(!info.size) throw new Error('Remotion produced an empty MP4.');
  await update(job,{stage_message:`Render complete (${(info.size/1024/1024).toFixed(1)} MB). Uploading final video.`});
  const bytes=await readFile(out);
  const slug=String(job.title||'image-explainer').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'image-explainer';
  const storagePath=`image-explainer/${job.id}/${slug}.mp4`;
  const {error:uploadError}=await supabase.storage.from('lesson-videos').upload(storagePath,bytes,{contentType:'video/mp4',upsert:true});
  if(uploadError) throw new Error('Final video upload failed: '+uploadError.message);
  const {data:publicData}=supabase.storage.from('lesson-videos').getPublicUrl(storagePath);
  if(!publicData?.publicUrl) throw new Error('Could not resolve final video URL.');
  const {data:done,error:finishError}=await supabase.from('image_explainer_jobs').update({
   status:'ready',stage:'completed',stage_message:'Your explainer video is ready.',
   video_url:publicData.publicUrl,storage_path:storagePath,error_message:null,
   claim_token:null,worker_id:null,heartbeat_at:null,updated_at:new Date().toISOString()
  }).eq('id',job.id).eq('claim_token',job.claim_token).select('id').maybeSingle();
  if(finishError) throw new Error('Could not mark render ready: '+finishError.message);
  if(!done) throw new Error('Render lease was lost before completion.');
  console.log(`[image-explainer-render] ready ${job.id}: ${publicData.publicUrl}`);
 }catch(error){
  console.error(`[image-explainer-render] failed ${job.id}`,error);
  await supabase.from('image_explainer_jobs').update({status:'failed',stage:'render_failed',stage_message:'Rendering failed. Your approved timeline and narration are preserved for retry.',error_message:String(error?.message||error).slice(0,1800),claim_token:null,worker_id:null,heartbeat_at:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('claim_token',job.claim_token);
 }finally{clearInterval(heartbeatTimer);await rm(work,{recursive:true,force:true}).catch(()=>{});}
}
async function run(){
 const start=Date.now();let processed=0;
 while(Date.now()-start<maxMs){
  const {data,error}=await supabase.rpc('claim_image_explainer_render_job',{p_worker_id:workerId});
  if(error) throw new Error('Render queue claim failed. Apply migration 20261124133000_image_explainer_render_queue.sql. '+error.message);
  const job=Array.isArray(data)?data[0]:data;if(!job) break;
  await process(job);processed++;
 }
 console.log(`[image-explainer-render] finished; processed ${processed} job(s)`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
