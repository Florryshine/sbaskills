// src/illustrations/humans.ts — human characters, faces and body language.
// Style: clean whiteboard line-art people with warm brown skin tones
// (Shiney Brain Academy audience), colourful clothes from the theme palette,
// and expressive poses: teaching, learning, walking, waving, thinking.
//
// Shared figure conventions inside a 400x400 box:
//   head r≈30 near y=70, shoulders y≈105, hips y≈215, feet y≈390.
// Skin tones: deep #8D5524, mid #A0643C, light #B87A4E. Clothes use theme
// accents where possible so every subject stays cohesive.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, cubic, sketchEllipse } from '../geometry/paths';
import { blob, rrect } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

const SKIN = '#A0643C';
const SKIN_D = '#8D5524';
const SKIN_L = '#B87A4E';

/** Head with face: skin blob, eyes, brows, mouth. `mood`: happy|neutral|thinking|surprised */
function face(cx: number, cy: number, r: number, seed: number, mood: 'happy' | 'neutral' | 'thinking' | 'surprised', skin = SKIN) {
  const eyeY = cy - r * 0.12;
  const eyeDX = r * 0.38;
  const strokes = [
    S(sketchCircle(cx, cy, r, seed), { width: 4.4, fill: skin, fillOpacity: 0.75 }),
    // hair cap
    S(cubic(cx - r, cy - r * 0.28, cx - r * 0.72, cy - r * 1.28, cx + r * 0.72, cy - r * 1.28, cx + r, cy - r * 0.28), {
      width: 4, fill: '#2B2118', fillOpacity: 0.8,
    }),
  ];
  if (mood === 'thinking') {
    strokes.push(S(sketchLine(cx - eyeDX, eyeY - 5, cx - eyeDX + 10, eyeY - 1, seed + 3, 2, 0.4), { width: 2.6 }));
    strokes.push(S(sketchLine(cx + eyeDX - 10, eyeY - 1, cx + eyeDX, eyeY - 5, seed + 4, 2, 0.4), { width: 2.6 }));
    strokes.push(S(sketchLine(cx - 10, cy + r * 0.52, cx + 12, cy + r * 0.44, seed + 5, 3, 0.4), { width: 2.8 }));
  } else if (mood === 'surprised') {
    strokes.push(S(sketchCircle(cx - eyeDX, eyeY, 5.5, seed + 3), { width: 3 }));
    strokes.push(S(sketchCircle(cx + eyeDX, eyeY, 5.5, seed + 4), { width: 3 }));
    strokes.push(S(sketchEllipse(cx, cy + r * 0.5, 8, 10, seed + 5), { width: 2.8, fill: '#7A4A2B', fillOpacity: 0.5 }));
  } else {
    strokes.push(S(sketchCircle(cx - eyeDX, eyeY, 4.4, seed + 3), { width: 3, fill: '#1A1A1A', fillOpacity: 0.8 }));
    strokes.push(S(sketchCircle(cx + eyeDX, eyeY, 4.4, seed + 4), { width: 3, fill: '#1A1A1A', fillOpacity: 0.8 }));
    strokes.push(
      mood === 'happy'
        ? S(cubic(cx - r * 0.4, cy + r * 0.4, cx - r * 0.15, cy + r * 0.72, cx + r * 0.15, cy + r * 0.72, cx + r * 0.4, cy + r * 0.4), { width: 3 })
        : S(sketchLine(cx - 12, cy + r * 0.5, cx + 12, cy + r * 0.5, seed + 5, 2.4, 0.4), { width: 2.8 }),
    );
  }
  return strokes;
}

/** Stick-to-soft body: torso + limbs as expressive lines. Angles in degrees. */
function limb(x1: number, y1: number, x2: number, y2: number, seed: number, opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number }) {
  return S(cubic(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2 - 6, (x1 + x2) / 2, (y1 + y2) / 2 + 6, x2, y2), {
    width: 5.4, ...(opts ?? {}),
  });
}

