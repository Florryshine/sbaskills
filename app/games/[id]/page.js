import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import GamesClient from '@/components/games/GamesClient';

// Reads game_topics / game_sequence_steps — the public, student-safe tables
// — never knowledge_assets or sequence_steps directly. GamesClient's props
// stay shaped exactly as before (asset.keyword, steps[]) so no changes were
// needed there; we just alias game_topics.title -> keyword when building
// the props object below.
export const dynamic = 'force-dynamic';

export default async function TopicGamesPage({ params }) {
  const { id } = params;
  const supabase = createServerClient();

  const { data: topic, error: topicError } = await supabase
    .from('game_topics')
    .select('id, title, subject, definitions')
    .eq('id', id)
    .maybeSingle();

  if (topicError || !topic) {
    notFound();
  }

  const { data: steps } = await supabase
    .from('game_sequence_steps')
    .select('id, step_order, label, detail')
    .eq('game_topic_id', id)
    .order('step_order', { ascending: true });

  const asset = {
    id: topic.id,
    keyword: topic.title,
    subject: topic.subject,
    definitions: topic.definitions,
  };

  return (
    <GamesClient asset={asset} steps={steps || []} />
  );
}
