// src/illustrations/chemistry.ts — chemistry line-drawing assets.

import type { IllustrationSpec, LabelSpec } from '../types';
import { sketchCircle, sketchLine, wave, cubic, sketchEllipse, arrowHead } from '../geometry/paths';
import { blob, rect, hatches, rrect } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

// --- Single particle (proton / neutron / electron) -----------------------------
function particle(id: string, symbol: string, color: string, fill: string, fillOpacity: number): IllustrationSpec {
  return {
    id,
    box: { w: 400, h: 400 },
    strokes: [S(sketchCircle(200, 200, 92, symbol.charCodeAt(0) + 300), { width: 5, color, fill, fillOpacity })],
    labels: [{ text: symbol, x: 200, y: 200, size: 84, color, align: 'middle' } as unknown as LabelSpec],
  };
}

const proton = particle('chemistry.proton', '+', 'accent2', 'accent2', 0.16);
const neutron = particle('chemistry.neutron', '0', 'inkSoft', 'inkSoft', 0.12);
const electron = particle('chemistry.electron', '\u2212', 'accent', 'accent', 0.16);

// --- Nucleus cluster ------------------------------------------------------------
function cluster(seedOffset: number): Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> {
  const defs: Array<[number, number, 'p' | 'n']> = [
    [200, 168, 'p'], [244, 196, 'p'], [196, 224, 'n'], [238, 252, 'p'],
    [156, 208, 'n'], [160, 258, 'p'], [286, 232, 'n'], [206, 282, 'n'],
  ];
  return defs.map(([x, y, kind], i) =>
    S(sketchCircle(x, y, 27, seedOffset + i * 13), {
      width: 4,
      color: kind === 'p' ? 'accent2' : 'inkSoft',
      fill: kind === 'p' ? 'accent2' : 'inkSoft',
      fillOpacity: kind === 'p' ? 0.14 : 0.1,
    }),
  );
}

const nucleus: IllustrationSpec = {
  id: 'chemistry.nucleus',
  box: { w: 400, h: 400 },
  strokes: cluster(200),
};

// --- Classic atom (planetary orbits) ---------------------------------------------
function orbitElectrons(): Array<{ d: string; width?: number; color?: string }> {
  const out: Array<{ d: string; width?: number; color?: string }> = [];
  const rotations = [0, 60, 120];
  const angles = [-30, 80, 200]; // parametric angle on ellipse per orbit
  rotations.forEach((rot, i) => {
    const rr = (angles[i] * Math.PI) / 180;
    const rotR = (rot * Math.PI) / 180;
    const ex = 150 * Math.cos(rr);
    const ey = 58 * Math.sin(rr);
    const x = 200 + ex * Math.cos(rotR) - ey * Math.sin(rotR);
    const y = 200 + ex * Math.sin(rotR) + ey * Math.cos(rotR);
    out.push(S(sketchCircle(x, y, 13, 310 + i * 7), { width: 3.5, color: 'accent' }));
  });
  return out;
}

const atom: IllustrationSpec = {
  id: 'chemistry.atom',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchEllipse(200, 200, 150, 58, 301), { width: 3.5, color: 'inkSoft' }),
    S(sketchEllipse(200, 200, 150, 58, 302, 60), { width: 3.5, color: 'inkSoft' }),
    S(sketchEllipse(200, 200, 150, 58, 303, 120), { width: 3.5, color: 'inkSoft' }),
    S(sketchCircle(200, 200, 30, 304), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.2 }),
    ...orbitElectrons(),
  ],
};

// --- Bohr shell diagram (parametrized shell counts) --------------------------------
export function bohrAtom(shellCounts: number[], id: string, seed = 400): IllustrationSpec {
  const maxR = 178;
  const nucleusR = 26;
  const strokes: Array<{ d: string; width?: number; color?: string; fill?: string; fillOpacity?: number }> = [
    S(sketchCircle(200, 200, nucleusR, seed), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.18 }),
  ];
  shellCounts.forEach((count, shellIdx) => {
    const r = nucleusR + 42 + ((maxR - nucleusR - 42) * shellIdx) / Math.max(1, shellCounts.length - 1);
    strokes.push(S(sketchCircle(200, 200, r, seed + shellIdx * 11), { width: 3.5, color: 'inkSoft' }));
    for (let e = 0; e < count; e++) {
      const a = (e / count) * Math.PI * 2 - Math.PI / 2 + shellIdx * 0.5;
      strokes.push(
        S(sketchCircle(200 + Math.cos(a) * r, 200 + Math.sin(a) * r, 11, seed + 50 + shellIdx * 20 + e), {
          width: 3,
          color: 'accent',
          fill: 'accent',
          fillOpacity: 0.3,
        }),
      );
    }
  });
  return { id, box: { w: 400, h: 400 }, strokes };
}

