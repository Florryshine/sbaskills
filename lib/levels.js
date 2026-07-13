// lib/levels.js
// Level/Rank layer on top of the existing user_points.total_points.
// No new table — this is a pure lookup against XP that already exists.
//
// Levels 1–10 are the numbers worked out against SBA's real economy
// (login/quiz/boss/blog/audio/course/streak all feeding one total_points
// column already). Levels 11–20 use a provisional growth formula —
// these are placeholders until real usage data tells us how fast
// students actually accumulate XP; revisit before relying on them.

export const LEVELS = [
  { level: 1, name: 'New Scholar', minXP: 0 },
  { level: 2, name: 'Curious Learner', minXP: 1000 },
  { level: 3, name: 'Active Scholar', minXP: 3000 },
  { level: 4, name: 'Rising Scholar', minXP: 6000 },
  { level: 5, name: 'Dedicated Scholar', minXP: 10000 },
  { level: 6, name: 'Knowledge Explorer', minXP: 15000 },
  { level: 7, name: 'Learning Warrior', minXP: 25000 },
  { level: 8, name: 'Question Slayer', minXP: 40000 },
  { level: 9, name: 'Exam Strategist', minXP: 60000 },
  { level: 10, name: 'SBA Champion', minXP: 100000 },
  // Provisional — tune once real level-10+ students exist.
  { level: 11, name: 'Advanced Scholar', minXP: 140000 },
  { level: 12, name: 'Master Learner', minXP: 190000 },
  { level: 13, name: 'Strategic Thinker', minXP: 250000 },
  { level: 14, name: 'Exam Tactician', minXP: 320000 },
  { level: 15, name: 'Elite Scholar', minXP: 400000 },
  { level: 16, name: 'Elite Warrior', minXP: 500000 },
  { level: 17, name: 'Elite Champion', minXP: 620000 },
  { level: 18, name: 'Elite Strategist', minXP: 750000 },
  { level: 19, name: 'Grandmaster Scholar', minXP: 900000 },
  { level: 20, name: 'SBA Legend', minXP: 1000000 },
];

/**
 * Given a student's lifetime XP (total_points), return their level info.
 */
export function getLevelInfo(xp = 0) {
  const points = Number(xp) || 0;
  let current = LEVELS[0];
  let next = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].minXP) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
    } else {
      break;
    }
  }

  const span = next ? next.minXP - current.minXP : 0;
  const progressIntoLevel = next ? points - current.minXP : 0;
  const progressPct = next ? Math.min(100, Math.round((progressIntoLevel / span) * 100)) : 100;
  const pointsToNext = next ? Math.max(0, next.minXP - points) : 0;

  return {
    level: current.level,
    name: current.name,
    minXP: current.minXP,
    nextLevel: next ? next.level : null,
    nextLevelName: next ? next.name : null,
    nextLevelMinXP: next ? next.minXP : null,
    progressPct,
    pointsToNext,
    isMaxLevel: !next,
  };
}
