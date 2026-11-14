// src/illustrations/biology.ts — biology line-drawing assets.
// Conventions: ~400x400 coordinate space, stroke order teaches
// (outline -> structure -> annotations), fills fade in after outlines.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, wave, cubic, sketchEllipse } from '../geometry/paths';
import { blob, leaf, rect, rrect, hatches, spring } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

// --- Sun -------------------------------------------------------------------
const sun: IllustrationSpec = {
  id: 'biology.sun',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 62, 11), { width: 5, color: 'accent2', fill: 'highlight', fillOpacity: 0.32 }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.12;
      return S(
        sketchLine(
          200 + Math.cos(a) * 78,
          200 + Math.sin(a) * 78,
          200 + Math.cos(a) * (112 + (i % 2 === 0 ? 8 : 0)),
          200 + Math.sin(a) * (112 + (i % 2 === 0 ? 8 : 0)),
          21 + i,
        ),
        { width: 4, color: 'accent2' },
      );
    }),
  ],
};

// --- Potted plant ------------------------------------------------------------
function plantLeaves(): Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> {
  const leaves: Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> = [];
  const spec = [
    { bx: 200, by: 292, tx: 96, ty: 196, w: 30, seed: 31 },
    { bx: 200, by: 292, tx: 306, ty: 188, w: 32, seed: 32 },
    { bx: 200, by: 238, tx: 130, ty: 128, w: 26, seed: 33 },
    { bx: 200, by: 238, tx: 272, ty: 122, w: 27, seed: 34 },
  ];
  for (const L of spec) {
    const { outline, midrib } = leaf(L.bx, L.by, L.tx, L.ty, L.w, L.seed);
    leaves.push(S(outline, { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.16 }));
    leaves.push(S(midrib, { width: 2.5, color: 'accent' }));
  }
  return leaves;
}

const plant: IllustrationSpec = {
  id: 'biology.plant',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchPolyline([[148, 296], [252, 296], [238, 372], [162, 372]], 41, true), { width: 4.5 }), // pot
    S(sketchLine(136, 296, 264, 296, 42, 3, 1.5), { width: 4.5 }), // pot rim
    S(cubic(200, 296, 194, 260, 208, 226, 200, 178), { width: 5, color: 'accent' }), // stem
    ...plantLeaves(),
    S(blob(200, 130, 34, 22, 45, 8, 0.1), { width: 4, color: 'accent2', fill: 'highlight', fillOpacity: 0.2 }), // bud
  ],
};

// --- Leaf with veins ----------------------------------------------------------
// Vein endpoints are computed against the blade outline so they always end
// INSIDE the leaf: blade upper edge y(x) ≈ midY(x) - 55·sin(π(x-100)/240).
const leafVeins: Array<{ d: string; width?: number; color?: string }> = [];
{
  const midY = (x: number) => 205 - (5 * (x - 100)) / 240;
  const halfH = (x: number) => 55 * Math.sin((Math.PI * (x - 100)) / 240);
  const defs: Array<[number, 1 | -1]> = [[160, 1], [205, 1], [250, 1], [288, 1], [160, -1], [205, -1], [250, -1], [288, -1]];
  for (const [mx, side] of defs) {
    const ex = mx - 18;
    const ey = midY(mx) - side * 0.6 * halfH(ex) * 1.0;
    leafVeins.push(S(sketchLine(mx, midY(mx), ex, ey, mx * 3 + side), { width: 2.5, color: 'accent' }));
  }
}

const leafBlade: IllustrationSpec = {
  id: 'biology.leaf',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(100, 205, 140, 140, 260, 140, 340, 200), { width: 5, color: 'accent', fill: 'accent', fillOpacity: 0.13 }),
    S(cubic(340, 200, 260, 262, 140, 262, 100, 205), { width: 5, color: 'accent' }),
    S(sketchLine(100, 205, 340, 200, 61, 2, 1), { width: 3, color: 'accent' }),
    ...leafVeins,
    S(sketchLine(80, 205, 100, 205, 63), { width: 4, color: 'accent' }), // petiole
  ],
};

// --- Water drop ----------------------------------------------------------------
const waterDrop: IllustrationSpec = {
  id: 'biology.water-drop',
  box: { w: 400, h: 400 },
  strokes: [
    S(
      cubic(200, 80, 238, 148, 272, 186, 272, 228) +
        ' C 272 286 242 312 200 312' +
        ' C 158 312 128 286 128 228' +
        ' C 128 186 162 148 200 80',
      { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.14 },
    ),
    S(cubic(168, 224, 160, 254, 170, 272, 184, 280), { width: 3, color: 'accent2' }), // shine
    S(wave(120, 356, 280, 356, 4, 8, 71), { width: 3.5, color: 'accent2' }),
  ],
};