const bohrCarbon = bohrAtom([2, 4], 'chemistry.bohr-carbon', 401);
const bohrSodium = bohrAtom([2, 8, 1], 'chemistry.bohr-sodium', 402);
const bohrOxygen = bohrAtom([2, 6], 'chemistry.bohr-oxygen', 403);

// --- Water molecule -----------------------------------------------------------------
const h2o: IllustrationSpec = {
  id: 'chemistry.h2o',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 232, 62, 411), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.13 }),
    S(sketchCircle(112, 140, 40, 412), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.12 }),
    S(sketchCircle(288, 140, 40, 413), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.12 }),
    S(sketchLine(160, 186, 134, 174, 414), { width: 4 }),
    S(sketchLine(240, 186, 266, 174, 415), { width: 4 }),
  ],
  labels: [
    { text: 'O', x: 200, y: 232, size: 52, color: 'ink', align: 'middle' },
    { text: 'H', x: 112, y: 140, size: 40, color: 'ink', align: 'middle' },
    { text: 'H', x: 288, y: 140, size: 40, color: 'ink', align: 'middle' },
  ],
};

// --- CO2 molecule ---------------------------------------------------------------------
const co2: IllustrationSpec = {
  id: 'chemistry.co2-molecule',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 48, 421), { width: 5, color: 'ink', fill: 'inkSoft', fillOpacity: 0.12 }),
    S(sketchCircle(72, 200, 52, 422), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.13 }),
    S(sketchCircle(328, 200, 52, 423), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.13 }),
    S(sketchLine(152, 188, 124, 188, 424), { width: 3.5 }),
    S(sketchLine(152, 212, 124, 212, 425), { width: 3.5 }),
    S(sketchLine(248, 188, 276, 188, 426), { width: 3.5 }),
    S(sketchLine(248, 212, 276, 212, 427), { width: 3.5 }),
  ],
  labels: [
    { text: 'C', x: 200, y: 200, size: 44, color: 'ink', align: 'middle' },
    { text: 'O', x: 72, y: 200, size: 44, color: 'ink', align: 'middle' },
    { text: 'O', x: 328, y: 200, size: 44, color: 'ink', align: 'middle' },
  ],
};

// --- Methane ----------------------------------------------------------------------------
const ch4: IllustrationSpec = {
  id: 'chemistry.ch4',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 52, 431), { width: 5, color: 'ink', fill: 'inkSoft', fillOpacity: 0.12 }),
    ...[
      [118, 118], [282, 118], [118, 282], [282, 282],
    ].map(([x, y], i) => S(sketchCircle(x, y, 36, 432 + i), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.12 })),
    S(sketchLine(166, 166, 148, 148, 436), { width: 4 }),
    S(sketchLine(234, 166, 252, 148, 437), { width: 4 }),
    S(sketchLine(166, 234, 148, 252, 438), { width: 4 }),
    S(sketchLine(234, 234, 252, 252, 439), { width: 4 }),
  ],
  labels: [
    { text: 'C', x: 200, y: 200, size: 44, color: 'ink', align: 'middle' },
    { text: 'H', x: 118, y: 118, size: 36, color: 'ink', align: 'middle' },
    { text: 'H', x: 282, y: 118, size: 36, color: 'ink', align: 'middle' },
    { text: 'H', x: 118, y: 282, size: 36, color: 'ink', align: 'middle' },
    { text: 'H', x: 282, y: 282, size: 36, color: 'ink', align: 'middle' },
  ],
};

