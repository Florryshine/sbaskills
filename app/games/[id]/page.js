import { createServerClient } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import GamesClient from '@/components/games/GamesClient';

// Session-aware fetch, matching the createServerClient() pattern used across
// the rest of the app (dashboard, admin, leaderboard) — see Fix #8 notes.
// sequence_steps RLS requires the `authenticated` role, so a signed-out
// visitor will get zero rows here rather than a real error; the client
// component handles that by just not showing that game's tab.
export const dynamic = 'force-dynamic';

export default async function TopicGamesPage({ params }) {
  const { id } = params;
  const supabase = createServerClient();

  const { data: asset, error: assetError } = await supabase
    .from('knowledge_assets')
    .select('id, keyword, subject, summary, definitions, key_concepts')
    .eq('id', id)
    .maybeSingle();

  if (assetError || !asset) {
    notFound();
  }

  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, step_order, label, detail')
    .eq('knowledge_asset_id', id)
    .order('step_order', { ascending: true });

  return (
    <GamesClient asset={asset} steps={steps || []} />
  );
}