// --- Teacher pointing at the board ------------------------------------------------
const teacher: IllustrationSpec = {
  id: 'general.teacher',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(210, 72, 32, 401, 'happy'),
    // glasses
    S(sketchCircle(198, 68, 9, 402), { width: 2.6, color: 'inkSoft' }),
    S(sketchCircle(222, 68, 9, 403), { width: 2.6, color: 'inkSoft' }),
    S(sketchLine(207, 68, 213, 68, 404, 1, 0.3), { width: 2.4, color: 'inkSoft' }),
    // torso: shirt (accent2)
    S(cubic(190, 104, 176, 150, 178, 190, 186, 218), { width: 5, fill: 'accent2', fillOpacity: 0.55 }),
    S(cubic(230, 104, 244, 150, 242, 190, 234, 218), { width: 5, fill: 'accent2', fillOpacity: 0.55 }),
    S(sketchLine(190, 104, 230, 104, 405, 3, 0.8), { width: 4.4, fill: 'accent2', fillOpacity: 0.55 }),
    // right arm pointing up-left at the board
    limb(228, 112, 288, 76, 406),
    S(sketchCircle(292, 74, 8, 407), { width: 3.4, fill: SKIN, fillOpacity: 0.8 }), // pointing hand
    S(sketchLine(296, 70, 312, 62, 408, 2.6, 0.6), { width: 3.4 }), // pointing finger
    // left arm down, holding a book
    limb(192, 112, 172, 190, 409),
    S(rrect(146, 186, 44, 34, 410, 4), { width: 3, fill: 'highlight', fillOpacity: 0.6 }),
    // trousers + legs
    S(sketchLine(186, 218, 182, 300, 411, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.35 }),
    S(sketchLine(234, 218, 240, 300, 412, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.35 }),
    S(sketchLine(182, 300, 176, 372, 413, 3, 0.8), { width: 5 }),
    S(sketchLine(240, 300, 248, 372, 414, 3, 0.8), { width: 5 }),
    // shoes
    S(sketchPolyline([[176, 372], [162, 380], [184, 382]], 415), { width: 4 }),
    S(sketchPolyline([[248, 372], [262, 380], [240, 382]], 416), { width: 4 }),
  ],
};

// --- Student raising hand ------------------------------------------------------------
const studentHandUp: IllustrationSpec = {
  id: 'general.student-raising-hand',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(196, 96, 34, 421, 'happy', SKIN_L),
    // pigtails/afro puffs
    S(sketchCircle(160, 66, 14, 422), { width: 3.4, fill: '#2B2118', fillOpacity: 0.8 }),
    S(sketchCircle(232, 66, 14, 423), { width: 3.4, fill: '#2B2118', fillOpacity: 0.8 }),
    // torso: school dress (accent teal)
    S(cubic(180, 130, 168, 180, 170, 226, 178, 258), { width: 5, fill: 'accent', fillOpacity: 0.55 }),
    S(cubic(212, 130, 224, 180, 222, 226, 214, 258), { width: 5, fill: 'accent', fillOpacity: 0.55 }),
    // raised arm (right, up!)
    limb(210, 138, 268, 66, 424),
    S(sketchCircle(272, 60, 9, 425), { width: 3.4, fill: SKIN_L, fillOpacity: 0.8 }),
    // other arm down
    limb(182, 138, 168, 210, 426),
    // legs + shoes
    S(sketchLine(178, 258, 176, 330, 427, 3, 0.8), { width: 5 }),
    S(sketchLine(214, 258, 218, 330, 428, 3, 0.8), { width: 5 }),
    S(sketchLine(176, 330, 174, 378, 429, 3, 0.8), { width: 5, fill: '#F1F3F5', fillOpacity: 0.4 }),
    S(sketchLine(218, 330, 220, 378, 430, 3, 0.8), { width: 5, fill: '#F1F3F5', fillOpacity: 0.4 }),
    S(sketchPolyline([[174, 378], [160, 386], [182, 388]], 431), { width: 4 }),
    S(sketchPolyline([[220, 378], [234, 386], [212, 388]], 432), { width: 4 }),
    // excitement sparkle
    S(sketchLine(286, 40, 286, 24, 433, 2, 0.5), { width: 2.6, color: 'highlight' }),
    S(sketchLine(276, 50, 262, 44, 434, 2, 0.5), { width: 2.6, color: 'highlight' }),
    S(sketchLine(296, 50, 310, 44, 435, 2, 0.5), { width: 2.6, color: 'highlight' }),
  ],
};

