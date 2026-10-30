import {NextResponse} from 'next/server';
import {createRouteHandlerClient} from '@/lib/supabase-server';
import {createAdminClient} from '@/lib/supabase-admin';
export async function POST(request){
 const auth=createRouteHandlerClient();
 const {data:{user},error}=await auth.auth.getUser();
 if(error||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const {data:profile}=await auth.from('profiles').select('role').eq('id',user.id).single();
 if(profile?.role!=='admin')return NextResponse.json({error:'Administrator access required'},{status:403});
 try{
  const body=await request.json();const title=String(body.title||'').trim().slice(0,120);const scenes=Array.isArray(body.scenes)?body.scenes:[];
  if(!title||scenes.length<2||scenes.length>8)return NextResponse.json({error:'Add a title and between 2 and 8 scenes.'},{status:400});
  const safe=scenes.map(s=>({text:String(s.text||'').trim().slice(0,600),visual_cue:String(s.visual_cue||'').trim().slice(0,120)}));
  if(safe.some(s=>!s.text))return NextResponse.json({error:'Every scene needs narration text.'},{status:400});
  const db=createAdminClient();
  const {data,error:insertError}=await db.from('video_scripts').insert({title,format:'whiteboard-short',script_segments:safe,render_status:'pending'}).select('id,title,render_status').single();
  if(insertError)throw insertError;
  return NextResponse.json({success:true,job:data,notice:'Queued in video_scripts. A whiteboard-specific worker renderer is not yet connected.'});
 }catch(e){return NextResponse.json({error:e.message||'Could not queue whiteboard render'},{status:500});}
}