import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExplainerTimeline, validateExplainerTimeline } from '../lib/image-explainer/timeline.mjs';

const script={review_status:'admin_reviewed',aspect:'16:9',scenes:[
{id:'s1',headline:'First',purpose:'Explain first',narration:'The heart pumps blood around the body.',visual:{treatment:'image_region',description:'Focus on heart',camera_move:'slow zoom in',component_ids:['heart'],overlays:[{text:'heart',anchor:'Heart',style:'label'}],asset_search:[]}},
{id:'s2',headline:'Second',purpose:'Explain next',narration:'Blood carries oxygen.',visual:{treatment:'macro_detail',description:'Show oxygen',camera_move:'pull back',component_ids:[],overlays:[],asset_search:[]}}
]};
const manifest={review_status:'needs_admin_review',clips:[
{scene_index:0,scene_id:'s1',storage_path:'u/j/1.mp3',duration_seconds:4,words:[{word:'The',start:0,end:.3},{word:'heart',start:.3,end:.8},{word:'pumps',start:.8,end:1.2},{word:'blood',start:1.2,end:1.7},{word:'around',start:1.7,end:2.1},{word:'the',start:2.1,end:2.3},{word:'body.',start:2.3,end:3}]},
{scene_index:1,scene_id:'s2',storage_path:'u/j/2.mp3',duration_seconds:3,words:[{word:'Blood',start:0,end:.4},{word:'carries',start:.4,end:.9},{word:'oxygen.',start:.9,end:1.5}]}
]};
const components=[{id:'heart',name:'Heart',region:{x:100,y:100,width:200,height:160}}];

test('builds sequential scene timing from measured narration, not script estimates',()=>{
 const t=buildExplainerTimeline({script,narrationManifest:manifest,imageDimensions:{width:1000,height:800},components});
 assert.equal(t.total_duration_seconds,7);assert.equal(t.scenes[1].start_seconds,4);assert.equal(t.scenes[1].duration_frames,90);
 assert.equal(t.scenes[0].focus_regions[0].region.x,.1);assert.equal(validateExplainerTimeline(t,2),true);
});
test('creates readable word-synchronised subtitle cues and camera keyframes',()=>{
 const t=buildExplainerTimeline({script,narrationManifest:manifest,imageDimensions:{width:1000,height:800},components});
 assert.equal(t.scenes[0].subtitle_cues[0].text,'The heart pumps blood around the');
 assert.equal(t.scenes[0].camera.keyframes.length,2);assert.equal(Number.isFinite(t.scenes[0].overlays[0].start),true);
});
test('rejects unreviewed scripts, missing audio and mismatched scene order',()=>{
 assert.throws(()=>buildExplainerTimeline({script:{...script,review_status:'needs_admin_review'},narrationManifest:manifest,imageDimensions:{width:1,height:1}}),/administrator-approved/);
 assert.throws(()=>buildExplainerTimeline({script,narrationManifest:{clips:[]},imageDimensions:{width:1,height:1}}),/one measured narration/);
 assert.throws(()=>buildExplainerTimeline({script,narrationManifest:{...manifest,clips:[manifest.clips[1],manifest.clips[0]]},imageDimensions:{width:1,height:1}}),/order/);
});
test('validator catches gaps and invalid subtitle boundaries',()=>{
 const t=buildExplainerTimeline({script,narrationManifest:manifest,imageDimensions:{width:1000,height:800},components});
 assert.equal(validateExplainerTimeline(t,2),true);
 t.scenes[1].start_seconds=4.5;assert.equal(validateExplainerTimeline(t,2),false);
});
