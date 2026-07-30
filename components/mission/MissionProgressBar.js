// components/mission/MissionProgressBar.js
//
// Simple step progress bar for inside an active mission. Dumb/presentational
// — takes steps with a `completed` boolean and renders filled vs empty.

'use client';

const ACTIVITY_ICON = {
  study_note: '📖',
  video: '🎥',
  podcast: '🎧',
  flashcards: '🃏',
  memory_game: '🧠',
  quiz: '❓',
  boss_battle: '⚔️',
};

export default function MissionProgressBar({ steps }) {
  const doneCount = steps.filter((s) => s.completed).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 0;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          height: '0.5rem',
          background: '#e5e7eb',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: '#16a34a',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
        {steps.map((step, i) => (
          <div
            key={i}
            title={step.type}
            style={{
              fontSize: '0.85rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              background: step.completed ? '#dcfce7' : '#f3f4f6',
              color: step.completed ? '#166534' : '#6b7280',
              fontWeight: 600,
            }}
          >
            {step.completed ? '✅' : ACTIVITY_ICON[step.type] || '•'} {step.type.replace('_', ' ')}
          </div>
        ))}
      </div>

      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.4rem' }}>
        {doneCount}/{steps.length} steps
      </div>
    </div>
  );
}
