'use client';

// app/mission/[gameTopicId]/page.js
//
// The screen a tapped World Map node leads to. Orchestrates:
//   Briefing -> Runner (steps) -> Complete -> back to World Map
//
// Renamed from an earlier [assetId] version — the id in this route is a
// game_topics.id (what app/syllabus/page.js already links to), not a
// knowledge_asset id. See lib/journeyEngine.js header for why.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import MissionBriefing from '@/components/mission/MissionBriefing';
import MissionRunner from '@/components/mission/MissionRunner';
import MissionComplete from '@/components/mission/MissionComplete';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const PHASE = { LOADING: 'loading', BRIEFING: 'briefing', RUNNING: 'running', COMPLETE: 'complete', ERROR: 'error' };

export default function MissionPage() {
  const { gameTopicId } = useParams();
  const router = useRouter();
  const supabase = createBrowserClient();

  const [phase, setPhase] = useState(PHASE.LOADING);
  const [mission, setMission] = useState(null);
  const [studentId, setStudentId] = useState(null);
  const [tier, setTier] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }
      setStudentId(user.id);

      try {
        const res = await fetch(`/api/mission/${gameTopicId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to load mission');
        setMission(json.mission);
        setPhase(PHASE.BRIEFING);
      } catch (e) {
        setError(e.message);
        setPhase(PHASE.ERROR);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameTopicId]);

  async function handleMissionComplete(finishedSteps) {
    // First writer to student_topic_progress in the repo — see
    // lib/journeyEngine.js header. Signals are best-effort: pull a quiz
    // score if a quiz step exists, note a boss win if that step exists,
    // otherwise default to a bronze completion.
    const quizStep = finishedSteps.find((s) => s.type === 'quiz');
    const bossStep = finishedSteps.find((s) => s.type === 'boss_battle');

    let quizScorePct;
    if (quizStep) {
      // quiz_attempts.quiz_id here holds the quiz_drafts id (see the patch
      // to app/quizzes/[id]/page.js) and the score column is `score`
      // (already stored as a 0-100 percentage by that patch), not
      // `score_pct`.
      const { data } = await supabase
        .from('quiz_attempts')
        .select('score')
        .eq('student_id', studentId)
        .eq('quiz_id', quizStep.ref.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      quizScorePct = data?.score;
    }

    const bossBattleWon = bossStep ? true : undefined; // reaching this step as "completed" already required a completed=true boss_attempts row

    const { recordMissionResult } = await import('@/lib/journeyEngine');
    const result = await recordMissionResult(supabase, {
      studentId,
      gameTopicId,
      signals: { quizScorePct, bossBattleWon },
    });

    setTier(result.tier);
    setPhase(PHASE.COMPLETE);
  }

  if (phase === PHASE.LOADING) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
        Loading mission…
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#dc2626' }}>
        {error || 'Something went wrong loading this mission.'}
      </div>
    );
  }

  return (
    <>
      <Navbar />

      {phase === PHASE.BRIEFING && (
        <MissionBriefing mission={mission} onStart={() => setPhase(PHASE.RUNNING)} />
      )}

      {phase === PHASE.RUNNING && (
        <MissionRunner
          mission={mission}
          studentId={studentId}
          onMissionComplete={handleMissionComplete}
        />
      )}

      {phase === PHASE.COMPLETE && (
        <MissionComplete
          mission={mission}
          tier={tier}
          onContinue={() => router.push('/syllabus')}
        />
      )}

      <Footer />
    </>
  );
}
