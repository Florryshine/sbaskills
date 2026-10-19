import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
export const runtime='nodejs';
const BUCKET='curriculum-sources', EXTENSIONS=new Set(['pdf','txt','docx','csv','xlsx','xls','doc']), MAX=15*1024*1024;
export async function POST(request){
 try{
  const auth=createServerClient(),{data:{user}}=await auth.auth.getUser();
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
  const {data:profile}=await auth.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profile?.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
  const b=await request.json(),{curriculum_id,file_name,file_size,file_type,notes=''}=b||{};
  if(!curriculum_id||!file_name||!Number.isFinite(Number(file_size)))return NextResponse.json({error:'curriculum_id, file_name and file_size are required.'},{status:400});
  if(Number(file_size)<=0||Number(file_size)>MAX)return NextResponse.json({error:'File must be between 1 byte and 15MB.'},{status:400});
  if(!EXTENSIONS.has(String(file_name).split('.').pop().toLowerCase()))return NextResponse.json({error:'Supported files: PDF, TXT, DOCX, CSV, XLSX, XLS and DOC.'},{status:415});
  const admin=createAdminClient(),{data:curriculum,error:ce}=await admin.from('curricula').select('id').eq('id',curriculum_id).maybeSingle();
  if(ce)throw ce;if(!curriculum)return NextResponse.json({error:'Curriculum not found.'},{status:404});
  const {data:bucket}=await admin.storage.getBucket(BUCKET);
  if(!bucket){const {error}=await admin.storage.createBucket(BUCKET,{public:false,fileSizeLimit:'15MB'});if(error&&!/already exists/i.test(error.message||''))throw error;}
  const safe=String(file_name).replace(/[^a-zA-Z0-9._-]/g,'-'),path=`${curriculum_id}/${crypto.randomUUID()}-${safe}`;
  const {data,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(path,{upsert:false});if(error)throw error;
  return NextResponse.json({success:true,path,token:data.token,bucket:BUCKET,file_name:String(file_name),file_type:String(file_type||''),notes:String(notes||''),curriculum_id});
 }catch(e){console.error('Curriculum upload URL error:',e);return NextResponse.json({error:e?.message||'Could not prepare upload.'},{status:500});}
}