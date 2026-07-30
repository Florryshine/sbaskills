import { createServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

// Reads only game_topics — the published, student-safe projection of a
// knowledge_asset — never knowledge_assets directly. prerequisite_ids here
// are prerequisite_game_topic_ids, already remapped to other game_topics
// rows at publish time (see app/api/admin/games/publish/route.js), so no
// knowledge_asset ids ever appear in a student-facing query.
export const dynamic = 'force-dynamic';

export default async function SyllabusMapPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: topics } = await supabase
    .from('game_topics')
    .select('id, title, subject, prerequisite_game_topic_ids, order_index, published_at')
    .order('published_at', { ascending: true });

  let progressByTopicId = {};
  if (user) {
    const { data: progress } = await supabase
      .from('student_topic_progress')
      .select('game_topic_id, bronze_earned, silver_earned, gold_earned')
      .eq('student_id', user.id);
    progressByTopicId = Object.fromEntries((progress || []).map((p) => [p.game_topic_id, p]));
  }

  const bySubject = {};
  for (const t of topics || []) {
    const subject = t.subject || 'General';
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(t);
  }

  for (const subject of Object.keys(bySubject)) {
    bySubject[subject].sort((a, b) => {
      const ao = a.order_index ?? Infinity;
      const bo = b.order_index ?? Infinity;
      if (ao !== bo) return ao - bo;
      return new Date(a.published_at) - new Date(b.published_at);
    });
  }

  function statusFor(topic) {
    const progress = progressByTopicId[topic.id];
    if (progress?.gold_earned) return 'gold';
    if (progress?.silver_earned) return 'silver';
    if (progress?.bronze_earned) return 'bronze';

    const prereqIds = topic.prerequisite_game_topic_ids || [];
    const unlocked = prereqIds.every((id) => progressByTopicId[id]?.bronze_earned);
    return unlocked ? 'available' : 'locked';
  }

  const STATUS_META = {
    locked: { icon: '🔒', label: 'Locked', dot: 'bg-gray-300', text: 'text-gray-400' },
    available: { icon: '▶️', label: 'Start', dot: 'bg-indigo-500', text: 'text-indigo-700' },
    bronze: { icon: '🥉', label: 'Bronze', dot: 'bg-amber-600', text: 'text-amber-800' },
    silver: { icon: '🥈', label: 'Silver', dot: 'bg-gray-400', text: 'text-gray-700' },
    gold: { icon: '🥇', label: 'Gold', dot: 'bg-yellow-500', text: 'text-yellow-800' },
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-1">🗺️ Syllabus Map</h1>
      <p className="text-gray-500 mb-8">
        Your path through each subject — complete a topic to unlock the next.
      </p>

      {!user && (
        <div className="mb-8 p-4 rounded-xl bg-indigo-50 text-indigo-700 text-sm">
          Log in to track your progress and unlock topics as you go — you can still browse the map below.
        </div>
      )}

      {Object.keys(bySubject).length === 0 && (
        <p className="text-gray-400">No topics have been published yet.</p>
      )}

      {Object.entries(bySubject).map(([subject, subjectTopics]) => (
        <div key={subject} className="mb-12">
          <h2 className="text-lg font-bold text-brand-blue mb-4">{subject}</h2>

          <div className="relative pl-8">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />

            {subjectTopics.map((topic) => {
              const status = statusFor(topic);
              const meta = STATUS_META[status];
              const locked = status === 'locked';

              const content = (
                <div className={`flex items-center gap-3 py-2 ${locked ? 'opacity-60' : ''}`}>
                  <span
                    className={`z-10 flex items-center justify-center w-8 h-8 rounded-full text-white text-sm ${meta.dot} -ml-8`}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold ${locked ? 'text-gray-400' : 'text-gray-800'}`}>
                      {topic.title}
                    </p>
                    <p className={`text-xs ${meta.text}`}>{meta.label}</p>
                  </div>
                </div>
              );

              return (
                <div key={topic.id} className="relative">
                  {locked ? (
                    <div className="cursor-not-allowed">{content}</div>
                  ) : (
                    <Link href={`/mission/${topic.id}`}>{content}</Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
