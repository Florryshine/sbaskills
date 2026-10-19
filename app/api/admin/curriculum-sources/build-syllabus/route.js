import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { generateWithFallback } from '@/lib/llmFallbackChain';
export const runtime='nodejs'; export const dynamic='force-dynamic'; export const maxDuration=30;
const subjects=[['Biology',/bio(logy)?/i],['Chemistry',/chem(istry)?/i],['Physics',/phys(ics)?/i],['Mathematics',/math(ematic(s)?)?/i],['Use of English',/english/i],['CRS',/christian religious|\bcrs\b/i],['IRS',/islamic religious|\birs\b/i],['Government',/government/i],['Literature in English',/literature/i],['Economics',/economics?/i],['Commerce',/commerce/i],['Accounting',/accounting|principles of accounts/i],['Agricultural Science',/agricultural|agriculture/i],['Geography',/geography/i],['Computer Studies',/computer/i],['French',/french/i],['Arabic',/arabic/i],['Hausa',/hausa/i],['Igbo',/igbo/i],['Yoruba',/yoruba/i]];
const clean=(v,n=600)=>typeof v==='string'?v.replace(/\s+/g,' ').trim().slice(0,n):'';
function subjectName(value){const v=String(value||'').replace(/\.[^.]+$/,'').replace(/jamb|utme|syllabus|202[6-9]/ig,'').replace(/[_-]+/g,' ').trim();return subjects.find(([name,re])=>re.test(v))?.[0]||null;}
function parseJson(s){return JSON.parse(String(s||'').replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim());}
function chunksOf(s){const a=[];while(s.length>6000){let i=s.lastIndexOf('\n',6000);if(i<3000)i=6000;a.push(s.slice(0,i));s=s.slice(i).trimStart();}if(s.trim())a.push(s);return a;}
async function generate(chunk,subject,index,total){
 const prompt=`Extract ONLY syllabus information explicitly present below. Do not invent topics or objectives. Subject: ${subject}; chunk ${index+1}/${total}. Return JSON only: {"topics":[{"title":"main topic","code":"","description":"source-faithful brief description","objectives":["explicit learning objective"],"subtopics":[{"title":"subtopic","code":"","objectives":["explicit objective"]}]}]}. Preserve source numbering where available. Ignore headers/footers. If there are no clear topics, return {"topics":[]}. SOURCE:\n${chunk}`;
 const r=await generateWithFallback(prompt,parseJson,x=>x&&Array.isArray(x.topics),3500);
 if(!r?.result)throw new Error('AI response did not contain a valid topics array');return r.result.topics;
}
export async function POST(request){
 let admin=null,id=null;
 try{
  const auth=createServerClient(),{data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:p}=await auth.from('profiles').select('role').eq('id',user.id).maybeSingle();if(p?.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
  ({document_id:id}=await request.json());if(!id)return NextResponse.json({error:'document_id is required.'},{status:400});
  admin=createAdminClient();const {data:doc,error:de}=await admin.from('curriculum_source_documents').select('id,curriculum_id,file_name,source_subject,extracted_text').eq('id',id).maybeSingle();if(de)throw de;if(!doc)return NextResponse.json({error:'Source document not found.'},{status:404});
  if(!doc.extracted_text||doc.extracted_text.trim().length<50)return NextResponse.json({error:'Extract text successfully before building the syllabus.'},{status:422});
  const subject=subjectName(doc.source_subject)||subjectName(doc.file_name);if(!subject)return NextResponse.json({error:'Could not identify a supported JAMB subject from the source filename/subject.'},{status:422});
  await admin.from('curriculum_source_documents').update({status:'processing',source_subject:subject,notes:'Building syllabus topics and objectives.',updated_at:new Date().toISOString()}).eq('id',id);
  const chunks=chunksOf(doc.extracted_text),failed=[],counts={topics_added:0,topics_already_existing:0,objectives_added:0};let order=0;const started=Date.now();
  for(let ci=0;ci<chunks.length;ci++){
   if(Date.now()-started>22000){failed.push({chunk:ci+1,error:'Stopped before the serverless time limit.'});break;}
   let list;try{list=await generate(chunks[ci],subject,ci,chunks.length);}catch(e){failed.push({chunk:ci+1,error:String(e?.message||e).slice(0,300)});continue;}
   for(const item of list){
    const title=clean(item?.title,250);if(!title)continue;order++;
    let topicId;const {data:old,error:oe}=await admin.from('curriculum_topics').select('id').eq('curriculum_id',doc.curriculum_id).eq('subject',subject).eq('title',title).maybeSingle();if(oe)throw oe;
    if(old){topicId=old.id;counts.topics_already_existing++;}else{
     const {data:newRow,error:ie}=await admin.from('curriculum_topics').insert({curriculum_id:doc.curriculum_id,subject,title,order_index:order,node_type:'topic',code:clean(item.code,80)||null,description:clean(item.description,1800)||null,syllabus_text:clean(item.description,1800)||title,source:id}).select('id').single();if(ie)throw ie;topicId=newRow.id;counts.topics_added++;
    }
    const saveObjectives=async(nodeId,values)=>{for(let oi=0;oi<(Array.isArray(values)?values.length:0);oi++){const obj=clean(values[oi],1000);if(!obj)continue;const {data:found,error:fe}=await admin.from('curriculum_objectives').select('id').eq('curriculum_topic_id',nodeId).eq('objective_text',obj).maybeSingle();if(fe)throw fe;if(!found){const {error:ins}=await admin.from('curriculum_objectives').insert({curriculum_topic_id:nodeId,objective_text:obj,order_index:oi+1,source:id});if(ins&&!/duplicate key/i.test(ins.message||''))throw ins;if(!ins)counts.objectives_added++;}}};
    await saveObjectives(topicId,item.objectives);
    for(let si=0;si<(Array.isArray(item.subtopics)?item.subtopics.length:0);si++){
     const sub=item.subtopics[si],st=clean(sub?.title,250);if(!st)continue;
     const {data:oldSub,error:ose}=await admin.from('curriculum_topics').select('id').eq('curriculum_id',doc.curriculum_id).eq('subject',subject).eq('title',st).maybeSingle();if(ose)throw ose;let subId;
     if(oldSub){subId=oldSub.id;counts.topics_already_existing++;}else{const {data:sr,error:se}=await admin.from('curriculum_topics').insert({curriculum_id:doc.curriculum_id,subject,title:st,order_index:si+1,parent_id:topicId,node_type:'subtopic',code:clean(sub.code,80)||null,syllabus_text:st,source:id}).select('id').single();if(se)throw se;subId=sr.id;counts.topics_added++;}
     await saveObjectives(subId,sub.objectives);
    }
   }
  }
  const status=failed.length?'failed':'published',notes=`Syllabus build ${status}; subject ${subject}; topics/subtopics added ${counts.topics_added}; existing ${counts.topics_already_existing}; objectives added ${counts.objectives_added}; failed chunks ${failed.length}.${failed.length?' '+failed.map(x=>'chunk '+x.chunk+': '+x.error).join(' | '):''}`;
  const {error:ue}=await admin.from('curriculum_source_documents').update({status,notes,updated_at:new Date().toISOString()}).eq('id',id);if(ue)throw ue;
  return NextResponse.json({success:!failed.length,document_id:id,subject,status,chunks_total:chunks.length,chunks_failed:failed,...counts,elapsed_ms:Date.now()-started});
 }catch(e){console.error('Build syllabus failed:',e);if(admin&&id)try{await admin.from('curriculum_source_documents').update({status:'failed',notes:'Syllabus build failed: '+String(e?.message||e).slice(0,1000),updated_at:new Date().toISOString()}).eq('id',id);}catch{}return NextResponse.json({error:e?.message||'Could not build syllabus.'},{status:500});}
}