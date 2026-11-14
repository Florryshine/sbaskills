// src/illustrations/general.ts — cross-subject annotation & icon assets.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, cubic, wave, arrowHead, sketchEllipse } from '../geometry/paths';
import { blob, rect, rrect, starPoints, hatches, spring } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

// --- Check mark ---------------------------------------------------------------------------
const check: IllustrationSpec = {
  id: 'general.check',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(110, 216, 150, 252, 168, 268, 186, 276) + ' C 220 220 260 150 300 108', { width: 10, color: 'accent' }),
  ],
};

// --- Cross mark -----------------------------------------------------------------------------
const cross: IllustrationSpec = {
  id: 'general.cross',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(120, 130, 290, 290, 601, 5, 2), { width: 10, color: 'accent2' }),
    S(sketchLine(290, 130, 120, 290, 602, 5, 2), { width: 10, color: 'accent2' }),
  ],
};

// --- Question mark ---------------------------------------------------------------------------
const question: IllustrationSpec = {
  id: 'general.question',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(140, 152, 150, 96, 250, 92, 262, 152) + ' C 270 200 216 208 204 250', { width: 9, color: 'accent' }),
    S(sketchCircle(204, 296, 10, 611), { width: 8, color: 'accent', fill: 'accent', fillOpacity: 0.5 }),
  ],
};

// --- Exclamation ------------------------------------------------------------------------------
const exclaim: IllustrationSpec = {
  id: 'general.exclaim',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(204, 92, 196, 244, 621, 6, 3), { width: 10, color: 'accent2' }),
    S(sketchCircle(196, 300, 11, 622), { width: 8, color: 'accent2', fill: 'accent2', fillOpacity: 0.5 }),
  ],
};

// --- Star --------------------------------------------------------------------------------------
const star: IllustrationSpec = {
  id: 'general.star',
  box: { w: 400, h: 400 },
  strokes: [S(sketchPolygon(starPoints(200, 196, 118, 50), 631), { width: 5, color: 'highlight', fill: 'highlight', fillOpacity: 0.3 })],
};

// --- Lightbulb -----------------------------------------------------------------------------------
const lightbulb: IllustrationSpec = {
  id: 'general.lightbulb',
  box: { w: 400, h: 400 },
  strokes: [
    S(blob(200, 168, 92, 92, 641, 10, 0.045), { width: 5, color: 'highlight', fill: 'highlight', fillOpacity: 0.2 }),
    S(sketchPolyline([[176, 262], [168, 292], [172, 306]], 642), { width: 4.5 }),
    S(sketchPolyline([[224, 262], [232, 292], [228, 306]], 643), { width: 4.5 }),
    S(sketchLine(170, 306, 230, 306, 644, 3, 1), { width: 5 }),
    S(sketchLine(172, 326, 228, 326, 645, 3, 1), { width: 5 }),
    S(sketchPolyline([[200, 232], [186, 204], [202, 186], [188, 162]], 646), { width: 3, color: 'accent2' }),
    ...[0, 1, 2].map((i) => {
      const a = (-Math.PI / 2) + (i - 1) * 0.6;
      return S(sketchLine(200 + Math.cos(a) * 112, 168 + Math.sin(a) * 112, 200 + Math.cos(a) * 148, 168 + Math.sin(a) * 148, 647 + i), { width: 3.5, color: 'highlight' });
    }),
  ],
};