// --- Beaker -------------------------------------------------------------------------------
const beaker: IllustrationSpec = {
  id: 'chemistry.beaker',
  box: { w: 400, h: 400 },
  strokes: [
    S(
      'M 132 84 L 132 296 C 132 312 142 318 158 318 L 242 318 C 258 318 268 312 268 296 L 268 84',
      { width: 5, color: 'ink' },
    ),
    S(sketchLine(116, 84, 284, 84, 441, 3, 1.5), { width: 4.5, color: 'ink' }),
    S(
      'M 136 214 L 264 214 L 264 296 C 264 310 254 314 242 314 L 158 314 C 146 314 136 310 136 296 Z',
      { width: 3.5, color: 'accent2', fill: 'accent2', fillOpacity: 0.16, afterStroke: 1 },
    ),
    S(wave(136, 214, 264, 214, 4, 6, 442), { width: 3.5, color: 'accent2' }),
    S(sketchCircle(186, 258, 11, 443), { width: 3, color: 'inkSoft' }),
    S(sketchCircle(226, 240, 8, 444), { width: 3, color: 'inkSoft' }),
    S(sketchCircle(204, 284, 7, 445), { width: 3, color: 'inkSoft' }),
  ],
};

// --- Test tube ------------------------------------------------------------------------------
const testTube: IllustrationSpec = {
  id: 'chemistry.test-tube',
  box: { w: 400, h: 400 },
  strokes: [
    S('M 156 76 L 156 268 C 156 300 174 314 200 314 C 226 314 244 300 244 268 L 244 76', { width: 5, color: 'ink' }),
    S(sketchLine(142, 76, 258, 76, 451, 3, 1.2), { width: 4.5, color: 'ink' }),
    S(
      'M 158 236 L 242 236 L 242 268 C 242 296 226 310 200 310 C 174 310 158 296 158 268 Z',
      { width: 3.5, color: 'accent', fill: 'accent', fillOpacity: 0.16, afterStroke: 1 },
    ),
    S(wave(158, 236, 242, 236, 3, 5, 452), { width: 3, color: 'accent' }),
  ],
};

// --- Flame ------------------------------------------------------------------------------------
const flame: IllustrationSpec = {
  id: 'chemistry.flame',
  box: { w: 400, h: 400 },
  strokes: [
    S(
      cubic(200, 68, 244, 128, 268, 172, 268, 216) +
        ' C 268 278 238 306 200 306 C 162 306 132 278 132 216 C 132 172 156 128 200 68',
      { width: 5, color: 'accent2', fill: 'highlight', fillOpacity: 0.22 },
    ),
    S(
      cubic(200, 176, 222, 210, 230, 234, 230, 254) + ' C 230 284 216 296 200 296 C 184 296 170 284 170 254 C 170 234 178 210 200 176',
      { width: 3.5, color: 'accent2' },
    ),
    S(sketchLine(200, 316, 200, 344, 461), { width: 4 }),
    S(sketchLine(140, 344, 260, 344, 462, 3, 1.5), { width: 4.5 }),
  ],
};

// --- Conical flask ------------------------------------------------------------------------------
const flask: IllustrationSpec = {
  id: 'chemistry.flask',
  box: { w: 400, h: 400 },
  strokes: [
    S('M 168 76 L 168 168 L 106 296 C 98 314 108 322 126 322 L 274 322 C 292 322 302 314 294 296 L 232 168 L 232 76', {
      width: 5,
      color: 'ink',
    }),
    S(sketchLine(152, 76, 248, 76, 471, 3, 1.2), { width: 4.5, color: 'ink' }),
    S('M 136 238 L 264 238 L 292 296 C 300 312 290 318 274 318 L 126 318 C 110 318 100 312 108 296 Z', {
      width: 3.5,
      color: 'accent',
      fill: 'accent',
      fillOpacity: 0.16,
      afterStroke: 0,
    }),
    S(sketchCircle(180, 280, 10, 472), { width: 3, color: 'inkSoft' }),
    S(sketchCircle(226, 262, 8, 473), { width: 3, color: 'inkSoft' }),
  ],
};

export const CHEMISTRY_ASSETS: IllustrationSpec[] = [
  proton,
  neutron,
  electron,
  nucleus,
  atom,
  bohrCarbon,
  bohrSodium,
  bohrOxygen,
  h2o,
  co2,
  ch4,
  beaker,
  testTube,
  flame,
  flask,
];

export { particle, rect, hatches, rrect, blob };
