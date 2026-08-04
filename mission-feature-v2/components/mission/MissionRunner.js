// components/mission/MissionRunner.js
//
// Sequences a mission's steps, navigating out to existing pages rather
// than re-implementing them, then detecting completion on return.
//
// Corrected after finding the real routing/schema (see
// lib/journeyEngine.js header for the full story):
//
// - quiz  -> content-engine quizzes live in quiz_drafts and are played at
//   /quizzes/[id]?draft=true (NOT /quiz/[id], which only serves the
//   separate manually-authored `quizzes` table). That page previously
//   wrote nothing to the database — it now writes to quiz_attempts and
//   awards XP via a small patch (see patches/quizzes-id-page.js in this
//   delivery). Completion is detected via quiz_attempts.student_id +
//   quiz_id (the quiz_drafts id).
// - boss_battle -> resolved by the engine to the LIVE boss_battles id
//   (boss_battle_drafts.boss_battle_id after publish). Detected via
//   boss_attempts.user_id (this table uses user_id, not student_id —
//   an existing inconsistency in the codebase, not something introduced
//   here) + boss_id + completed = true. Routes to /boss generally; no
//   deep-link-to-a-specific-boss support exists there yet.
// - flashcards -> /flashcards/[id]. Self-awarded via completeActivity(),
//   which is already dedupe-safe against student_progress, so this is
//   harmless even though the flashcard viewer's own MarkDoneButton could
//   also award it.
// - topic_games -> the existing /games/[gameTopicId] page (Sequence
//   Builder/Memory/Definition Match). It awards nothing itself, so this
//   step is self-awarded, same as flashcards. There's no server-side
//   completion signal for this one at all (no attempts table) — the
//   student advancing to "Go" and coming back is trusted at face value,
//   same as flashcards.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { completeActivity } from '@/lib/gamification';
import MissionProgressBar from './MissionProgressBar';
import XpToast from './XpToast';

const STEP_ROUTE = {
  quiz: (ref) => `/quizzes/${ref.id}?draft=true`,
  boss_battle: () => `/boss`, // known gap: no deep link to a specific boss yet
  flashcards: (ref) => `/flashcards/${ref.id}`,
  topic_games: (ref) => `/games/${ref.id}`,
};

const SELF_AWARDED_TYPES = new Set(['flashcards', 'topic_games', 'study_note', 'video', 'podcast']);

export default function MissionRunner({ mission, studentId, onMissionComplete }) {
  const router = useRouter();
  const supabase = createBrowserClient();
  const [steps, setSteps] = useState(mission.steps.map((s) => ({ ...s })));
  const [toast, setToast] = useState(null);
  const [checking, setChecking] = useState(false);

  const currentIndex = steps.findIndex((s) => !s.completed);
  const allDone = currentIndex === -1;

  useEffect(() => {
    if (allDone) onMissionComplete?.(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  const recheckExternalSteps = useCallback(async () => {
    setChecking(true);
    const next = [...steps];
    let changed = false;

    for (let i = 0; i < next.length; i++) {
      const step = next[i];
      if (step.completed) continue;

      if (step.type === 'quiz') {
        const { data } = await supabase
          .from('quiz_attempts')
          .select('id')
          .eq('student_id', studentId)
          .eq('quiz_id', step.ref.id)
          .maybeSingle();
        if (data) {
          next[i] = { ...step, completed: true };
          changed = true;
          setToast({ amount: step.xp, label: 'Quiz' });
        }
      }

      if (step.type === 'boss_battle') {
        const { data } = await supabase
          .from('boss_attempts')
          .select('id')
          .eq('user_id', studentId) // boss_attempts uses user_id, not student_id
          .eq('boss_id', step.ref.id)
          .eq('completed', true)
          .maybeSingle();
        if (data) {
          next[i] = { ...step, completed: true };
          changed = true;
          setToast({ amount: step.xp, label: 'Boss Battle' });
        }
      }
    }

    if (changed) setSteps(next);
    setChecking(false);
  }, [steps, studentId, supabase]);

  useEffect(() => {
    function onFocus() {
      recheckExternalSteps();
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [recheckExternalSteps]);

  async function handleStepAction(step, index) {
    const routeFn = STEP_ROUTE[step.type];

    if (SELF_AWARDED_TYPES.has(step.type)) {
      if (routeFn) router.push(routeFn(step.ref));
      await completeActivity(studentId, step.type, step.ref?.id || mission.gameTopicId, step.xp);
      setToast({ amount: step.xp, label: step.type.replace('_', ' ') });
      setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, completed: true } : s)));
      return;
    }

    // quiz / boss_battle: navigate to the real screen; completion is
    // picked up by recheckExternalSteps() when focus returns here.
    if (routeFn) router.push(routeFn(step.ref));
  }

  if (allDone) return null;

  const current = steps[currentIndex];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{mission.title}</h1>

      <MissionProgressBar steps={steps} />

      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.25rem',
          marginTop: '1rem',
        }}
      >
        <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>
          Current step
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.25rem' }}>
          {current.type.replace('_', ' ')}
        </div>

        <button
          onClick={() => handleStepAction(current, currentIndex)}
          disabled={checking}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.8rem',
            fontWeight: 700,
            color: 'white',
            background: '#2563eb',
            border: 'none',
            borderRadius: '0.75rem',
            cursor: checking ? 'wait' : 'pointer',
            opacity: checking ? 0.7 : 1,
          }}
        >
          {checking ? 'Checking…' : `Go`}
        </button>

        {!SELF_AWARDED_TYPES.has(current.type) && (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>
            Complete it, then come back to this tab — we'll pick up your result automatically.
          </p>
        )}
      </div>

      {toast && (
        <XpToast amount={toast.amount} label={toast.label} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
