import { createServerClient } from '@/lib/supabase-server';
import TheoryPractice from '@/components/TheoryPractice';

export const dynamic = 'force-dynamic';

export default async function TheoryPage({ params }) {
  const supabase = createServerClient();
  const subject = decodeURIComponent(params.subject || '').trim();
  const topic = decodeURIComponent(params.topic || '').trim();

  const { data: questions } = await supabase
    .from('theory_questions')
    .select('id, subject, topic, exam_type, question, marking_points, model_answer, explanation')
    .eq('status', 'published')
    .eq('subject', subject)
    .eq('topic', topic)
    .overlaps('exam_type', ['WAEC', 'NECO'])
    .order('created_at', { ascending: false });

  return <TheoryPractice subject={subject} topic={topic} questions={questions || []} />;
}
