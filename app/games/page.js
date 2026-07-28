import { createServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

// No unified student-facing "topic page" exists yet in the app (quizzes,
// flashcards, and knowledge assets are separate standalone lists) — this is
// a standalone index just for discovering /games/[id] pages until a proper
// syllabus map page exists.
export const dynamic = 'force-dynamic';

export default async function GamesIndexPage() {
  const supabase = createServerClient();

  const { data: assets } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, subject, definitions')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const { data: stepRows } = await supabase
    .from('sequence_steps')
    .select('knowledge_asset_id');

  const topicsWithSteps = new Set((stepRows || []).map((r) => r.knowledge_asset_id));

  const playable = (assets || []).filter((a) => {
    const hasSequence = topicsWithSteps.has(a.id);
    const defs = Array.isArray(a.definitions) ? a.definitions.filter((d) => d?.term && d?.definition) : [];
    return hasSequence || defs.length >= 2;
  });

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-2xl font-bold mb-2">🎮 Revision Games</h1>
      <p className="text-gray-500 mb-8">
        Pick a topic to play a quick revision game.
      </p>

      {playable.length === 0 && (
        <p className="text-gray-400">No games are available yet — check back soon.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {playable.map((a) => (
          <Link
            key={a.id}
            href={`/games/${a.id}`}
            className="block p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-sm transition"
          >
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
              {a.subject || 'General'}
            </p>
            <p className="font-semibold text-gray-800 mt-1">{a.keyword}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
