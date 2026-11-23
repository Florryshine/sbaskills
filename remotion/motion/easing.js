// Easing + timing utilities for the Motion Graphics Engine (render side).
// Pure functions so every frame is a deterministic function of its inputs.

export const EASINGS = {
  linear: (t) => t,
  quadIn: (t) => t * t,
  quadOut: (t) => 1 - (1 - t) * (1 - t),
  cubicIn: (t) => t * t * t,
  cubicOut: (t) => 1 - Math.pow(1 - t, 3),
  quartOut: (t) => 1 - Math.pow(1 - t, 4),
  quintOut: (t) => 1 - Math.pow(1 - t, 5),
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  expoIn: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  backOut: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  backIn: (t) => 2.2 * t * t * t - 1.2 * t * t,
  elasticOut: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 4.2)) + 1;
  },
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

export function ease(name, t) {
  const fn = EASINGS[name] || EASINGS.expoOut;
  return fn(Math.max(0, Math.min(1, t)));
}

/** Frame-window helper: normalized progress of `frame` inside [start, end]. */
export function window(frame, start, end) {
  if (end <= start) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / (end - start)));
}

/** Cheap deterministic pseudo-noise for organic drift (no Math.random). */
export function drift(t, seedA = 1.7, seedB = 2.3) {
  return (
    Math.sin(t * seedA) * 0.6 +
    Math.sin(t * seedB + 1.3) * 0.4
  );
}

export const staggerDelay = (i, base, step) => base + i * step;
