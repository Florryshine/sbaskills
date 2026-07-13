// lib/badges.js
// Fixes the audit finding: achievements were never actually being written
// to user_achievements. This checks a student's stats against any
// achievement that has requirement_type/requirement_value set (see
// migration 003) and awards the ones they newly qualify for.
//
// Call awardEligibleBadges(supabase, userId) after any XP-earning action
// (quiz, boss battle, streak update, etc.) — cheap: one query per pillar,
// already computed by getMasteryStats.

import { getMasteryStats } from './mastery';
import { addPoints } from './gamification';

const STAT_KEY_BY_REQUIREMENT = {
  streak: 'consistency',
  learning_mastery: 'learningMastery',
  assessment_champion: 'assessmentChampion',
  scholar_recognition: 'scholarRecognition',
};

export async function awardEligibleBadges(supabase, userId) {
  const [{ data: candidates }, { data: earned }, { data: pointsRow }, stats] = await Promise.all([
    supabase.from('achievements').select('*').not('requirement_type', 'is', null),
    supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
    supabase.from('user_points').select('total_points').eq('user_id', userId).maybeSingle(),
    getMasteryStats(supabase, userId),
  ]);

  const earnedIds = new Set((earned || []).map((e) => e.achievement_id));
  const totalPoints = pointsRow?.total_points || 0;
  const newlyAwarded = [];

  for (const ach of candidates || []) {
    if (earnedIds.has(ach.id)) continue;

    const value =
      ach.requirement_type === 'xp' ? totalPoints : stats[STAT_KEY_BY_REQUIREMENT[ach.requirement_type]];

    if (value === undefined || ach.requirement_value === null) continue;

    if (value >= ach.requirement_value) {
      const { error } = await supabase
        .from('user_achievements')
        .insert({ user_id: userId, achievement_id: ach.id });

      if (!error) {
        newlyAwarded.push(ach);
        if (ach.xp) {
          await addPoints(userId, ach.xp, `Earned achievement: ${ach.title || ach.name}`, 'achievement', ach.id);
        }
      }
    }
  }

  return newlyAwarded;
}
