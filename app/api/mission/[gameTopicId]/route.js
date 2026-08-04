// app/api/mission/[gameTopicId]/route.js
//
// Thin HTTP wrapper around the Journey Engine (lib/journeyEngine.js).
// Renamed from an earlier [assetId] version once it became clear the
// World Map (app/syllabus/page.js) links by game_topics.id, not
// knowledge_asset id — see lib/journeyEngine.js header for the full
// correction notes.

import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { buildMission } from '@/lib/journeyEngine';

export async function GET(request, { params }) {
  const { gameTopicId } = params;

  if (!gameTopicId) {
    return NextResponse.json({ error: 'gameTopicId is required' }, { status: 400 });
  }

  const supabase = createRouteHandlerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const mission = await buildMission(supabase, gameTopicId);
    return NextResponse.json({ mission });
  } catch (error) {
    console.error('Journey Engine build failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
