import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function WAECNECOTopicPage({ params }) {
  const supabase = createServerClient();
  const subject = decodeURIComponent(params.subject || '').trim();
  const topic = decodeURIComponent(params.topic || '').trim();

  const [{ data: assets }, { data: questions }] = await Promise.all([
    supabase.from('knowledge_assets')
      .select('id, keyword, summary, topic_type, exam_type, learning_objectives, estimated_duration_minutes')
      .overlaps('exam_type', ['WAEC', 'NECO'])
      .ilike('keyword', topic)
      .limit(10),
    supabase.from('past_questions')
      .select('id, exam_type, year')
      .in('exam_type', ['WAEC', 'NECO'])
      .eq('subject', subject)
      .eq('topic', topic)
      .order('year', { ascending: false })
      .limit(100),
  ]);

  const asset = (assets || []).find((item) => item.keyword?.trim().toLowerCase() === topic.toLowerCase()) || assets?.[0] || null;
  let notes = [], quizzes = [], flashcards = [];

  if (asset) {
    const [{ data: noteRows }, { data: quizRows }, { data: cardRows }] = await Promise.all([
      supabase.from('study_note_drafts').select('id, title, book_id, knowledge_asset_id').eq('status', 'published').eq('knowledge_asset_id', asset.id).limit(5),
      supabase.from('quiz_drafts').select('id, questions, estimated_minutes').eq('status', 'published').eq('knowledge_asset_id', asset.id).limit(5),
      supabase.from('flashcard_drafts').select('id, cards').eq('status', 'published').eq('knowledge_asset_id', asset.id).limit(5),
    ]);
    notes = noteRows || []; quizzes = quizRows || []; flashcards = cardRows || [];
  }

  const examCounts = (questions || []).reduce((acc, q) => {
    acc[q.exam_type] = (acc[q.exam_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="bg-brand-blue text-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <Link href={`/waec-neco/study/${encodeURIComponent(subject)}`} className="text-sm font-semibold text-blue-200 hover:text-white">← Back to {subject}</Link>
          <p className="mt-9 text-xs font-extrabold uppercase tracking-[0.22em] text-brand-yellow">WAEC & NECO • TOPIC LEARNING</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{topic}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-blue-100">Learn the topic first, then practise and test yourself. The same Knowledge Asset can feed WAEC, NECO and other applicable learning worlds.</p>
          <div className="mt-7 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-white/10 px-4 py-2 font-bold">WAEC • {examCounts.WAEC || 0} questions</span>
            <span className="rounded-full bg-white/10 px-4 py-2 font-bold">NECO • {examCounts.NECO || 0} questions</span>
            {asset?.estimated_duration_minutes ? <span className="rounded-full bg-white/10 px-4 py-2 font-bold">~{asset.estimated_duration_minutes} min</span> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        {asset ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-yellow">LEARN</p>
            <h2 className="mt-2 text-2xl font-black text-brand-blue">Understand {asset.keyword}</h2>
            {asset.summary ? <p className="mt-4 leading-7 text-slate-600">{asset.summary}</p> : null}
            {Array.isArray(asset.learning_objectives) && asset.learning_objectives.length ? (
              <div className="mt-6">
                <h3 className="font-extrabold text-slate-900">By the end, you should be able to:</h3>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {asset.learning_objectives.map((objective, i) => <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">✓ {objective}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-3xl">📚</p>
            <h2 className="mt-3 text-xl font-black text-brand-blue">Learning content is not published yet</h2>
            <p className="mt-2 text-sm text-slate-500">The topic is already in the question bank. Publish a Knowledge Asset with the same topic to add notes, flashcards and quizzes without duplicating content.</p>
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.filter((n) => n.book_id).map((note) => (
            <Link key={note.id} href={`/library/${note.book_id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-blue">
              <span className="text-3xl">📖</span><h3 className="mt-3 font-extrabold">Study Note</h3>
              <p className="mt-2 text-sm text-slate-500">{note.title || 'Read the topic note.'}</p>
              <span className="mt-4 inline-block text-sm font-extrabold text-brand-blue">Read →</span>
            </Link>
          ))}
          {flashcards.map((card) => (
            <Link key={card.id} href={`/flashcards/${card.id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-blue">
              <span className="text-3xl">🧠</span><h3 className="mt-3 font-extrabold">Flashcards</h3>
              <p className="mt-2 text-sm text-slate-500">{card.cards?.length || 0} quick-recall cards.</p>
              <span className="mt-4 inline-block text-sm font-extrabold text-brand-blue">Study →</span>
            </Link>
          ))}
          {quizzes.map((quiz) => (
            <Link key={quiz.id} href={`/quizzes/${quiz.id}?draft=true`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-blue">
              <span className="text-3xl">📝</span><h3 className="mt-3 font-extrabold">Quiz</h3>
              <p className="mt-2 text-sm text-slate-500">{quiz.questions?.length || 0} questions{quiz.estimated_minutes ? ` • ~${quiz.estimated_minutes} min` : ''}.</p>
              <span className="mt-4 inline-block text-sm font-extrabold text-brand-blue">Take quiz →</span>
            </Link>
          ))}
          <Link href={`/tools/past-questions?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand-blue">
            <span className="text-3xl">📝</span><h3 className="mt-3 font-extrabold">Past Questions</h3>
            <p className="mt-2 text-sm text-slate-500">Practise available WAEC and NECO questions for this topic.</p>
            <span className="mt-4 inline-block text-sm font-extrabold text-brand-blue">Practise →</span>
          </Link>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5"><span className="text-3xl">✍️</span><h3 className="mt-3 font-extrabold">Theory</h3><p className="mt-2 text-sm text-slate-500">Coming in Build 8D.</p></div>
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5"><span className="text-3xl">🧪</span><h3 className="mt-3 font-extrabold">Practical</h3><p className="mt-2 text-sm text-slate-500">Coming in Build 8E.</p></div>
        </section>
      </div>
      <Footer />
    </main>
  );
}