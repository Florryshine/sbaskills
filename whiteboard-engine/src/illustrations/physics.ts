// src/illustrations/physics.ts — physics line-drawing assets.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, cubic, sketchEllipse, wave, arrowHead } from '../geometry/paths';
import { rect, hatches, dashedArc, rrect } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

// --- Isometric crate ------------------------------------------------------------------------
const crate: IllustrationSpec = {
  id: 'physics.crate',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchPolygon([[120, 190], [262, 190], [262, 318], [120, 318]], 501), { width: 5, fill: 'inkSoft', fillOpacity: 0.07 }),
    S(sketchPolygon([[120, 190], [168, 148], [310, 148], [262, 190]], 502), { width: 4.5 }),
    S(sketchPolygon([[262, 190], [310, 148], [310, 276], [262, 318]], 503), { width: 4.5 }),
    S(sketchLine(120, 254, 262, 254, 504), { width: 2.5, color: 'inkSoft' }),
    S(sketchLine(191, 190, 191, 318, 505), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Block resting on a table ------------------------------------------------------------------
const blockTable: IllustrationSpec = {
  id: 'physics.block-table',
  box: { w: 400, h: 400 },
  strokes: [
    S(rect(118, 208, 164, 118, 511), { width: 5, fill: 'inkSoft', fillOpacity: 0.08 }),
    S(sketchLine(60, 326, 360, 326, 512, 4, 2), { width: 5 }),
    S(hatches(60, 326, 360, 326, 12, 14, 513), { width: 2.5, color: 'inkSoft' }),
    S(sketchLine(88, 326, 88, 388, 514), { width: 4.5 }),
    S(sketchLine(330, 326, 330, 388, 515), { width: 4.5 }),
  ],
};

// --- Rolling ball on a surface -------------------------------------------------------------------
const ballRolling: IllustrationSpec = {
  id: 'physics.ball-rolling',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(216, 218, 74, 521), { width: 5, color: 'accent', fill: 'accent', fillOpacity: 0.1 }),
    S(dashedArc(216, 218, 52, 200, 340, 522), { width: 3, color: 'inkSoft' }),
    S(arrowHead(216 + 52 * Math.cos(340 * Math.PI / 180), 218 + 52 * Math.sin(340 * Math.PI / 180), 340 * Math.PI / 180 + Math.PI / 2, 12, 523), { width: 3, color: 'inkSoft' }),
    S(sketchLine(30, 318, 380, 316, 524, 4, 2), { width: 5 }),
    S(sketchLine(64, 236, 118, 232, 525), { width: 3.5, color: 'inkSoft' }),
    S(sketchLine(52, 268, 112, 266, 526), { width: 3.5, color: 'inkSoft' }),
    S(sketchLine(66, 300, 120, 298, 527), { width: 3.5, color: 'inkSoft' }),
  ],
};

// --- Ice puck -------------------------------------------------------------------------------------
const icePuck: IllustrationSpec = {
  id: 'physics.ice-puck',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchEllipse(230, 268, 62, 20, 531), { width: 5, color: 'accent' }),
    S(sketchEllipse(230, 254, 62, 20, 532), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.1 }),
    S(sketchLine(168, 254, 168, 268, 533), { width: 4.5, color: 'accent' }),
    S(sketchLine(292, 254, 292, 268, 534), { width: 4.5, color: 'accent' }),
    S(sketchLine(20, 318, 390, 316, 535, 4, 2), { width: 5, color: 'inkSoft' }),
    S(wave(24, 300, 150, 298, 3, 5, 536), { width: 2.5, color: 'inkSoft' }),
    S(wave(60, 330, 190, 328, 3, 5, 537), { width: 2.5, color: 'inkSoft' }),
    S(sketchLine(60, 268, 118, 266, 538), { width: 3.5, color: 'inkSoft' }),
    S(sketchLine(48, 236, 100, 234, 539), { width: 3.5, color: 'inkSoft' }),
  ],
};

