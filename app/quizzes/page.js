import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function QuizzesPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Fetch manual quizzes
  const { data: manualQuizzes, error: manualError } = await supabase
    .from('quizzes')
    .select('id, title, description, points_reward, is_published')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  // 2. Fetch published content‑engine quizzes
  const { data: draftQuizzes, error: draftError } = await supabase
    .from('quiz_drafts')
    .select('id, keyword, questions, passing_score, estimated_minutes')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (manualError) console.error('Manual quiz fetch error:', manualError);
  if (draftError) console.error('Draft quiz fetch error:', draftError);

  const allQuizzes = [
    ...(manualQuizzes || []).map(q => ({
      id: q.id,
      title: q.title,
      description: q.description || 'Manual quiz',
      points: q.points_reward || 10,
      is_manual: true,
      questionCount: null,
    })),
    ...(draftQuizzes || []).map(q => ({
      id: q.id,
      title: q.keyword,
      description: `Content‑engine quiz • ${q.questions?.length || 0} questions`,
      points: 10,
      is_manual: false,
      questionCount: q.questions?.length || 0,
    })),
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-blue mb-6">📝 Available Quizzes</h1>
      {allQuizzes.length === 0 ? (
        <p className="text-gray-500">No quizzes available yet.</p>
      ) : (
        <div className="grid gap-4">
          {allQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center"
            >
              <div>
                <h2 className="font-bold text-lg">{quiz.title}</h2>
                <p className="text-sm text-gray-500">{quiz.description}</p>
                <p className="text-sm text-brand-yellow font-semibold">+{quiz.points} points</p>
              </div>
              <a
                href={`/quizzes/${quiz.id}${quiz.is_manual ? '' : '?draft=true'}`}
                className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
              >
                Take Quiz →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}