// --- CO2 cloud -------------------------------------------------------------------
const co2Cloud: IllustrationSpec = {
  id: 'biology.co2-cloud',
  box: { w: 400, h: 400 },
  strokes: [
    S(
      cubic(84, 252, 70, 200, 110, 168, 150, 176) +
        ' C 160 132 210 116 246 140' +
        ' C 292 118 336 148 334 190' +
        ' C 368 198 372 246 336 258' +
        ' C 260 274 160 274 84 252',
      { width: 5, color: 'inkSoft', fill: 'inkSoft', fillOpacity: 0.08 },
    ),
    S(cubic(150, 176, 190, 148, 220, 146, 246, 140), { width: 3, color: 'inkSoft' }),
  ],
};

// --- Oxygen bubbles ----------------------------------------------------------------
const o2Bubbles: IllustrationSpec = {
  id: 'biology.o2-bubbles',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(150, 300, 20, 81), { width: 3.5, color: 'accent' }),
    S(sketchCircle(216, 224, 28, 82), { width: 4, color: 'accent' }),
    S(sketchCircle(262, 132, 16, 83), { width: 3.5, color: 'accent' }),
    S(cubic(150, 268, 148, 240, 160, 210, 174, 186), { width: 2.5, color: 'inkSoft' }),
    S(cubic(216, 186, 222, 170, 234, 158, 244, 148), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Chloroplast ---------------------------------------------------------------------
function granaStack(cx: number, cy: number, seed: number): Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> {
  const out: Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> = [];
  for (let i = 0; i < 3; i++) {
    out.push(S(rrect(cx - 28, cy + i * 17 - 8, 56, 15, seed * 10 + i, 7), { width: 3, color: 'accent', fill: 'accent', fillOpacity: 0.2 }));
  }
  return out;
}

const chloroplast: IllustrationSpec = {
  id: 'biology.chloroplast',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchEllipse(200, 205, 158, 88, 91), { width: 5, color: 'accent', fill: 'accent', fillOpacity: 0.07 }),
    S(sketchEllipse(200, 205, 146, 76, 92), { width: 3, color: 'accent' }),
    ...granaStack(150, 175, 5),
    ...granaStack(245, 230, 6),
    S(sketchCircle(190, 255, 13, 93), { width: 3, color: 'accent' }),
    S(sketchCircle(258, 172, 12, 94), { width: 3, color: 'accent' }),
    S(sketchCircle(140, 240, 10, 95), { width: 3, color: 'accent' }),
  ],
};

// --- Tree ----------------------------------------------------------------------------
const tree: IllustrationSpec = {
  id: 'biology.tree',
  box: { w: 400, h: 400 },
  strokes: [
    S(blob(200, 148, 118, 86, 101, 10, 0.1), { width: 5, color: 'accent', fill: 'accent', fillOpacity: 0.13 }),
    S(sketchLine(172, 232, 168, 330, 102, 3, 2), { width: 5 }),
    S(sketchLine(212, 236, 220, 332, 103, 3, 2), { width: 5 }),
    S(sketchLine(168, 330, 220, 332, 104, 2, 1), { width: 4 }),
    S(sketchLine(80, 352, 330, 350, 105, 4, 2), { width: 4, color: 'inkSoft' }), // ground
  ],
};

// --- Flower ----------------------------------------------------------------------------
const flower: IllustrationSpec = {
  id: 'biology.flower',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 150, 26, 111), { width: 4.5, color: 'accent2', fill: 'highlight', fillOpacity: 0.3 }),
    ...Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2 + 0.26;
      const tipX = 200 + Math.cos(a) * 74;
      const tipY = 150 + Math.sin(a) * 74;
      const L = leaf(200 + Math.cos(a) * 24, 150 + Math.sin(a) * 24, tipX, tipY, 24, 120 + i);
      return S(L.outline, { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.12 });
    }),
    S(cubic(200, 220, 196, 260, 206, 300, 198, 344), { width: 5, color: 'accent' }), // stem
    (() => {
      const L = leaf(199, 290, 268, 252, 20, 130);
      return S(L.outline, { width: 3.5, color: 'accent', fill: 'accent', fillOpacity: 0.14 });
    })(),
  ],
};

