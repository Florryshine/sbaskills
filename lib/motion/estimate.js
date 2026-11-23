// Duration + timing helpers shared by the Motion Graphics worker and tests.
// Mirrors the word-timing approach the Cartoon worker uses so narration and
// on-screen emphasis stay in sync.

export function wordsFor(text, duration, lead = 0.22) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || duration <= 0) return [];
  const span = Math.max(0.3, duration - lead - 0.08);
  const weights = words.map((w) => Math.max(2, w.replace(/[^\w]/g, '').length) + 1.2);
  const total = weights.reduce((a, b) => a + b, 0);
  let t = lead;
  return words.map((word, i) => {
    const d = (span * weights[i]) / total;
    const item = { word, start: Number(t.toFixed(3)), end: Number((t + d).toFixed(3)) };
    t += d;
    return item;
  });
}

export function estimateDurationSeconds(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (!words) return 2.2;
  return Math.max(2.2, Math.min(16, words / 2.6 + 1.1));
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
