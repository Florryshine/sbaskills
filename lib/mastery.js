// lib/mastery.js
// The 4-pillar level-up system: XP is mandatory, plus 3-of-4 from
// Learning Mastery, Assessment Champion, Scholar Recognition, Consistency.
//
// Every number here reads from tables/columns that already exist —
// no new schema. Pillar THRESHOLDS below are a working placeholder
// formula (documented in the design conversation as "still to be
// worked out level-by-level") — tune once you have real completion
// data, this just makes the framework functional today.

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

// Provisional per-level pillar targets — scale with level index.
// Placeholder formula, not a finalized design.
function pillarTargetsForLevel(level) {
  return {
    learningMastery: level * 3,
    assessmentChampion: level * 5,
    scholarRecognition: Math.ceil(level / 3),
    consistency: Math.min(level * 2, 30), // cap streak requirement at 30 days
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