// --- Student sitting at a desk writing ------------------------------------------------
const studentDesk: IllustrationSpec = {
  id: 'general.student-desk',
  box: { w: 400, h: 400 },
  strokes: [
    // desk top + legs
    S(rrect(120, 250, 220, 14, 441, 4), { width: 4.2, fill: '#C9A227', fillOpacity: 0.5 }),
    S(sketchLine(140, 264, 140, 380, 442, 3, 0.8), { width: 4.4 }),
    S(sketchLine(320, 264, 320, 380, 443, 3, 0.8), { width: 4.4 }),
    // student behind desk: head + torso
    ...face(206, 120, 30, 444, 'thinking', SKIN_D),
    S(cubic(186, 150, 176, 196, 178, 230, 186, 252), { width: 5, fill: 'accent2', fillOpacity: 0.5 }),
    S(cubic(226, 150, 236, 196, 234, 230, 226, 252), { width: 5, fill: 'accent2', fillOpacity: 0.5 }),
    // writing arm bent toward desk
    limb(224, 158, 268, 240, 445),
    S(sketchCircle(272, 244, 8, 446), { width: 3.4, fill: SKIN_D, fillOpacity: 0.8 }),
    // pencil in hand
    S(sketchLine(274, 240, 292, 222, 447, 2.6, 0.6), { width: 3.4, color: 'highlight' }),
    // other arm resting
    limb(188, 158, 168, 244, 448),
    // notebook on desk
    S(rrect(226, 236, 58, 14, 449, 3), { width: 2.8, fill: '#F1F3F5', fillOpacity: 0.85 }),
    S(sketchLine(238, 240, 274, 240, 450, 2, 0.4), { width: 1.8, color: 'inkSoft' }),
  ],
};

