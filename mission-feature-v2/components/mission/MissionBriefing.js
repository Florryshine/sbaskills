// components/mission/MissionBriefing.js
//
// The screen a student sees after tapping a node on the World Map, before
// any activity starts. Shows what they'll learn and what they'll earn.
// Pure presentational component — takes a Mission object (from
// lib/journeyEngine.js via the /api/mission/[assetId] route) and a
// callback for when they hit "Start Mission".

'use client';

const ACTIVITY_LABEL = {
  study_note: '📖 Study Note',
  video: '🎥 Video',
  podcast: '🎧 Podcast',
  flashcards: '🃏 Flashcards',
  topic_games: '🧠 Topic Games',
  quiz: '❓ Quiz',
  boss_battle: '⚔️ Boss Battle',
};

export default function MissionBriefing({ mission, onStart }) {
  if (!mission) return null;

  if (mission.isEmpty) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>{mission.title}</h2>
        <p style={{ color: '#6b7280' }}>
          This topic doesn&apos;t have any published content yet. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 600 }}>
        {mission.subject}
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem' }}>
        📘 {mission.title}
      </h1>

      {mission.estimatedMinutes ? (
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          ~{mission.estimatedMinutes} min
        </p>
      ) : null}

      {mission.objectives?.length > 0 && (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Objectives</h2>
          <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
            {mission.objectives.map((obj, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>{obj}</li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ marginTop: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>This mission</h2>
        <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
          {mission.steps.map((step, i) => (
            <li key={i} style={{ marginBottom: '0.25rem' }}>
              {ACTIVITY_LABEL[step.type] || step.type}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: '1.25rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Rewards</h2>
        <div style={{ marginTop: '0.5rem', color: '#374151' }}>
          <div>⭐ {mission.rewards.totalXp} XP total</div>
          <div>🏅 Bronze badge on completion</div>
          <div>🎁 Unlocks the next topic</div>
        </div>
      </section>

      <button
        onClick={onStart}
        style={{
          marginTop: '2rem',
          width: '100%',
          padding: '0.9rem',
          fontSize: '1rem',
          fontWeight: 700,
          color: 'white',
          background: '#2563eb',
          border: 'none',
          borderRadius: '0.75rem',
          cursor: 'pointer',
        }}
      >
        Start Mission
      </button>
    </div>
  );
}
