import { createServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function JambSyllabusMasteryPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: curriculum } = await supabase.from('curricula').select('id,name,exam_start_date,date_status').eq('code','JAMB_UTME_2027').maybeSingle();
  if (!curriculum) return <main className="mx-auto max-w-3xl p-6"><p>JAMB 2027 curriculum is not configured.</p></main>;

  const { data: topics } = await supabase.from('curriculum_topics').select('id,subject,title,order_index,game_topic_id').eq('curriculum_id',curriculum.id).order('subject').order('order_index');
  const { data: mastery } = user ? await supabase.from('student_topic_mastery').select('curriculum_topic_id,mastery_score,status,questions_attempted,questions_correct,last_practiced_at').eq('user_id',user.id) : {data:[]};
  const map = Object.fromEntries((mastery || []).map(x=>[x.curriculum_topic_id,x]));
  const groups = {};
  for (const topic of topics || []) (groups[topic.subject || 'General'] ||= []).push(topic);
  const statusLabel={not_started:'Not started',weak:'Needs work',learning:'Learning',mastered:'Mastered'};
  const statusClass={not_started:'bg-slate-100 text-slate-600',weak:'bg-red-50 text-red-700',learning:'bg-amber-50 text-amber-700',mastered:'bg-green-50 text-green-700'};
  const all=topics||[];
  const masteredCount=all.filter(t=>map[t.id]?.status==='mastered').length;
  const startedCount=all.filter(t=>(map[t.id]?.questions_attempted||0)>0).length;
  const avg=all.length?Math.round(all.reduce((s,t)=>s+(map[t.id]?.mastery_score||0),0)/all.length):0;

  return <main className="min-h-screen bg-slate-50 py-8"><div className="mx-auto max-w-5xl px-4">
    <div className="rounded-3xl bg-brand-blue p-6 text-white sm:p-8">
      <p className="text-xs font-black uppercase tracking-[.2em] text-blue-100">JAMB 2027 • SYLLABUS MASTERY</p>
      <h1 className="mt-2 text-3xl font-black">Know exactly where you stand.</h1>
      <p className="mt-2 max-w-2xl text-sm text-blue-100">Every syllabus topic gets a mastery state based on your practice.</p>
      {!user && <p className="mt-4 rounded-xl bg-white/10 p-3 text-sm">Log in to save your mastery.</p>}
    </div>
    <div className="mt-5 grid grid-cols-3 gap-3">
      <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-black">{avg}%</p><p className="text-xs text-slate-500">overall mastery</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-black">{masteredCount}</p><p className="text-xs text-slate-500">topics mastered</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-black">{startedCount}</p><p className="text-xs text-slate-500">topics started</p></div>
    </div>
    <div className="mt-5 space-y-5">
      {Object.entries(groups).map(([subject,subjectTopics])=>{
        const subjectAvg=subjectTopics.length?Math.round(subjectTopics.reduce((s,t)=>s+(map[t.id]?.mastery_score||0),0)/subjectTopics.length):0;
        return <section key={subject} className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">{subject}</h2><p className="text-xs text-slate-500">{subjectTopics.length} syllabus topics</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-brand-blue">{subjectAvg}%</span></div>
          <div className="mt-4 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-blue" style={{width:`${subjectAvg}%`}} /></div>
          <div className="mt-4 space-y-2">{subjectTopics.map(topic=>{
            const m=map[topic.id]||{mastery_score:0,status:'not_started',questions_attempted:0};
            return <div key={topic.id} className="flex items-center gap-3 rounded-2xl border p-3"><div className="min-w-0 flex-1"><p className="font-bold text-slate-800">{topic.title}</p><p className="text-xs text-slate-500">{m.questions_attempted||0} questions attempted</p></div><div className="text-right"><p className="font-black">{m.mastery_score}%</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusClass[m.status]}`}>{statusLabel[m.status]}</span></div>{topic.game_topic_id&&m.status!=='mastered'&&<Link href={`/mission/${topic.game_topic_id}`} className="rounded-xl bg-brand-yellow px-3 py-2 text-xs font-black text-brand-dark">Study</Link>}</div>;
          })}</div>
        </section>;
      })}
    </div>
  </div></main>;
}