// --- Person walking --------------------------------------------------------------------
const personWalking: IllustrationSpec = {
  id: 'general.person-walking',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(190, 78, 31, 451, 'happy'),
    // torso slight forward lean
    S(cubic(176, 110, 170, 156, 172, 196, 178, 222), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    S(cubic(220, 110, 216, 156, 212, 196, 206, 222), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    // swinging arms
    limb(218, 118, 258, 178, 452),
    S(sketchCircle(262, 184, 8, 453), { width: 3.2, fill: SKIN, fillOpacity: 0.8 }),
    limb(178, 118, 140, 176, 454),
    S(sketchCircle(136, 182, 8, 455), { width: 3.2, fill: SKIN, fillOpacity: 0.8 }),
    // mid-stride legs
    S(cubic(206, 222, 232, 268, 244, 310, 238, 356), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(cubic(178, 222, 162, 272, 156, 312, 168, 354), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    // feet
    S(sketchPolyline([[238, 356], [258, 368], [232, 372]], 456), { width: 4 }),
    S(sketchPolyline([[168, 354], [146, 362], [172, 370]], 457), { width: 4 }),
    // motion lines behind
    S(sketchLine(120, 150, 144, 150, 458, 2, 0.4), { width: 2.6, color: 'inkSoft' }),
    S(sketchLine(112, 178, 140, 180, 459, 2, 0.4), { width: 2.6, color: 'inkSoft' }),
    S(sketchLine(122, 206, 146, 210, 460, 2, 0.4), { width: 2.6, color: 'inkSoft' }),
  ],
};

// --- Person running (energetic) ------------------------------------------------------------
const personRunning: IllustrationSpec = {
  id: 'general.person-running',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(208, 66, 30, 461, 'happy'),
    // torso leaning forward
    S(cubic(196, 98, 206, 140, 210, 172, 214, 200), { width: 5, fill: 'accent2', fillOpacity: 0.55 }),
    S(cubic(238, 102, 244, 142, 244, 174, 240, 200), { width: 5, fill: 'accent2', fillOpacity: 0.55 }),
    // pumping arms
    limb(238, 110, 288, 150, 462),
    S(sketchCircle(292, 154, 8, 463), { width: 3.2, fill: SKIN, fillOpacity: 0.8 }),
    limb(198, 110, 152, 82, 464),
    S(sketchCircle(148, 78, 8, 465), { width: 3.2, fill: SKIN, fillOpacity: 0.8 }),
    // stride: front leg extended, back leg kicked
    S(cubic(214, 200, 258, 238, 286, 280, 296, 330), { width: 5.4, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(cubic(240, 200, 212, 244, 196, 288, 186, 326), { width: 5.4, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(sketchPolyline([[296, 330], [318, 340], [294, 348]], 466), { width: 4 }),
    S(sketchPolyline([[186, 326], [164, 322], [176, 344]], 467), { width: 4 }),
    // speed lines
    S(sketchLine(96, 140, 136, 148, 468, 2, 0.5), { width: 2.8, color: 'inkSoft' }),
    S(sketchLine(88, 176, 130, 182, 469, 2, 0.5), { width: 2.8, color: 'inkSoft' }),
    S(sketchLine(96, 212, 138, 214, 470, 2, 0.5), { width: 2.8, color: 'inkSoft' }),
  ],
};

// --- Person thinking (hand on chin) -----------------------------------------------------------
const personThinking: IllustrationSpec = {
  id: 'general.person-thinking',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(196, 84, 32, 471, 'thinking', SKIN_L),
    // torso
    S(cubic(178, 116, 172, 160, 174, 198, 180, 224), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    S(cubic(216, 116, 224, 160, 222, 198, 216, 224), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    // arm bent up to chin
    limb(214, 124, 236, 176, 472),
    limb(236, 176, 212, 112, 473),
    S(sketchCircle(210, 108, 8, 474), { width: 3.2, fill: SKIN_L, fillOpacity: 0.8 }),
    // other arm across
    limb(180, 124, 160, 192, 475),
    // legs crossed standing
    S(sketchLine(180, 224, 176, 310, 476, 3, 0.8), { width: 5 }),
    S(sketchLine(216, 224, 222, 306, 477, 3, 0.8), { width: 5 }),
    S(sketchLine(176, 310, 196, 372, 478, 3, 0.8), { width: 5 }),
    S(sketchLine(222, 306, 214, 372, 479, 3, 0.8), { width: 5 }),
    S(sketchPolyline([[196, 372], [182, 380], [204, 382]], 480), { width: 4 }),
    S(sketchPolyline([[214, 372], [228, 380], [206, 382]], 481), { width: 4 }),
    // thought bubble trail
    S(sketchCircle(252, 74, 7, 482), { width: 2.6, color: 'inkSoft' }),
    S(sketchCircle(272, 52, 10, 483), { width: 2.6, color: 'inkSoft' }),
    S(blob(312, 28, 26, 18, 484, 8, 0.1), { width: 2.6, color: 'inkSoft' }),
  ],
};

// --- Person waving ------------------------------------------------------------------------------
const personWaving: IllustrationSpec = {
  id: 'general.person-waving',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(198, 76, 32, 491, 'happy'),
    // torso
    S(cubic(180, 108, 172, 154, 174, 196, 182, 222), { width: 5, fill: 'accent2', fillOpacity: 0.5 }),
    S(cubic(218, 108, 226, 154, 224, 196, 216, 222), { width: 5, fill: 'accent2', fillOpacity: 0.5 }),
    // waving arm up
    limb(216, 116, 268, 64, 492),
    S(sketchEllipse(274, 56, 12, 10, 493, 20), { width: 3.4, fill: SKIN, fillOpacity: 0.8 }),
    // wave arcs
    S(cubic(286, 42, 296, 34, 300, 26, 298, 16), { width: 2.6, color: 'inkSoft' }),
    S(cubic(298, 48, 312, 40, 318, 30, 316, 18), { width: 2.6, color: 'inkSoft' }),
    // other arm on hip
    limb(180, 116, 156, 178, 494),
    limb(156, 178, 176, 216, 495),
    // legs
    S(sketchLine(182, 222, 178, 310, 496, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(sketchLine(216, 222, 220, 310, 497, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(sketchLine(178, 310, 172, 372, 498, 3, 0.8), { width: 5 }),
    S(sketchLine(220, 310, 226, 372, 499, 3, 0.8), { width: 5 }),
    S(sketchPolyline([[172, 372], [158, 380], [180, 382]], 500), { width: 4 }),
    S(sketchPolyline([[226, 372], [240, 380], [218, 382]], 501), { width: 4 }),
  ],
};

// --- Person reading a book ------------------------------------------------------------------------
const personReading: IllustrationSpec = {
  id: 'general.person-reading',
  box: { w: 400, h: 400 },
  strokes: [
    // seated cross-legged
    ...face(200, 96, 33, 511, 'neutral', SKIN_D),
    // body
    S(cubic(182, 130, 176, 180, 178, 226, 186, 258), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    S(cubic(220, 130, 226, 180, 224, 226, 216, 258), { width: 5, fill: 'accent', fillOpacity: 0.5 }),
    // crossed legs
    S(cubic(186, 258, 150, 286, 130, 312, 152, 330), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(cubic(216, 258, 252, 286, 272, 312, 250, 330), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(cubic(152, 330, 180, 344, 222, 344, 250, 330), { width: 4.4 }),
    // arms holding open book
    limb(182, 140, 158, 208, 512),
    limb(220, 140, 244, 208, 513),
    // open book (V shape)
    S(sketchPolygon([[160, 196], [200, 214], [240, 196], [240, 238], [200, 256], [160, 238]], 514), {
      width: 3.6, fill: 'highlight', fillOpacity: 0.55,
    }),
    S(sketchLine(200, 214, 200, 256, 515, 2.6, 0.4), { width: 2.6 }),
    S(sketchLine(172, 210, 190, 218, 516, 2, 0.4), { width: 1.8, color: 'inkSoft' }),
    S(sketchLine(212, 218, 230, 210, 517, 2, 0.4), { width: 1.8, color: 'inkSoft' }),
  ],
};

// --- Person drinking water ---------------------------------------------------------------------------
const personDrinking: IllustrationSpec = {
  id: 'general.person-drinking',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(196, 84, 31, 521, 'surprised', SKIN_L),
    // torso
    S(cubic(180, 116, 174, 160, 176, 200, 182, 226), { width: 5, fill: '#1971C2', fillOpacity: 0.45 }),
    S(cubic(214, 116, 220, 160, 218, 200, 212, 226), { width: 5, fill: '#1971C2', fillOpacity: 0.45 }),
    // arm raising cup to mouth
    limb(212, 124, 240, 92, 522),
    limb(240, 92, 212, 104, 523),
    // cup near face
    S(sketchPolygon([[196, 116], [222, 110], [220, 138], [198, 140]], 524), {
      width: 3.4, fill: '#74C0FC', fillOpacity: 0.6,
    }),
    S(sketchLine(200, 120, 218, 116, 525, 2, 0.4), { width: 2, color: 'inkSoft' }),
    // other arm
    limb(180, 124, 160, 190, 526),
    // legs
    S(sketchLine(182, 226, 178, 316, 527, 3, 0.8), { width: 5.2 }),
    S(sketchLine(212, 226, 218, 316, 528, 3, 0.8), { width: 5.2 }),
    S(sketchPolyline([[178, 316], [164, 324], [186, 326]], 529), { width: 4 }),
    S(sketchPolyline([[218, 316], [232, 324], [210, 326]], 530), { width: 4 }),
    // droplet
    S(blob(232, 148, 7, 9, 531, 6, 0.12), { width: 2.4, color: '#1971C2', fill: '#74C0FC', fillOpacity: 0.5 }),
  ],
};

// --- Two people talking --------------------------------------------------------------------------------
const peopleTalking: IllustrationSpec = {
  id: 'general.people-talking',
  box: { w: 400, h: 400 },
  strokes: [
    // person A (left)
    ...face(140, 108, 30, 541, 'happy'),
    S(cubic(126, 138, 118, 178, 120, 214, 126, 240), { width: 4.8, fill: 'accent', fillOpacity: 0.5 }),
    S(cubic(158, 138, 164, 178, 162, 214, 156, 240), { width: 4.8, fill: 'accent', fillOpacity: 0.5 }),
    S(sketchLine(126, 240, 122, 316, 542, 3, 0.8), { width: 4.8 }),
    S(sketchLine(156, 240, 160, 316, 543, 3, 0.8), { width: 4.8 }),
    S(sketchPolyline([[122, 316], [108, 324], [130, 326]], 544), { width: 3.6 }),
    S(sketchPolyline([[160, 316], [174, 324], [152, 326]], 545), { width: 3.6 }),
    // person B (right)
    ...face(272, 116, 30, 546, 'happy', SKIN_D),
    S(cubic(258, 146, 252, 184, 254, 218, 260, 244), { width: 4.8, fill: 'accent2', fillOpacity: 0.5 }),
    S(cubic(288, 146, 294, 184, 292, 218, 286, 244), { width: 4.8, fill: 'accent2', fillOpacity: 0.5 }),
    S(sketchLine(260, 244, 256, 320, 547, 3, 0.8), { width: 4.8 }),
    S(sketchLine(286, 244, 290, 320, 548, 3, 0.8), { width: 4.8 }),
    S(sketchPolyline([[256, 320], [242, 328], [264, 330]], 549), { width: 3.6 }),
    S(sketchPolyline([[290, 320], [304, 328], [282, 330]], 550), { width: 3.6 }),
    // speech bubbles exchanged
    S(blob(208, 84, 34, 24, 551, 8, 0.08), { width: 3, color: 'inkSoft' }),
    S(sketchLine(196, 76, 220, 76, 552, 2, 0.4), { width: 2, color: 'inkSoft' }),
    S(sketchLine(196, 86, 214, 86, 553, 2, 0.4), { width: 2, color: 'inkSoft' }),
    S(sketchLine(196, 96, 210, 96, 554, 2, 0.4), { width: 2, color: 'inkSoft' }),
  ],
};

// --- Doctor / health worker ------------------------------------------------------------------------------
const doctor: IllustrationSpec = {
  id: 'general.doctor',
  box: { w: 400, h: 400 },
  strokes: [
    ...face(200, 74, 31, 561, 'happy', SKIN_L),
    // white coat body
    S(cubic(182, 106, 172, 158, 174, 208, 180, 240), { width: 5, fill: '#F1F3F5', fillOpacity: 0.85 }),
    S(cubic(220, 106, 230, 158, 228, 208, 222, 240), { width: 5, fill: '#F1F3F5', fillOpacity: 0.85 }),
    // coat lapels
    S(sketchPolyline([[200, 106], [188, 150], [194, 190]], 562), { width: 3 }),
    S(sketchPolyline([[200, 106], [212, 150], [206, 190]], 563), { width: 3 }),
    // stethoscope: earpieces -> chest piece
    S(cubic(190, 108, 196, 160, 208, 180, 224, 196), { width: 3.2, color: '#343A40' }),
    S(sketchCircle(228, 200, 10, 564), { width: 3.2, color: '#343A40', fill: '#CED4DA', fillOpacity: 0.7 }),
    // right arm holding clipboard
    limb(218, 114, 262, 188, 565),
    S(rrect(244, 180, 52, 40, 566, 4), { width: 3, fill: 'highlight', fillOpacity: 0.5 }),
    S(sketchLine(254, 190, 286, 190, 567, 2, 0.4), { width: 2, color: 'inkSoft' }),
    S(sketchLine(254, 200, 280, 200, 568, 2, 0.4), { width: 2, color: 'inkSoft' }),
    // left arm
    limb(184, 114, 158, 190, 569),
    // trousers + shoes
    S(sketchLine(180, 240, 176, 322, 570, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(sketchLine(222, 240, 226, 322, 571, 3, 0.8), { width: 5.2, fill: '#2B3A55', fillOpacity: 0.3 }),
    S(sketchPolyline([[176, 322], [162, 330], [184, 332]], 572), { width: 4 }),
    S(sketchPolyline([[226, 322], [240, 330], [218, 332]], 573), { width: 4 }),
  ],
};

// --- Expressive faces (large, for reactions) ---------------------------------------------------------------
function bigFace(id: string, seed: number, mood: 'happy' | 'thinking' | 'surprised', tint = '#F1D3B2'): IllustrationSpec {
  return {
    id,
    box: { w: 400, h: 400 },
    strokes: [
      ...face(200, 200, 120, seed, mood, tint),
      // ears
      S(sketchEllipse(76, 210, 16, 24, seed + 9, 12), { width: 3.6, fill: tint, fillOpacity: 0.6 }),
      S(sketchEllipse(324, 210, 16, 24, seed + 10, -12), { width: 3.6, fill: tint, fillOpacity: 0.6 }),
      // neck hint
      S(sketchLine(184, 320, 184, 352, seed + 11, 3, 0.8), { width: 4.4 }),
      S(sketchLine(216, 320, 216, 352, seed + 12, 3, 0.8), { width: 4.4 }),
    ],
  };
}

const faceHappy = bigFace('general.face-happy', 581, 'happy');
const faceThinking = bigFace('general.face-thinking', 591, 'thinking');
const faceSurprised = bigFace('general.face-surprised', 601, 'surprised');

// --- Pointing hand (body part close-up) ----------------------------------------------------------------------
const handPointing: IllustrationSpec = {
  id: 'general.hand-pointing',
  box: { w: 400, h: 400 },
  strokes: [
    // palm
    S(blob(190, 260, 62, 72, 611, 10, 0.07, -8), { width: 4.6, fill: SKIN, fillOpacity: 0.72 }),
    // index finger pointing up-right
    S(cubic(222, 196, 250, 150, 268, 110, 282, 72), { width: 4.4, fill: SKIN, fillOpacity: 0.72 }),
    S(cubic(244, 204, 272, 160, 290, 120, 302, 84), { width: 4.4 }),
    S(sketchLine(282, 72, 302, 84, 612, 2.6, 0.6), { width: 3 }),
    // curled fingers
    S(blob(160, 206, 34, 30, 613, 8, 0.12), { width: 4, fill: SKIN_D, fillOpacity: 0.6 }),
    S(blob(148, 258, 28, 26, 614, 8, 0.12), { width: 3.6, fill: SKIN_D, fillOpacity: 0.5 }),
    // thumb
    S(cubic(206, 220, 238, 224, 258, 240, 262, 262), { width: 4.2, fill: SKIN, fillOpacity: 0.72 }),
    // knuckle creases
    S(sketchLine(232, 176, 244, 186, 615, 2, 0.5), { width: 2.2, color: 'inkSoft' }),
    S(sketchLine(248, 138, 260, 148, 616, 2, 0.5), { width: 2.2, color: 'inkSoft' }),
    // cuff
    S(rrect(140, 320, 100, 34, 617, 6), { width: 4.2, fill: 'accent2', fillOpacity: 0.5 }),
  ],
};

export const HUMANS_ASSETS: IllustrationSpec[] = [
  teacher,
  studentHandUp,
  studentDesk,
  personWalking,
  personRunning,
  personThinking,
  personWaving,
  personReading,
  personDrinking,
  peopleTalking,
  doctor,
  faceHappy,
  faceThinking,
  faceSurprised,
  handPointing,
];
