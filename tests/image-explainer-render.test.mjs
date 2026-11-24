import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExplainerTimeline} from '../lib/image-explainer/timeline.mjs';

const base={version:1,engine:'image-explainer-timeline-v1',fps:30,total_duration_seconds:2,total_frames:60,scenes:[{id:'s1',order:1,start_seconds:0,end_seconds:2,duration_seconds:2,start_frame:0,duration_frames:60,audio:{storage_path:'user/job/scene-001.mp3'},camera:{keyframes:[{at:0,x:.5,y:.5,scale:1},{at:1,x:.5,y:.5,scale:1}]},subtitle_cues:[]}]};
test('render gate accepts only complete audio-backed scene timelines',()=>assert.equal(validateExplainerTimeline(base,1),true));
test('render gate rejects missing audio and frame timing',()=>{const a=structuredClone(base);a.scenes[0].audio.storage_path='';assert.equal(validateExplainerTimeline(a,1),false);const b=structuredClone(base);b.scenes[0].duration_frames=0;assert.equal(validateExplainerTimeline(b,1),false);});
