import { createServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

// The syllabus map: every knowledge_asset (topic), grouped by subject, shown
// as a vertical journey with lock state computed from prerequisite_ids +
// student_topic_progress. This is the page everything else (games, lessons,
// quizzes) should eventually hang off of — see areas/sba-platform notes.
//
// Known limitation as of this build: no page in the app currently *writes*
// to student_topic_progress (no lesson page marks lesson_viewed, no quiz
// page marks quiz_score, etc.) — so every topic will show as "not started"
// even after a student has genuinely engaged with its quiz/flashcards. That
// wiring is the next piece, not this one. This page only reads what's there.
//
// Unlock rule used here: a topic unlocks once every one of its
// prerequisite_ids has bronze_earned = true for the current student. Topics
// with no prerequisites are always unlocked. Bronze is intentionally the
// bar (not gold) — matches the "Bronze unlocks the next lesson" tiering
// design discussed with Florry, so the map doesn't feel like a wall.
export const dynamic = 'force-dynamic';

export default async function SyllabusMapPage() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assets } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, subject, prerequisite_ids, order_index, created_at, exam_type')
    .eq('status', 'approved')
    .order('created_at', { ascending: true });

  let progressByAssetId = {};
  if (user) {
    const { data: progress } = await supabase
      .from('student_topic_progress')
      .select('knowledge_asset_id, bronze_earned, silver_earned, gold_earned')
      .eq('student_id', user.id);
    progressByAssetId = Object.fromEntries((progress || []).map((p) => [p.knowledge_asset_id, p]));
  }

  const bySubject = {};
  for (const a of assets || []) {
    const subject = a.subject || 'General';
    if (!bySubject[subject]) bySubject[subject] = [];
    bySubject[subject].push(a);
  }

  for (const subject of Object.keys(bySubject)) {
    bySubject[subject].sort((a, b) => {
      const ao = a.order_index ?? Infinity;
      const bo = b.order_index ?? Infinity;
      if (ao !== bo) return ao - bo;
      return new Date(a.created_at) - new Date(b.created_at);
    });
  }

  function statusFor(asset) {
    const progress = progressByAssetId[asset.id];
    if (progress?.gold_earned) return 'gold';
    if (progress?.silver_earned) return 'silver';
    if (progress?.bronze_earned) return 'bronze';

    const prereqIds = asset.prerequisite_ids || [];
    const unlocked = prereqIds.every((id) => progressByAssetId[id]?.bronze_earned);
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
        <p className="text-gray-400">No topics have been added yet.</p>
      )}

      {Object.entries(bySubject).map(([subject, topics]) => (
        <div key={subject} className="mb-12">
          <h2 className="text-lg font-bold text-brand-blue mb-4">{subject}</h2>

          <div className="relative pl-8">
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-200" />

            {topics.map((asset) => {
              const status = statusFor(asset);
              const meta = STATUS_META[status];
              const locked = status === 'locked';

              const content = (
                <div
                  className={`flex items-center gap-3 py-2 ${locked ? 'opacity-60' : ''}`}
                >
                  <span
                    className={`z-10 flex items-center justify-center w-8 h-8 rounded-full text-white text-sm ${meta.dot} -ml-8`}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold ${locked ? 'text-gray-400' : 'text-gray-800'}`}>
                      {asset.keyword}
                    </p>
                    <p className={`text-xs ${meta.text}`}>{meta.label}</p>
                  </div>
                </div>
              );

              return (
                <div key={asset.id} className="relative">
                  {locked ? (
                    <div className="cursor-not-allowed">{content}</div>
                  ) : (
                    <Link href={`/games/${asset.id}`}>{content}</Link>
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
