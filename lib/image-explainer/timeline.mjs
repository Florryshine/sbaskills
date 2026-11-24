const clamp = (n, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : min));
const clean = (v, max=300) => typeof v === 'string' ? v.trim().slice(0,max) : '';
const round = (n) => Math.round(n * 1000) / 1000;

function normalizeRegion(region, dimensions) {
  const width = Number(dimensions?.width), height = Number(dimensions?.height);
  if (!width || !height || !region) return null;
  const x = clamp(region.x, 0, width), y = clamp(region.y, 0, height);
  const w = clamp(region.width, 0, width - x), h = clamp(region.height, 0, height - y);
  if (w < 2 || h < 2) return null;
  return { x: round(x / width), y: round(y / height), width: round(w / width), height: round(h / height) };
}

function focusCamera(region, move, index) {
  const [cx, cy, rw, rh] = region
    ? [region.x + region.width/2, region.y + region.height/2, region.width, region.height]
    : [0.5, 0.5, 0.72, 0.72];
  const normalizedMove = clean(move, 160).toLowerCase();
  const zoom = /zoom out|pull back|wide/.test(normalizedMove) ? 1 : /extreme|macro|tight/.test(normalizedMove) ? 2.35 : 1.65;
  const endScale = /zoom out|pull back/.test(normalizedMove) ? 1 : zoom;
  const startScale = /zoom in|push|dolly/.test(normalizedMove) ? 1 : zoom;
  const fit = Math.min(2.5, Math.max(1, Math.min(0.92 / Math.max(rw, 0.12), 0.84 / Math.max(rh, 0.12), zoom)));
  const targetScale = Math.min(2.5, Math.max(1, fit));
  return [
    { at: 0, x: round(clamp(cx, 0.05, 0.95)), y: round(clamp(cy, 0.05, 0.95)), scale: round(Math.min(startScale, targetScale)) },
    { at: 1, x: round(clamp(cx + (index % 2 ? 0.025 : -0.025), 0.05, 0.95)), y: round(clamp(cy, 0.05, 0.95)), scale: round(Math.min(Math.max(endScale, 1), targetScale)) },
  ];
}

function wordCues(words, narration, duration) {
  const valid = (words || []).filter(w => clean(w.word,100) && Number(w.end)>Number(w.start));
  const cues = [];
  for (let i=0;i<valid.length;i+=6) {
    const group=valid.slice(i,i+6);
    cues.push({ text: group.map(w=>w.word).join(' '), start: round(clamp(group[0].start,0,duration)), end: round(clamp(group[group.length-1].end,0,duration)) });
  }
  return cues.filter(c=>c.end>c.start);
}

