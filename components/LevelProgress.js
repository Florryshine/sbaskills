'use client';

import { getLevelInfo } from '@/lib/levels';

export default function LevelProgress({ totalPoints = 0, compact = false }) {
  const info = getLevelInfo(totalPoints);

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-blue">
        Lv{info.level} {info.name}
      </span>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-extrabold text-brand-blue">
          Level {info.level} · {info.name}
        </p>
        <p className="text-xs text-gray-500">{totalPoints.toLocaleString()} XP</p>
      </div>
      <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-yellow transition-all"
          style={{ width: `${info.progressPct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">
        {info.isMaxLevel
          ? "You've reached the top rank — SBA Legend."
          : `${info.pointsToNext.toLocaleString()} XP to Level ${info.nextLevel} · ${info.nextLevelName}`}
      </p>
    </div>
  );
}
