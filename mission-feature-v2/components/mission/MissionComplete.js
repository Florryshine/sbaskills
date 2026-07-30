// components/mission/MissionComplete.js
//
// Big celebration shown once every step in a mission is done. Deliberately
// separate from the per-step XpToast — this is the "one big moment" after
// several small dopamine hits, per the design discussion.

'use client';

export default function MissionComplete({ mission, tier, onContinue }) {
  const tierLabel = { bronze: '🥉 Bronze', silver: '🥈 Silver', gold: '🥇 Gold' }[tier] || '🥉 Bronze';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: 400,
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem' }}>🎉</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.5rem' }}>
          Mission Complete!
        </h2>
        <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>{mission.title}</p>

        <div style={{ marginTop: '1.25rem', fontSize: '1.1rem', fontWeight: 600 }}>
          {tierLabel} earned
        </div>
        <div style={{ marginTop: '0.5rem', color: '#374151' }}>
          +{mission.rewards.bonusXp} bonus XP
        </div>

        <button
          onClick={onContinue}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            padding: '0.8rem',
            fontWeight: 700,
            color: 'white',
            background: '#2563eb',
            border: 'none',
            borderRadius: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Back to World Map
        </button>
      </div>
    </div>
  );
}
