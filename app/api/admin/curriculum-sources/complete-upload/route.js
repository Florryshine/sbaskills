import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
export const runtime='nodejs';
export async function POST(request){
 try{
  const auth=createServerClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:p}=await auth.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(p?.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
  const {curriculum_id,path,file_name,file_type,notes=''}=await request.json();
  if(!curriculum_id||!path||!file_name||!path.startsWith(curriculum_id+'/'))return NextResponse.json({error:'Upload details are incomplete or invalid.'},{status:400});
  const admin=createAdminClient(),{data:file,error:de}=await admin.storage.from('curriculum-sources').download(path);
  if(de||!file)throw de||new Error('Uploaded file was not found in Storage.');
  if(file.size>15*1024*1024){await admin.storage.from('curriculum-sources').remove([path]);return NextResponse.json({error:'Maximum file size is 15MB.'},{status:400});}
  const {data,error}=await admin.from('curriculum_source_documents').insert({curriculum_id,file_name,file_type:file_type||file.type||'application/octet-stream',storage_path:path,status:'uploaded',notes:String(notes||''),uploaded_by:user.id}).select('id,curriculum_id,file_name,file_type,status,notes,created_at,extracted_chars,source_subject').single();
  if(error){await admin.storage.from('curriculum-sources').remove([path]);throw error;}
  return NextResponse.json({success:true,document:data});
 }catch(e){console.error('Curriculum upload completion error:',e);return NextResponse.json({error:e?.message||'Could not register uploaded file.'},{status:500});}
}