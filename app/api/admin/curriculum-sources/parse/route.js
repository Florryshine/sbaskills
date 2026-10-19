import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
async function extractPdfText(buffer){const {getData}=await import('pdf-parse/worker');const {PDFParse}=await import('pdf-parse');PDFParse.setWorker(getData());const parser=new PDFParse({data:buffer});try{const r=await parser.getText();return String(r?.text||'').trim();}finally{await parser.destroy();}}
function rejectHtml(text){const s=String(text||'').trimStart().slice(0,2000).toLowerCase();return /^<!doctype\s+html|^<html\b|^<head\b|^<body\b/.test(s)||(/<html\b/.test(s)&&/<\/html\s*>/.test(s)&&/(enable javascript|cloudflare|access denied|captcha|challenge platform)/.test(s));}
export async function POST(request){
 let admin=null,id=null,started=Date.now();
 try{
  const auth=createServerClient(),{data:{user}}=await auth.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:p}=await auth.from('profiles').select('role').eq('id',user.id).maybeSingle();if(p?.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
  ({document_id:id}=await request.json());if(!id)return NextResponse.json({error:'document_id is required.'},{status:400});
  admin=createAdminClient();const {data:doc,error:de}=await admin.from('curriculum_source_documents').select('id,curriculum_id,file_name,file_type,storage_path,status,source_url,extracted_text').eq('id',id).maybeSingle();if(de)throw de;if(!doc)return NextResponse.json({error:'Source document not found.'},{status:404});
  const markFailed=async(message)=>{await admin.from('curriculum_source_documents').update({status:'failed',notes:String(message).slice(0,1500),updated_at:new Date().toISOString()}).eq('id',id);};
  await admin.from('curriculum_source_documents').update({status:'processing',notes:'Extracting text from source file.',updated_at:new Date().toISOString()}).eq('id',id);
  if(Date.now()-started>25000)throw new Error('Parsing exceeded the 25-second processing guard.');
  let buffer=null,text='',type=String(doc.file_type||'').toLowerCase(),name=String(doc.file_name||'').toLowerCase();
  if(doc.storage_path){
   const {data:file,error}=await admin.storage.from('curriculum-sources').download(doc.storage_path);if(error)throw error;if(!file)throw new Error('File could not be downloaded from Storage.');
   buffer=Buffer.from(await file.arrayBuffer());if(!buffer.length||buffer.length>15*1024*1024)throw new Error('File is empty or exceeds 15MB.');
  }else if(doc.extracted_text){text=String(doc.extracted_text).trim();}
  else throw new Error('This source has no stored file or extracted text to parse.');
  if(buffer){
   if(type==='application/pdf'||name.endsWith('.pdf')){text=await extractPdfText(buffer);if(text.length<50)throw new Error('scanned PDF, needs OCR or pasted text');}
   else if(name.endsWith('.txt')||name.endsWith('.csv')||type.startsWith('text/'))text=buffer.toString('utf8').trim();
   else if(name.endsWith('.docx')||type.includes('wordprocessingml')){const mammoth=await import('mammoth');text=String((await mammoth.extractRawText({buffer})).value||'').trim();}
   else if(/\.(xlsx|xls)$/.test(name)||type.includes('spreadsheet')||type.includes('excel')){const XLSX=await import('xlsx');const wb=XLSX.read(buffer,{type:'buffer'});text=wb.SheetNames.map(s=>XLSX.utils.sheet_to_csv(wb.Sheets[s])).join('\n\n').trim();}
   else throw new Error('Unsupported format. Use PDF, TXT, CSV, DOCX, XLSX or XLS.');
  }
  if(rejectHtml(text))throw new Error('The source returned an HTML/challenge page, not syllabus text. Download the syllabus PDF in your browser and upload it here.');
  if(text.length<50)throw new Error('Too little readable text was extracted. If this is a scanned PDF, needs OCR or pasted text.');
  if(Date.now()-started>25000)throw new Error('Parsing exceeded the 25-second processing guard.');
  const subject=String(doc.source_subject||doc.file_name||'').replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/syllabus/ig,'').replace(/academicng\.com/ig,'').trim();
  const {data:updated,error:ue}=await admin.from('curriculum_source_documents').update({extracted_text:text,extracted_chars:text.length,source_subject:subject||null,status:'parsed',notes:'Text extraction succeeded. Ready to build syllabus topics and objectives.',updated_at:new Date().toISOString()}).eq('id',id).select('id,file_name,status,extracted_chars,source_subject').single();if(ue)throw ue;
  return NextResponse.json({success:true,document:updated});
 }catch(e){console.error('Curriculum source parse error:',e);if(admin&&id){try{await admin.from('curriculum_source_documents').update({status:'failed',notes:String(e?.message||'Could not parse source file.').slice(0,1500),updated_at:new Date().toISOString()}).eq('id',id);}catch{}}return NextResponse.json({error:e?.message||'Could not parse source file.'},{status:500});}
}