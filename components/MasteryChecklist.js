import { evaluateLevelUp } from '@/lib/mastery';

const PILLAR_LABELS = {
  learningMastery: { label: 'Learning Mastery', emoji: '📚' },
  assessmentChampion: { label: 'Assessment Champion', emoji: '🧠' },
  scholarRecognition: { label: 'Scholar Recognition', emoji: '🏆' },
  consistency: { label: 'Consistency', emoji: '🔥' },
};

export default function MasteryChecklist({ totalPoints, stats }) {
  const evalResult = evaluateLevelUp(totalPoints, stats);

  if (evalResult.atMaxLevel) {
    return (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 text-sm text-gray-500">
        You've hit the top level — SBA Legend. 👑
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4">
      <p className="font-bold text-brand-blue mb-1">
        Level {evalResult.nextLevel} unlocks when: XP requirement {evalResult.xpMet ? '✅' : '⬜'} + any 3 of 4 below
      </p>
      <p className="text-xs text-gray-400 mb-3">
        {evalResult.pillarsMet}/4 completed
      </p>
      <ul className="space-y-1.5">
        {Object.entries(PILLAR_LABELS).map(([key, { label, emoji }]) => {
          const met = evalResult.pillarResults[key];
          const target = evalResult.targets[key];
          const current = stats[key];
          return (
            <li key={key} className="flex items-center justify-between text-sm">
              <span>
                {emoji} {label}
              </span>
              <span className={met ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                {met ? '✅' : `${current}/${target}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
