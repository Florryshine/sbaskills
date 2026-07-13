import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase-server';
import { formatContentLabel } from '@/lib/examLabel';

export const dynamic = 'force-dynamic';

export default async function FlashcardsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: flashcards, error } = await supabase
    .from('flashcard_drafts')
    .select('id, keyword, cards, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  // Exam-type personalization: same flashcard content, labeled per the
  // logged-in student's own exam track (JAMB/WAEC/NECO/...) from
  // onboarding — falls back to the generic "SBA:" prefix if signed out
  // or onboarding hasn't run yet, so nothing looks broken either way.
  let targetExams = [];
  try {
    const authedSupabase = createServerClient();
    const {
      data: { user },
    } = await authedSupabase.auth.getUser();
    if (user) {
      const { data: profile } = await authedSupabase
        .from('profiles')
        .select('target_exams')
        .eq('id', user.id)
        .maybeSingle();
      targetExams = profile?.target_exams || [];
    }
  } catch (e) {
    console.error('Could not load exam personalization:', e);
  }

  if (error) {
    console.error('Error loading flashcards:', error);
    return (
      <div className="p-8 text-center text-red-600">
        Failed to load flashcards. Please try again later.
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-blue mb-6">📚 Flashcards</h1>
      {flashcards.length === 0 ? (
        <p className="text-gray-500">No published flashcards available yet.</p>
      ) : (
        <div className="grid gap-4">
          {flashcards.map((set) => (
            <div
              key={set.id}
              className="bg-white rounded-2xl shadow-sm border p-4 flex justify-between items-center"
            >
              <div>
                <h2 className="font-bold text-lg">{formatContentLabel(targetExams, set.keyword)}</h2>
                <p className="text-sm text-gray-500">
                  {set.cards?.length || 0} cards
                </p>
              </div>
              <a
                href={`/flashcards/${set.id}`}
                className="bg-brand-yellow px-4 py-2 rounded-xl font-bold hover:opacity-90"
              >
                Study →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
