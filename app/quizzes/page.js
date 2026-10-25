import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function QuizzesPage() {
  const supabase = createServerClient();
  const { data: quizzes, error } = await supabase
    .from('quizzes')
    .select('id, title, description, points_reward, created_at, quiz_questions(count)')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) console.error('Published quiz fetch error:', error);

  const publishedQuizzes = (quizzes || []).map((quiz) => ({
    ...quiz,
    questionCount: quiz.quiz_questions?.[0]?.count ?? 0,
  }));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-blue mb-6">📝 Available Quizzes</h1>
      {publishedQuizzes.length === 0 ? (
        <p className="text-gray-500">No quizzes available yet.</p>
      ) : (
        <div className="grid gap-4">
          {publishedQuizzes.map((quiz) => (
            <div key={quiz.id} className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center gap-4">
              <div>
                <h2 className="font-bold text-lg">{quiz.title}</h2>
                <p className="text-sm text-gray-500">{quiz.description || 'Practice quiz'}</p>
                <p className="text-sm text-gray-500">{quiz.questionCount} questions</p>
                <p className="text-sm text-brand-yellow font-semibold">+{quiz.points_reward || 10} points</p>
              </div>
              <a href={`/quiz/${quiz.id}`} className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90 whitespace-nowrap">
                View Quiz →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
