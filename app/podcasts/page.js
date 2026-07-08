import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export default async function PodcastsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: episodes, error } = await supabase
    .from('podcast_episodes')
    .select('id, title, total_duration_seconds, created_at')
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading podcasts:', error);
    return (
      <div className="p-8 text-center text-red-600">
        Failed to load episodes. Please try again later.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-blue mb-6">🎙️ Podcasts</h1>
      {episodes.length === 0 ? (
        <p className="text-gray-500">No episodes available yet. Check back soon!</p>
      ) : (
        <div className="grid gap-4">
          {episodes.map((ep) => (
            <div
              key={ep.id}
              className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center hover:shadow-md transition"
            >
              <div>
                <h2 className="font-bold text-lg">{ep.title}</h2>
                <p className="text-sm text-gray-500">
                  {Math.round(ep.total_duration_seconds / 60)} min • {new Date(ep.created_at).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`/podcast/${ep.id}`}
                className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90 transition"
              >
                ▶️ Listen
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}