// --- Animal cell ------------------------------------------------------------------------
const cell: IllustrationSpec = {
  id: 'biology.cell',
  box: { w: 400, h: 400 },
  strokes: [
    S(blob(200, 200, 168, 122, 141, 11, 0.07), { width: 5, color: 'ink', fill: 'accent', fillOpacity: 0.05 }),
    S(blob(200, 200, 156, 110, 142, 11, 0.06), { width: 2.5, color: 'inkSoft' }),
    S(sketchCircle(158, 182, 44, 143), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.2 }),
    S(sketchCircle(158, 182, 18, 144), { width: 3, color: 'accent' }),
    S(blob(262, 232, 34, 20, 145, 7, 0.12), { width: 3, color: 'accent2' }),
    S(blob(250, 146, 26, 16, 146, 7, 0.12), { width: 3, color: 'accent2' }),
    S(sketchCircle(300, 196, 12, 147), { width: 3, color: 'inkSoft' }),
    S(sketchCircle(214, 282, 11, 148), { width: 3, color: 'inkSoft' }),
    S(blob(130, 268, 22, 13, 149, 6, 0.12), { width: 3, color: 'inkSoft' }),
  ],
};

// --- DNA helix ---------------------------------------------------------------------------
function dnaStrand(phase: 1 | -1, seed: number): string {
  let d = `M 160 60`;
  const amp = 46;
  for (let i = 0; i < 7; i++) {
    const y1 = 60 + i * 40;
    const y2 = y1 + 40;
    const dir = i % 2 === 0 ? phase : -phase;
    d += ` C 160 ${y1 + 10} ${160 + dir * amp * 1.5} ${y1 + 14} ${160 + dir * amp} ${y1 + 24} C 160 ${y1 + 34} 160 ${y2 - 8} 160 ${y2}`;
  }
  void seed;
  return d;
}

function dnaRungs(): string {
  const parts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const y = 78 + i * 40;
    const amp = 46;
    const x1 = 160 - amp * Math.sin((Math.PI * (i % 2)) / 2);
    const x2 = 160 + amp * Math.sin((Math.PI * (i % 2)) / 2);
    parts.push(sketchLine(x1, y, x2, y, 161 + i, 2, 1));
  }
  return parts.join(' ');
}

const dna: IllustrationSpec = {
  id: 'biology.dna',
  box: { w: 400, h: 400 },
  strokes: [
    S(dnaStrand(1, 171), { width: 4, color: 'accent' }),
    S(dnaStrand(-1, 172), { width: 4, color: 'accent2' }),
    S(dnaRungs(), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Root system ---------------------------------------------------------------------------
const roots: IllustrationSpec = {
  id: 'biology.roots',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(90, 110, 310, 108, 181, 4, 2), { width: 4.5, color: 'inkSoft' }), // soil line
    S(hatches(90, 110, 310, 108, 9, 14, 182), { width: 2.5, color: 'inkSoft' }),
    S(cubic(200, 108, 196, 170, 206, 220, 200, 290), { width: 5 }),
    S(cubic(200, 170, 172, 200, 140, 240, 118, 286), { width: 3.5 }),
    S(cubic(200, 180, 230, 210, 262, 248, 286, 282), { width: 3.5 }),
    S(cubic(200, 240, 182, 268, 168, 300, 160, 330), { width: 3 }),
    S(cubic(200, 250, 222, 280, 238, 310, 246, 336), { width: 3 }),
  ],
};

// --- Germinating seed (growth) ---------------------------------------------------------------
const seedling: IllustrationSpec = {
  id: 'biology.seedling',
  box: { w: 400, h: 400 },
  strokes: [
    S(blob(200, 300, 66, 34, 191, 8, 0.06), { width: 4.5, color: 'inkSoft' }), // soil mound
    S(cubic(200, 276, 204, 240, 196, 210, 200, 172), { width: 5, color: 'accent' }),
    (() => {
      const L = leaf(200, 176, 130, 122, 22, 192);
      return S(L.outline, { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.16 });
    })(),
    (() => {
      const L = leaf(200, 176, 274, 118, 23, 193);
      return S(L.outline, { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.16 });
    })(),
  ],
};

export const BIOLOGY_ASSETS: IllustrationSpec[] = [
  sun,
  plant,
  leafBlade,
  waterDrop,
  co2Cloud,
  o2Bubbles,
  chloroplast,
  tree,
  flower,
  cell,
  dna,
  roots,
  seedling,
];

// Re-exported builders for composite scenes
export { granaStack, leaf, rect, spring };