// --- Open book --------------------------------------------------------------------------------------
const book: IllustrationSpec = {
  id: 'general.book',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(200, 152, 140, 132, 90, 132, 66, 148) + ' L 66 288 C 90 272 140 272 200 296', { width: 5, fill: 'inkSoft', fillOpacity: 0.05 }),
    S(cubic(200, 152, 260, 132, 310, 132, 334, 148) + ' L 334 288 C 310 272 260 272 200 296', { width: 5 }),
    S(sketchLine(200, 152, 200, 296, 651, 2, 1), { width: 4 }),
    S(cubic(110, 178, 140, 172, 166, 174, 188, 186), { width: 2.5, color: 'inkSoft' }),
    S(cubic(110, 214, 140, 208, 166, 210, 188, 222), { width: 2.5, color: 'inkSoft' }),
    S(cubic(212, 186, 234, 174, 260, 172, 290, 178), { width: 2.5, color: 'inkSoft' }),
    S(cubic(212, 222, 234, 210, 260, 208, 290, 214), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Brain ---------------------------------------------------------------------------------------------
const brain: IllustrationSpec = {
  id: 'general.brain',
  box: { w: 400, h: 400 },
  strokes: [
    S(blob(200, 186, 132, 108, 661, 11, 0.08), { width: 5, fill: 'accent', fillOpacity: 0.06 }),
    S(cubic(196, 96, 180, 140, 214, 150, 196, 186), { width: 3, color: 'inkSoft' }),
    S(cubic(196, 186, 176, 214, 212, 226, 194, 258), { width: 3, color: 'inkSoft' }),
    S(cubic(150, 130, 140, 160, 158, 172, 148, 200), { width: 3, color: 'inkSoft' }),
    S(cubic(248, 128, 262, 156, 240, 170, 252, 198), { width: 3, color: 'inkSoft' }),
    S(cubic(262, 214, 252, 240, 268, 250, 258, 268), { width: 3, color: 'inkSoft' }),
    S(sketchLine(200, 292, 200, 318, 662, 2, 1), { width: 5 }),
  ],
};

// --- Magnifier ----------------------------------------------------------------------------------------------
const magnifier: IllustrationSpec = {
  id: 'general.magnifier',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(168, 164, 86, 671), { width: 6, color: 'accent' }),
    S(sketchLine(232, 232, 316, 316, 672, 3, 2), { width: 9, color: 'accent' }),
    S(cubic(118, 130, 132, 112, 152, 102, 172, 100), { width: 3, color: 'inkSoft' }),
  ],
};

// --- Gear ------------------------------------------------------------------------------------------------------
const gear: IllustrationSpec = {
  id: 'general.gear',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 86, 681), { width: 5 }),
    S(sketchCircle(200, 200, 34, 682), { width: 4.5 }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return S(
        sketchLine(200 + Math.cos(a) * 86, 200 + Math.sin(a) * 86, 200 + Math.cos(a) * 116, 200 + Math.sin(a) * 116, 683 + i, 2, 1),
        { width: 6 },
      );
    }),
  ],
};

// --- Speech bubble -------------------------------------------------------------------------------------------------
const speechBubble: IllustrationSpec = {
  id: 'general.speech-bubble',
  box: { w: 400, h: 400 },
  strokes: [
    S(rrect(72, 108, 256, 132, 691, 26), { width: 4.5, fill: 'inkSoft', fillOpacity: 0.05 }),
    S(sketchPolygon([[140, 240], [116, 300], [196, 240]], 692), { width: 4 }),
    S(sketchCircle(140, 174, 9, 693), { width: 3.5, color: 'inkSoft' }),
    S(sketchCircle(200, 174, 9, 694), { width: 3.5, color: 'inkSoft' }),
    S(sketchCircle(260, 174, 9, 695), { width: 3.5, color: 'inkSoft' }),
  ],
};

// --- Trophy ----------------------------------------------------------------------------------------------------------
const trophy: IllustrationSpec = {
  id: 'general.trophy',
  box: { w: 400, h: 400 },
  strokes: [
    S(cubic(140, 100, 132, 190, 160, 226, 200, 228) + ' C 240 226 268 190 260 100 Z', { width: 5, color: 'highlight', fill: 'highlight', fillOpacity: 0.2 }),
    S(cubic(140, 116, 100, 116, 100, 178, 146, 196), { width: 4 }),
    S(cubic(260, 116, 300, 116, 300, 178, 254, 196), { width: 4 }),
    S(sketchLine(200, 228, 200, 282, 701, 2, 1), { width: 5 }),
    S(rect(150, 282, 100, 26, 702), { width: 4.5 }),
    S(sketchPolygon(starPoints(200, 164, 30, 13), 703), { width: 3, color: 'accent2' }),
  ],
};

// --- Rocket flag (progress) ---------------------------------------------------------------------------------------
const flag: IllustrationSpec = {
  id: 'general.flag',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(140, 82, 140, 330, 711, 3, 1.5), { width: 5.5 }),
    S(cubic(140, 96, 200, 84, 250, 92, 292, 112) + ' L 292 196 C 250 176 200 168 140 184', {
      width: 5,
      color: 'accent2',
      fill: 'accent2',
      fillOpacity: 0.14,
    }),
  ],
};

