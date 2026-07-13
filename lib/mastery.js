// lib/mastery.js
// The 4-pillar level-up system: XP is mandatory, plus 3-of-4 from
// Learning Mastery, Assessment Champion, Scholar Recognition, Consistency.
//
// Every number here reads from tables/columns that already exist —
// no new schema. Pillar targets below are the finalized per-level
// numbers; adjust individual levels in PILLAR_TARGETS as real
// completion data comes in — no code changes needed elsewhere.

import { getLevelInfo } from './levels';

export async function getMasteryStats(supabase, userId) {
  const [{ count: learningCount }, { count: assessmentCount }, { count: recognitionCount }, profile] =
    await Promise.all([
      supabase
        .from('student_progress')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', userId)
        .in('activity_type', ['course', 'blog', 'audio']),
      supabase
        .from('points_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('action_type', ['quiz_complete', 'boss_defeated', 'daily_challenge']),
      supabase
        .from('points_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('action_type', 'tutor_bonus'),
      supabase.from('profiles').select('streak_days').eq('id', userId).single(),
    ]);

  return {
    learningMastery: learningCount || 0,
    assessmentChampion: assessmentCount || 0,
    scholarRecognition: recognitionCount || 0,
    consistency: profile?.data?.streak_days || 0,
  };
}

// Finalized per-level pillar targets (Learning Mastery / Assessment Champion /
// Scholar Recognition / Consistency-streak). These are the real numbers —
// not a formula anymore — so they can be tuned per-level independently as
// real completion data comes in, without the growth curve dragging every
// level with it.
const PILLAR_TARGETS = {
  1: { learningMastery: 2, assessmentChampion: 3, scholarRecognition: 0, consistency: 2 },
  2: { learningMastery: 4, assessmentChampion: 6, scholarRecognition: 1, consistency: 3 },
  3: { learningMastery: 6, assessmentChampion: 10, scholarRecognition: 1, consistency: 5 },
  4: { learningMastery: 9, assessmentChampion: 15, scholarRecognition: 2, consistency: 7 },
  5: { learningMastery: 12, assessmentChampion: 20, scholarRecognition: 2, consistency: 10 },
  6: { learningMastery: 16, assessmentChampion: 28, scholarRecognition: 3, consistency: 12 },
  7: { learningMastery: 20, assessmentChampion: 36, scholarRecognition: 3, consistency: 14 },
  8: { learningMastery: 26, assessmentChampion: 48, scholarRecognition: 4, consistency: 18 },
  9: { learningMastery: 32, assessmentChampion: 60, scholarRecognition: 5, consistency: 21 },
  10: { learningMastery: 40, assessmentChampion: 75, scholarRecognition: 6, consistency: 30 },
};

// Levels 11–20: same shape as 1–10, capped growth so late-game targets
// stay reachable within a JAMB-length study window rather than exploding.
function pillarTargetsForLevel(level) {
  if (PILLAR_TARGETS[level]) return PILLAR_TARGETS[level];
  const over = level - 10; // levels 11-20 -> 1-10
  return {
    learningMastery: 40 + over * 8,
    assessmentChampion: 75 + over * 15,
    scholarRecognition: 6 + Math.ceil(over / 2),
    consistency: 30, // streak requirement caps at 30 for every level past 10
  };
}

/**
 * Returns whether a student meets the requirements to advance past
 * their current level: mandatory XP + at least 3 of the 4 pillars.
 */
export function evaluateLevelUp(totalPoints, stats) {
  const { nextLevel, nextLevelMinXP, level } = getLevelInfo(totalPoints);

  if (!nextLevel) {
    return { canLevelUp: false, atMaxLevel: true };
  }

  const xpMet = totalPoints >= nextLevelMinXP;
  const targets = pillarTargetsForLevel(level);

  const pillarResults = {
    learningMastery: stats.learningMastery >= targets.learningMastery,
    assessmentChampion: stats.assessmentChampion >= targets.assessmentChampion,
    scholarRecognition: stats.scholarRecognition >= targets.scholarRecognition,
    consistency: stats.consistency >= targets.consistency,
  };

  const pillarsMet = Object.values(pillarResults).filter(Boolean).length;

  return {
    canLevelUp: xpMet && pillarsMet >= 3,
    xpMet,
    pillarsMet,
    pillarResults,
    targets,
    nextLevel,
  };
}