function phraseTime(words, phrase, duration, fallback) {
  const terms = clean(phrase,100).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return fallback;
  const list = words || [];
  for (let i=0;i<=list.length-terms.length;i++) {
    if (terms.every((term,j)=>clean(list[i+j]?.word,100).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')===term.replace(/[^\p{L}\p{N}]/gu,''))) {
      return round(clamp(list[i].start,0,duration));
    }
  }
  return fallback;
}

export function buildExplainerTimeline({ script, narrationManifest, imageDimensions, components=[], approvedAssets=[] , fps=30 }) {
  const scenes=script?.scenes;
  const clips=narrationManifest?.clips;
  if (!Array.isArray(scenes)||!scenes.length||!Array.isArray(clips)||clips.length!==scenes.length) {
    throw new Error('A reviewed script and one measured narration clip per scene are required.');
  }
  if (script.review_status!=='admin_reviewed') throw new Error('The script must be administrator-approved before timeline generation.');
  if (narrationManifest.review_status==='rejected') throw new Error('Rejected narration cannot be used in a timeline.');
  const componentMap=new Map(components.map(c=>[c.id,c]));
  const safeAssets=(approvedAssets||[]).filter(a=>a?.review_status==='approved'&&a?.license_verified===true&&a?.media_url);
  let cursor=0;
  const timelineScenes=scenes.map((scene,index)=>{
    const clip=clips[index];
    if (clip.scene_index!==index || (clip.scene_id && clip.scene_id!==scene.id)) throw new Error(`Narration clip order does not match scene ${index+1}.`);
    const duration=Number(clip.duration_seconds);
    if (!Number.isFinite(duration)||duration<=0||!clip.storage_path) throw new Error(`Scene ${index+1} has invalid measured audio.`);
    const start=round(cursor), end=round(cursor+duration), startFrame=Math.round(start*fps), endFrame=Math.round(end*fps), frames=Math.max(1,endFrame-startFrame);
    const linked=(scene.visual?.component_ids||[]).map(id=>componentMap.get(id)).filter(Boolean);
    const focus=linked[0] ? normalizeRegion(linked[0].region,imageDimensions) : null;
    const camera=focusCamera(focus,scene.visual?.camera_move,index);
    const words=clip.words||[];
    const overlays=(scene.visual?.overlays||[]).slice(0,6).filter(o=>clean(o.text,100)).map((o,oi)=>{
      const anchor=linked.find(c=>clean(c.name,120).toLowerCase()===clean(o.anchor,120).toLowerCase())||linked[oi]||linked[0];
      const cueStart = phraseTime(words,o.text,duration,round(Math.min(duration*.15,oi*.6)));
      return { id:`${scene.id}-overlay-${oi+1}`, text:clean(o.text,100), style:clean(o.style,40)||'callout', anchor_region:normalizeRegion(anchor?.region,imageDimensions), start:cueStart, end:round(Math.min(duration,Math.max(cueStart + 0.25, cueStart + Math.min(2.5,duration*.35)))) };
    });
    const assets=(scene.visual?.asset_search||[]).map(q=>clean(q,120)).filter(Boolean).flatMap(q=>safeAssets.filter(a=>clean(a.query,120).toLowerCase()===q.toLowerCase()).slice(0,1)).slice(0,2).map(a=>({id:a.id,title:a.title,media_url:a.media_url,media_type:a.media_type||'image',source_url:a.source_url,license:a.license,attribution:a.attribution||a.creator||'',provider:a.provider||'',attribution_required:a.attribution_required===true}));
    const result={id:scene.id,order:index+1,headline:clean(scene.headline,120),purpose:clean(scene.purpose,300),treatment:clean(scene.visual?.treatment,80)||'image_region',description:clean(scene.visual?.description,700),start_seconds:start,end_seconds:end,duration_seconds:duration,start_frame:startFrame,duration_frames:frames,audio:{storage_path:clip.storage_path,mime_type:clip.mime_type||'audio/mpeg',duration_seconds:duration,provider:clip.provider||'',voice:clip.voice||''},camera:{easing:'easeInOut',keyframes:camera},focus_regions:linked.map(c=>({component_id:c.id,name:clean(c.name,120),region:normalizeRegion(c.region,imageDimensions)})).filter(c=>c.region),overlays,subtitle_cues:wordCues(words,scene.narration,duration),supporting_assets:assets,transition_in:clean(scene.visual?.transition,40)||'clean_cut'};
    cursor=end;
    return result;
  });
  return {version:1,engine:'image-explainer-timeline-v1',fps,aspect:script.aspect||'16:9',total_duration_seconds:round(cursor),total_frames:Math.ceil(cursor*fps),scene_count:timelineScenes.length,source_dimensions:imageDimensions,review_status:'needs_admin_review',generated_at:new Date().toISOString(),scenes:timelineScenes};
}

export function validateExplainerTimeline(timeline, sceneCount) {
  if (!timeline||timeline.version!==1||timeline.engine!=='image-explainer-timeline-v1'||!Array.isArray(timeline.scenes)||timeline.scenes.length!==sceneCount||!Number.isFinite(timeline.fps)||timeline.fps<1) return false;
  let cursor=0;
  for (const [index,scene] of timeline.scenes.entries()) {
    if (scene.order!==index+1||!scene.audio?.storage_path||!Number.isFinite(scene.duration_seconds)||scene.duration_seconds<=0) return false;
    if (Math.abs(scene.start_seconds-cursor)>.01||scene.end_seconds<=scene.start_seconds||scene.duration_frames<1) return false;
    if (!Array.isArray(scene.camera?.keyframes)||scene.camera.keyframes.length<2) return false;
    if (!Array.isArray(scene.subtitle_cues)||scene.subtitle_cues.some(c=>c.start<0||c.end<=c.start||c.end>scene.duration_seconds+.05)) return false;
    cursor=scene.end_seconds;
  }
  return Math.abs(cursor-timeline.total_duration_seconds)<.02&&timeline.total_frames>=Math.floor(cursor*timeline.fps);
}