// --- Target ----------------------------------------------------------------------------------------------------------
const target: IllustrationSpec = {
  id: 'general.target',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 108, 721), { width: 5 }),
    S(sketchCircle(200, 200, 70, 722), { width: 4.5 }),
    S(sketchCircle(200, 200, 34, 723), { width: 4.5 }),
    S(sketchCircle(200, 200, 10, 724), { width: 5, color: 'accent2', fill: 'accent2', fillOpacity: 0.5 }),
  ],
};

// --- Clock -------------------------------------------------------------------------------------------------------------
const clock: IllustrationSpec = {
  id: 'general.clock',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 116, 731), { width: 5.5 }),
    ...Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return S(
        sketchLine(200 + Math.cos(a) * 104, 200 + Math.sin(a) * 104, 200 + Math.cos(a) * 114, 200 + Math.sin(a) * 114, 732 + i, 2, 0.8),
        { width: 3, color: 'inkSoft' },
      );
    }),
    S(sketchLine(200, 200, 200, 118, 744, 2, 1), { width: 5, color: 'accent' }),
    S(sketchLine(200, 200, 258, 236, 745, 2, 1), { width: 5, color: 'accent2' }),
    S(sketchCircle(200, 200, 8, 746), { width: 4, fill: 'ink', fillOpacity: 0.4 }),
  ],
};

// --- Pencil ------------------------------------------------------------------------------------------------------------
const pencil: IllustrationSpec = {
  id: 'general.pencil',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchPolyline([[92, 300], [268, 96]], 751), { width: 5 }),
    S(sketchPolyline([[120, 326], [296, 122]], 752), { width: 5 }),
    S(sketchPolyline([[92, 300], [120, 326]], 753), { width: 5 }),
    S(sketchPolyline([[268, 96], [296, 122]], 754), { width: 5 }),
    S(sketchLine(296, 122, 322, 96, 755, 2, 1), { width: 4 }),
    S(sketchLine(322, 96, 308, 74, 756, 2, 1), { width: 4 }),
    S(sketchLine(308, 74, 268, 96, 757, 2, 1), { width: 4 }),
    S(sketchLine(96, 316, 116, 336, 758, 2, 1), { width: 4, color: 'accent2' }),
    S(sketchPolyline([[104, 320], [120, 336]], 759), { width: 3.5, color: 'ink' }),
  ],
};

// --- Globe ----------------------------------------------------------------------------------------------------------------
const globe: IllustrationSpec = {
  id: 'general.globe',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 118, 761), { width: 5, color: 'accent' }),
    S(sketchLine(82, 200, 318, 200, 762, 3, 1.5), { width: 3, color: 'accent' }),
    S(sketchEllipse(200, 200, 52, 118, 763), { width: 3, color: 'accent' }),
    S(cubic(108, 140, 160, 118, 244, 118, 294, 142), { width: 2.5, color: 'inkSoft' }),
    S(cubic(106, 262, 160, 284, 240, 284, 292, 258), { width: 2.5, color: 'inkSoft' }),
  ],
};

// --- Cloud (generic) ---------------------------------------------------------------------------------------------------------
const cloud: IllustrationSpec = {
  id: 'general.cloud',
  box: { w: 400, h: 400 },
  strokes: [
    S(
      cubic(90, 246, 74, 196, 112, 162, 154, 172) +
        ' C 164 128 216 112 252 136' +
        ' C 298 114 342 144 340 186' +
        ' C 374 194 378 242 342 254' +
        ' C 260 272 166 272 90 246',
      { width: 5, color: 'inkSoft', fill: 'inkSoft', fillOpacity: 0.07 },
    ),
  ],
};

export const GENERAL_ASSETS: IllustrationSpec[] = [
  check,
  cross,
  question,
  exclaim,
  star,
  lightbulb,
  book,
  brain,
  magnifier,
  gear,
  speechBubble,
  trophy,
  flag,
  target,
  clock,
  pencil,
  globe,
  cloud,
];

export { starPoints, blob, rect, rrect, hatches, spring };