// --- Pendulum --------------------------------------------------------------------------------------
const pendulum: IllustrationSpec = {
  id: 'physics.pendulum',
  box: { w: 400, h: 400 },
  strokes: [
    S(hatches(96, 84, 304, 84, 10, 14, 541), { width: 3, color: 'inkSoft' }),
    S(sketchLine(96, 84, 304, 84, 542, 3, 1.5), { width: 5 }),
    S(sketchCircle(200, 92, 9, 543), { width: 4, color: 'ink' }),
    S(sketchLine(200, 92, 148, 262, 544, 2, 1), { width: 4.5 }),
    S(sketchCircle(148, 296, 36, 545), { width: 5, color: 'accent', fill: 'accent', fillOpacity: 0.12 }),
    S(dashedArc(200, 92, 214, 100, 80, 546), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Spring + wall -----------------------------------------------------------------------------------
const springBlock: IllustrationSpec = {
  id: 'physics.spring-block',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(84, 96, 84, 320, 551, 3, 1.5), { width: 5 }),
    S(hatches(84, 96, 84, 320, 9, 14, 552), { width: 2.5, color: 'inkSoft' }),
    // spring drawn as zigzag via spring() helper
    S((() => {
      const pts: Array<[number, number]> = [[84, 208]];
      for (let i = 1; i <= 12; i++) {
        const x = 84 + ((236 - 84) * i) / 13;
        pts.push([x, 208 + (i % 2 === 1 ? -17 : 17)]);
      }
      pts.push([236, 208]);
      return sketchPolyline(pts, 553);
    })(), { width: 4 }),
    S(rect(236, 156, 104, 104, 554), { width: 5, fill: 'accent', fillOpacity: 0.1 }),
    S(sketchLine(236, 182, 340, 182, 555), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Newton's cradle ------------------------------------------------------------------------------------
const cradle: IllustrationSpec = {
  id: 'physics.cradle',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(72, 108, 328, 106, 561, 4, 2), { width: 5.5 }),
    S(sketchLine(72, 106, 72, 318, 562), { width: 5 }),
    S(sketchLine(328, 106, 328, 318, 563), { width: 5 }),
    S(sketchLine(52, 318, 348, 318, 564, 4, 2), { width: 5.5 }),
    ...[116, 171, 229, 284].map((x, i) => S(sketchLine(x, 106, x + (i === 0 ? 4 : 0), 250, 565 + i, 2, 1), { width: 3, color: 'inkSoft' })),
    ...[116, 171, 229, 284].map((x, i) => S(sketchCircle(x, 274, 25, 571 + i), { width: 4.5, color: 'accent', fill: 'accent', fillOpacity: 0.14 })),
  ],
};

// --- Car (side view) ----------------------------------------------------------------------------------------
function carBody(seed: number): string {
  return (
    'M 52 268 L 52 236 C 52 220 64 214 84 212 L 136 206 L 172 168 C 180 160 190 158 202 158 L 258 160 C 270 162 282 172 296 194 L 312 206 L 344 212 C 356 216 360 224 360 236 L 360 268 C 360 274 354 276 348 276 L 64 276 C 56 276 52 274 52 268'
  );
}

const car: IllustrationSpec = {
  id: 'physics.car',
  box: { w: 400, h: 400 },
  strokes: [
    S(carBody(571), { width: 5, fill: 'accent', fillOpacity: 0.08 }),
    S(sketchLine(136, 208, 296, 200, 572, 3, 1.5), { width: 3.5, color: 'inkSoft' }), // window line
    S(sketchCircle(140, 278, 30, 573), { width: 5 }),
    S(sketchCircle(140, 278, 12, 574), { width: 3.5, color: 'inkSoft' }),
    S(sketchCircle(296, 278, 30, 575), { width: 5 }),
    S(sketchCircle(296, 278, 12, 576), { width: 3.5, color: 'inkSoft' }),
    S(sketchLine(52, 250, 360, 248, 577, 3, 1.5), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Car braking (passenger leans forward) ---------------------------------------------------------------------
const carBraking: IllustrationSpec = {
  id: 'physics.car-braking',
  box: { w: 400, h: 400 },
  strokes: [
    S(carBody(581), { width: 5, fill: 'accent2', fillOpacity: 0.08 }),
    S(sketchCircle(196, 212, 16, 582), { width: 4, color: 'ink' }), // driver head
    S(cubic(204, 228, 216, 244, 222, 254, 226, 262), { width: 4, color: 'ink' }), // leaning body
    S(sketchLine(216, 240, 238, 232, 583), { width: 3.5, color: 'ink' }), // arm forward
    S(sketchCircle(140, 278, 30, 584), { width: 5 }),
    S(sketchCircle(296, 278, 30, 585), { width: 5 }),
    S(sketchLine(30, 318, 120, 316, 586), { width: 4, color: 'inkSoft' }),
    S(sketchLine(150, 330, 220, 328, 587), { width: 4, color: 'inkSoft' }),
    S(arrowHead(232, 328, 0, 14, 588), { width: 4, color: 'inkSoft' }),
  ],
};

// --- Inclined plane with block -----------------------------------------------------------------------------------
const inclinedPlane: IllustrationSpec = {
  id: 'physics.inclined-plane',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchPolygon([[60, 316], [356, 316], [356, 96]], 591), { width: 5, fill: 'inkSoft', fillOpacity: 0.06 }),
    S(sketchPolygon([[168, 316], [236, 316], [268, 262], [200, 262]], 592), { width: 4.5, fill: 'accent', fillOpacity: 0.1 }),
    S(hatches(60, 316, 356, 316, 12, 14, 593), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Rocket ---------------------------------------------------------------------------------------------------------
const rocket: IllustrationSpec = {
  id: 'physics.rocket',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(200, 60, 234, 108, 246, 160, 246, 218) + ' L 154 218 C 154 160 166 108 200 60', {
      width: 5,
      color: 'ink',
      fill: 'accent',
      fillOpacity: 0.08,
    }),
    S(sketchPolygon([[154, 190], [112, 248], [154, 244]], 595), { width: 4.5, color: 'accent2', fill: 'accent2', fillOpacity: 0.14 }),
    S(sketchPolygon([[246, 190], [288, 248], [246, 244]], 596), { width: 4.5, color: 'accent2', fill: 'accent2', fillOpacity: 0.14 }),
    S(sketchCircle(200, 138, 18, 597), { width: 4, color: 'inkSoft' }),
    S(cubic(178, 250, 170, 290, 178, 316, 200, 332) + ' C 222 316 230 290 222 250', {
      width: 4,
      color: 'accent2',
      fill: 'highlight',
      fillOpacity: 0.25,
    }),
  ],
};

export const PHYSICS_ASSETS: IllustrationSpec[] = [
  crate,
  blockTable,
  ballRolling,
  icePuck,
  pendulum,
  springBlock,
  cradle,
  car,
  carBraking,
  inclinedPlane,
  rocket,
];

export { rect, rrect, hatches, dashedArc };
