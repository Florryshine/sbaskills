// Deterministic particle systems for the Motion Graphics Engine.
// Fields are computed once per scene from a seed so every render is stable.

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Particle field.
 * kinds: dust | sparks | stars | bubbles | embers | confetti | rain
 */
export function ParticleField({ kind = 'dust', count = 26, colors, opacity = 1, seed = 1, intensity = 1 }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const particles = useMemo(() => {
    const list = [];
    const n = Math.round(count * intensity);
    for (let i = 0; i < n; i++) {
      list.push({
        x0: hash2(seed, i * 3 + 1) * width,
        y0: hash2(seed, i * 3 + 2) * height,
        size: kind === 'confetti' ? 10 + hash2(seed, i * 3 + 3) * 14
          : kind === 'rain' ? 1.4
          : 2 + hash2(seed, i * 3 + 3) * (kind === 'stars' ? 4.5 : 5),
        speed: 0.35 + hash2(seed, i * 7 + 4) * (kind === 'sparks' ? 2.2 : kind === 'rain' ? 5.5 : 0.9),
        phase: hash2(seed, i * 7 + 5) * Math.PI * 2,
        colorIndex: Math.floor(hash2(seed, i * 7 + 6) * (colors?.length || 1)),
        rotSpeed: (hash2(seed, i * 11 + 7) - 0.5) * 0.14,
      });
    }
    return list;
  }, [seed, count, kind, width, height, intensity, colors]);

  const baseColor = colors || ['#ffffff'];
  return (
    <div style={{ position: 'absolute', inset: 0, opacity, overflow: 'hidden' }}>
      {particles.map((p, i) => {
        let x = p.x0, y = p.y0, r = p.size, extra = {};
        const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(p.phase + frame * 0.11 * p.speed));
        switch (kind) {
          case 'sparks':
            x = (p.x0 + frame * p.speed * 1.4 * Math.sin(p.phase)) % (width + 60) - 30;
            y = (p.y0 - frame * p.speed * 2.4 + height * 10) % height;
            break;
          case 'stars':
            x = p.x0; y = p.y0;
            break;
          case 'bubbles':
            x = p.x0 + Math.sin(frame * 0.02 * p.speed + p.phase) * 26;
            y = (p.y0 - frame * p.speed * 1.5 + height * 10) % height;
            break;
          case 'embers':
            x = p.x0 + Math.sin(frame * 0.025 * p.speed + p.phase) * 34;
            y = (p.y0 - frame * p.speed * 2.1 + height * 10) % height;
            break;
          case 'confetti':
            x = (p.x0 + Math.sin(frame * 0.03 * p.speed + p.phase) * 44) % width;
            y = (p.y0 + frame * p.speed * 2.0 + height * 10) % height;
            extra = { transform: `rotate(${p.phase * 57 + frame * p.rotSpeed}deg)`, borderRadius: 3 };
            break;
          case 'rain':
            x = (p.x0 + frame * p.speed * 0.6) % width;
            y = (p.y0 + frame * p.speed * 7) % height;
            extra = { height: 26, width: 1.6, borderRadius: 2 };
            break;
          default: // dust
            x = (p.x0 + Math.sin(frame * 0.014 * p.speed + p.phase) * 30 + frame * 0.35) % (width + 40) - 20;
            y = (p.y0 - frame * p.speed * 0.5 + height * 10) % height;
        }
        const color = baseColor[p.colorIndex % baseColor.length];
        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            width: kind === 'rain' ? 1.6 : r,
            height: kind === 'rain' ? 26 : r,
            borderRadius: kind === 'confetti' ? 3 : '50%',
            background: color,
            opacity: (kind === 'stars' || kind === 'sparks') ? twinkle * 0.9 : 0.55,
            boxShadow: kind === 'embers' || kind === 'sparks' ? `0 0 ${r * 2.4}px ${color}` : undefined,
            ...extra,
          }} />
        );
      })}
    </div>
  );
}
