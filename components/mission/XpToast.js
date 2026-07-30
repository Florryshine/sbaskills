// components/mission/XpToast.js
//
// Tiny transient "+XP" toast shown after each mission step completes.
// Deliberately dumb: no data fetching, just renders what it's given and
// disappears after a couple seconds. Parent (MissionRunner) controls when
// it's shown.

'use client';

import { useEffect, useState } from 'react';

export default function XpToast({ amount, label, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: '5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#16a34a',
        color: 'white',
        padding: '0.5rem 1rem',
        borderRadius: '9999px',
        fontWeight: 600,
        fontSize: '0.9rem',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 50,
        animation: 'xp-toast-in 0.25s ease-out',
      }}
    >
      +{amount} XP {label ? `· ${label}` : ''}
      <style jsx>{`
        @keyframes xp-toast-in {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
