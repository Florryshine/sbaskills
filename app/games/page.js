import { createServerClient } from '@/lib/supabase-server';
import Link from 'next/link';

// Reads only game_topics — the published, student-safe projection of a
// knowledge_asset. Students never query knowledge_assets directly (that
// table is the admin authoring source and isn't meant to be read outside
// the admin panel).
export const dynamic = 'force-dynamic';

export default async function GamesIndexPage() {
  const supabase = createServerClient();

  const { data: topics } = await supabase
    .from('game_topics')
    .select('id, title, subject, definitions')
    .order('published_at', { ascending: false });

  const { data: stepRows } = await supabase
    .from('game_sequence_steps')
    .select('game_topic_id');

  const topicsWithSteps = new Set((stepRows || []).map((r) => r.game_topic_id));

  const playable = (topics || []).filter((t) => {
    const hasSequence = topicsWithSteps.has(t.id);
    const defs = Array.isArray(t.definitions) ? t.definitions.filter((d) => d?.term && d?.definition) : [];
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
        {playable.map((t) => (
          <Link
            key={t.id}
            href={`/games/${t.id}`}
            className="block p-4 rounded-xl border border-gray-200 hover:border-indigo-400 hover:shadow-sm transition"
          >
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
              {t.subject || 'General'}
            </p>
            <p className="font-semibold text-gray-800 mt-1">{t.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
