// src/illustrations/mathematics.ts — math diagram assets.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, cubic, arrowHead } from '../geometry/paths';
import { rect, dashedArc, hatches } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

const axes: IllustrationSpec = {
  id: 'math.axes',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(70, 330, 344, 330, 801, 3, 1.5), { width: 4.5 }),
    S(arrowHead(344, 330, 0, 14, 802), { width: 4.5 }),
    S(sketchLine(70, 330, 70, 72, 803, 3, 1.5), { width: 4.5 }),
    S(arrowHead(70, 72, -Math.PI / 2, 14, 804), { width: 4.5 }),
    S(sketchLine(140, 324, 140, 336, 805), { width: 3 }),
    S(sketchLine(210, 324, 210, 336, 806), { width: 3 }),
    S(sketchLine(280, 324, 280, 336, 807), { width: 3 }),
    S(sketchLine(64, 260, 76, 260, 808), { width: 3 }),
    S(sketchLine(64, 190, 76, 190, 809), { width: 3 }),
    S(sketchLine(64, 120, 76, 120, 810), { width: 3 }),
  ],
};

const parabola: IllustrationSpec = {
  id: 'math.parabola',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(70, 330, 344, 330, 811, 3, 1.5), { width: 4.5 }),
    S(arrowHead(344, 330, 0, 14, 812), { width: 4.5 }),
    S(sketchLine(70, 330, 70, 72, 813, 3, 1.5), { width: 4.5 }),
    S(arrowHead(70, 72, -Math.PI / 2, 14, 814), { width: 4.5 }),
    S(cubic(110, 110, 150, 330, 250, 330, 290, 110), { width: 5, color: 'accent' }),
    S(cubic(140, 230, 160, 258, 240, 258, 260, 230), { width: 2.5, color: 'inkSoft' }),
    S(sketchCircle(200, 254, 7, 815), { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.4 }),
  ],
};

const barChart: IllustrationSpec = {
  id: 'math.bar-chart',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(80, 320, 340, 318, 821, 3, 1.5), { width: 4.5 }),
    S(rect(110, 220, 44, 98, 822), { width: 4, color: 'accent', fill: 'accent', fillOpacity: 0.25 }),
    S(rect(180, 160, 44, 158, 823), { width: 4, color: 'accent', fill: 'accent', fillOpacity: 0.25 }),
    S(rect(250, 240, 44, 78, 824), { width: 4, color: 'accent', fill: 'accent', fillOpacity: 0.25 }),
    S(rect(300, 130, 44, 188, 825), { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.25 }),
  ],
};

const piSymbol: IllustrationSpec = {
  id: 'math.pi',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(96, 130, 310, 126, 831, 4, 2), { width: 8 }),
    S(sketchLine(130, 130, 122, 300, 832, 3, 2), { width: 8 }),
    S(sketchLine(268, 126, 274, 210, 833, 3, 2), { width: 8 }),
    S(cubic(274, 210, 280, 250, 264, 268, 250, 262), { width: 8 }),
  ],
};

const rightTriangle: IllustrationSpec = {
  id: 'math.right-triangle',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchPolygon([[100, 310], [320, 310], [320, 110]], 841), { width: 5, fill: 'accent', fillOpacity: 0.08 }),
    S(sketchPolyline([[320, 276], [286, 276], [286, 310]], 842), { width: 3, color: 'inkSoft' }),
    S(sketchLine(210, 310, 210, 296, 843), { width: 3, color: 'inkSoft' }),
    S(sketchLine(196, 310, 196, 296, 844), { width: 3, color: 'inkSoft' }),
    S(sketchLine(96, 296, 110, 296, 845), { width: 3, color: 'inkSoft' }),
    S(sketchLine(96, 296, 96, 310, 846), { width: 3, color: 'inkSoft' }),
  ],
};

const circleGeom: IllustrationSpec = {
  id: 'math.circle',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchCircle(200, 200, 118, 851), { width: 5, color: 'accent' }),
    S(sketchLine(200, 200, 318, 200, 852, 2, 1), { width: 4, color: 'accent2' }),
    S(sketchLine(200, 200, 82, 200, 853, 2, 1), { width: 4, color: 'accent2' }),
    S(sketchCircle(200, 200, 8, 854), { width: 4, fill: 'ink', fillOpacity: 0.4 }),
    S(dashedArc(200, 200, 132, 180, 350, 855), { width: 2.5, color: 'inkSoft' }),
  ],
};

const grid: IllustrationSpec = {
  id: 'math.grid',
  box: { w: 400, h: 400 },
  strokes: [
    ...Array.from({ length: 5 }, (_, i) => S(sketchLine(80 + i * 60, 80, 80 + i * 60, 320, 861 + i, 2, 0.8), { width: 2.5, color: 'inkSoft' })),
    ...Array.from({ length: 5 }, (_, i) => S(sketchLine(80, 80 + i * 60, 320, 80 + i * 60, 871 + i, 2, 0.8), { width: 2.5, color: 'inkSoft' })),
  ],
};

const graphLine: IllustrationSpec = {
  id: 'math.graph-line',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(70, 330, 344, 330, 881, 3, 1.5), { width: 4.5 }),
    S(sketchLine(70, 330, 70, 72, 882, 3, 1.5), { width: 4.5 }),
    S(sketchLine(80, 300, 320, 110, 883, 3, 2), { width: 5, color: 'accent' }),
    S(sketchCircle(120, 264, 8, 884), { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.4 }),
    S(sketchCircle(200, 197, 8, 885), { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.4 }),
    S(sketchCircle(280, 132, 8, 886), { width: 4, color: 'accent2', fill: 'accent2', fillOpacity: 0.4 }),
  ],
};

const fraction: IllustrationSpec = {
  id: 'math.fraction',
  box: { w: 400, h: 400 },
  strokes: [
    S(sketchLine(150, 200, 250, 200, 891, 3, 1.5), { width: 6 }),
  ],
  labels: [
    { text: '3', x: 200, y: 130, size: 90, color: 'ink', align: 'middle' },
    { text: '4', x: 200, y: 282, size: 90, color: 'ink', align: 'middle' },
  ],
};

export const MATHEMATICS_ASSETS: IllustrationSpec[] = [
  axes,
  parabola,
  barChart,
  piSymbol,
  rightTriangle,
  circleGeom,
  grid,
  graphLine,
  fraction,
];

export { rect, hatches, dashedArc };
