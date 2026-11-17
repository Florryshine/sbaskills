// src/illustrations/anatomy.ts — human anatomy line-drawing assets.
// Scientific accuracy notes: bone shapes follow real proportions, ribs sweep
// downward-outward from the thoracic spine, the femur head seats into the
// acetabulum, vessels are colour-coded (arteries red #E03131, veins blue
// #1971C2, nerves amber #F59F00) and bone fills read as ivory.

import type { IllustrationSpec } from '../types';
import { sketchCircle, sketchLine, sketchPolygon, sketchPolyline, wave, cubic, sketchEllipse } from '../geometry/paths';
import { blob, rrect } from './helpers';

const S = (
  d: string,
  opts?: { width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number },
): { d: string; width?: number; color?: string; fill?: string; fillOpacity?: number; afterStroke?: number } => ({
  d,
  ...opts,
});

const BONE = '#F7F0E3';
const BONE_OUT = 'ink';
const ARTERY = '#E03131';
const VEIN = '#1971C2';
const NERVE = '#F59F00';
const MUSCLE = '#E03131';
const TISSUE = '#F76707';

// --- Full anterior skeleton ---------------------------------------------------
// Skull -> spine -> ribcage -> pelvis -> limbs, in teaching order.
const skeleton: IllustrationSpec = {
  id: 'biology.skeleton',
  box: { w: 400, h: 400 },
  strokes: [
    // cranium + jaw
    S(sketchCircle(200, 52, 30, 11), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(sketchPolyline([[178, 72], [178, 84], [222, 84], [222, 72]], 12, true), { width: 4, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(182, 79, 218, 79, 13, 2, 0.8), { width: 2.5 }), // teeth line
    S(sketchCircle(190, 50, 6, 14), { width: 3 }), // eye socket L
    S(sketchCircle(210, 50, 6, 15), { width: 3 }), // eye socket R
    // clavicles + shoulders
    S(cubic(200, 102, 178, 96, 158, 96, 140, 102), { width: 4 }),
    S(cubic(200, 102, 222, 96, 242, 96, 260, 102), { width: 4 }),
    // sternum
    S(sketchLine(200, 106, 200, 168, 16, 3.5, 0.8), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    // ribcage: 6 pairs sweeping downward-outward from the thoracic spine
    ...Array.from({ length: 6 }, (_, i) => {
      const y0 = 112 + i * 12;
      const drop = 12 + i * 3.5;
      const out = 52 + i * 4.5;
      return [
        S(cubic(200, y0, 172, y0 + drop * 0.25, 160 - i * 3, y0 + drop, 200 - out + i * 2, y0 + drop + 6), {
          width: 3.6, fill: BONE, fillOpacity: 0.55,
        }),
        S(cubic(200, y0, 228, y0 + drop * 0.25, 240 + i * 3, y0 + drop, 200 + out - i * 2, y0 + drop + 6), {
          width: 3.6, fill: BONE, fillOpacity: 0.55,
        }),
      ];
    }).flat(),
    // thoracic + lumbar spine segments behind the cage
    ...Array.from({ length: 9 }, (_, i) =>
      S(rrect(191 - (i > 5 ? (i - 5) * 1.6 : 0), 108 + i * 14.5, 18 + (i > 5 ? (i - 5) * 3.2 : 0), 9, 60 + i, 3), {
        width: 2.8, fill: BONE, fillOpacity: 0.8,
      }),
    ),
    // pelvis: iliac wings + sacrum
    S(blob(152, 250, 34, 26, 71, 8, 0.12, -18), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(blob(248, 250, 34, 26, 72, 8, 0.12, 18), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(sketchPolygon([[200, 236], [214, 268], [200, 292], [186, 268]], 73), { width: 3.6, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(160, 278, 186, 288, 74, 3, 0.8), { width: 3.4 }), // pubis L
    S(sketchLine(240, 278, 214, 288, 75, 3, 0.8), { width: 3.4 }), // pubis R
    // left arm: humerus -> radius/ulna -> hand
    S(sketchLine(140, 104, 118, 178, 81, 4, 1), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(118, 182, 108, 250, 82, 3.6, 1), { width: 3.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(122, 182, 114, 250, 83, 3.6, 1), { width: 3.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchCircle(118, 180, 7, 84), { width: 3 }), // elbow joint
    S(blob(107, 266, 12, 16, 85, 7, 0.14), { width: 3.4, fill: BONE, fillOpacity: 0.8 }), // hand
    // right arm
    S(sketchLine(260, 104, 282, 178, 86, 4, 1), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(282, 182, 292, 250, 87, 3.6, 1), { width: 3.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(278, 182, 286, 250, 88, 3.6, 1), { width: 3.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchCircle(282, 180, 7, 89), { width: 3 }),
    S(blob(293, 266, 12, 16, 90, 7, 0.14), { width: 3.4, fill: BONE, fillOpacity: 0.8 }),
    // legs: femur -> tibia/fibula -> foot
    S(sketchLine(178, 290, 172, 350, 91, 4.4, 1), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(170, 354, 174, 386, 92, 3.8, 1), { width: 4, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(177, 354, 181, 386, 93, 3.2, 1), { width: 3, fill: BONE, fillOpacity: 0.8 }),
    S(sketchCircle(172, 352, 8, 94), { width: 3 }), // knee
    S(sketchPolyline([[166, 390], [160, 396], [180, 397]], 95), { width: 3.2 }), // foot L
    S(sketchLine(222, 290, 228, 350, 96, 4.4, 1), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(230, 354, 226, 386, 97, 3.8, 1), { width: 4, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(223, 354, 219, 386, 98, 3.2, 1), { width: 3, fill: BONE, fillOpacity: 0.8 }),
    S(sketchCircle(228, 352, 8, 99), { width: 3 }),
    S(sketchPolyline([[234, 390], [240, 396], [220, 397]], 100), { width: 3.2 }),
  ],
};

// --- Lateral skull -------------------------------------------------------------
const skull: IllustrationSpec = {
  id: 'biology.skull',
  box: { w: 400, h: 400 },
  strokes: [
    // cranium
    S(blob(190, 150, 105, 96, 111, 10, 0.06, 8), { width: 5, fill: BONE, fillOpacity: 0.8 }),
    // brow ridge + zygomatic arch
    S(sketchLine(105, 180, 175, 172, 112, 3.4, 1), { width: 3.6 }),
    S(cubic(230, 205, 260, 200, 278, 215, 282, 236), { width: 3.6 }),
    // eye socket (orbit)
    S(sketchCircle(160, 200, 26, 113), { width: 4, fill: '#2B2B2B', fillOpacity: 0.55 }),
    // nasal aperture
    S(sketchPolygon([[196, 218], [214, 218], [205, 246]], 114), { width: 3.6, fill: '#2B2B2B', fillOpacity: 0.4 }),
    // upper jaw + teeth
    S(cubic(96, 196, 88, 238, 110, 262, 150, 266), { width: 4 }),
    ...Array.from({ length: 6 }, (_, i) =>
      S(sketchLine(104 + i * 14, 254 - i * 1.5, 106 + i * 14, 268 - i * 1.5, 120 + i, 2.6, 0.6), { width: 2.6 }),
    ),
    // mandible
    S(cubic(150, 266, 190, 282, 236, 296, 268, 268), { width: 4.5, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(160, 280, 250, 288, 128, 3, 0.8), { width: 2.6 }),
    ...Array.from({ length: 5 }, (_, i) =>
      S(sketchLine(112 + i * 13, 268, 114 + i * 13, 280, 130 + i, 2.4, 0.6), { width: 2.4 }),
    ),
    // cranial suture
    S(wave(120, 90, 200, 66, 5, 7, 140), { width: 2.4, color: 'inkSoft' }),
    // cheekbone shading arc
    S(cubic(238, 236, 258, 240, 268, 254, 262, 270), { width: 2.6, color: 'inkSoft' }),
  ],
};

// --- Ribcage -------------------------------------------------------------------
const ribcage: IllustrationSpec = {
  id: 'biology.ribcage',
  box: { w: 400, h: 400 },
  strokes: [
    // clavicles
    S(cubic(200, 66, 172, 56, 140, 56, 112, 66), { width: 4.4, fill: BONE, fillOpacity: 0.8 }),
    S(cubic(200, 66, 228, 56, 260, 56, 288, 66), { width: 4.4, fill: BONE, fillOpacity: 0.8 }),
    // sternum
    S(sketchPolygon([[192, 72], [208, 72], [206, 190], [194, 190]], 141), { width: 4.4, fill: BONE, fillOpacity: 0.8 }),
    // 7 true rib pairs sweeping down-out then curving under
    ...Array.from({ length: 7 }, (_, i) => {
      const y0 = 86 + i * 15;
      const drop = 18 + i * 4;
      const out = 62 + i * 5;
      return [
        S(cubic(196, y0, 160, y0 + drop * 0.3, 138 - i * 2, y0 + drop, 200 - out, y0 + drop + 10), {
          width: 3.8, fill: BONE, fillOpacity: 0.5,
        }),
        S(cubic(204, y0, 240, y0 + drop * 0.3, 262 + i * 2, y0 + drop, 200 + out, y0 + drop + 10), {
          width: 3.8, fill: BONE, fillOpacity: 0.5,
        }),
      ];
    }).flat(),
    // thoracic spine behind
    ...Array.from({ length: 8 }, (_, i) =>
      S(rrect(191, 78 + i * 16.5, 18, 10, 150 + i, 3), { width: 2.8, fill: BONE, fillOpacity: 0.85 }),
    ),
    // floating rib pair (short)
    S(cubic(196, 196, 172, 214, 160, 226, 150, 236), { width: 3.4, color: 'inkSoft' }),
    S(cubic(204, 196, 228, 214, 240, 226, 250, 236), { width: 3.4, color: 'inkSoft' }),
  ],
};

// --- Vertebral column -----------------------------------------------------------
const spine: IllustrationSpec = {
  id: 'biology.spine',
  box: { w: 400, h: 400 },
  strokes: [
    // natural S-curve spine with segments: cervical(5) thoracic(7) lumbar(5)
    ...Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      // S-curve: cervical forward, thoracic back, lumbar forward
      const dx = 18 * Math.sin(t * Math.PI * 2 - Math.PI * 0.2);
      const w = 15 + i * 1.4;
      const y = 48 + i * 20;
      return [
        S(rrect(200 + dx - w / 2, y, w, 13, 160 + i, 3.4), { width: 3, fill: BONE, fillOpacity: 0.85 }),
        // spinous process bump behind
        S(sketchLine(200 + dx - w / 2, y + 6, 200 + dx - w / 2 - 9, y + 6, 178 + i, 2.6, 0.7), { width: 2.6 }),
      ];
    }).flat(),
    // intervertebral discs (amber cartilage between segments)
    ...Array.from({ length: 16 }, (_, i) => {
      const t = i / 16;
      const dx = 18 * Math.sin(((i + 0.5) / 16) * Math.PI * 2 - Math.PI * 0.2);
      const w = 15 + i * 1.4;
      return S(sketchLine(200 + dx - w / 2 + 1, 61 + i * 20, 200 + dx + w / 2 - 1, 61 + i * 20, 196 + i, 3, 0.5), {
        width: 3.4, color: NERVE,
      });
    }),
    // sacrum wedge + coccyx
    S(sketchPolygon([[200, 392], [216, 352], [184, 352]], 214), { width: 3.8, fill: BONE, fillOpacity: 0.85 }),
  ],
};

// --- Pelvis girdle with femur heads --------------------------------------------
const pelvis: IllustrationSpec = {
  id: 'biology.pelvis',
  box: { w: 400, h: 400 },
  strokes: [
    // iliac wings
    S(blob(138, 170, 52, 60, 221, 9, 0.1, -14), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    S(blob(262, 170, 52, 60, 222, 9, 0.1, 14), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    // iliac crest ridges
    S(cubic(96, 150, 120, 122, 160, 112, 190, 122), { width: 3.4, color: 'inkSoft' }),
    S(cubic(304, 150, 280, 122, 240, 112, 210, 122), { width: 3.4, color: 'inkSoft' }),
    // sacrum + coccyx
    S(sketchPolygon([[200, 128], [224, 200], [214, 258], [200, 280], [186, 258], [176, 200]], 223), {
      width: 4, fill: BONE, fillOpacity: 0.85,
    }),
    ...Array.from({ length: 4 }, (_, i) => S(sketchLine(188 + i * 8, 150 + i * 22, 188 + i * 8, 168 + i * 22, 224 + i, 2.4, 0.6), { width: 2.4 })),
    // acetabulum sockets + femur heads seated
    S(sketchCircle(148, 252, 20, 229), { width: 3.6, color: 'inkSoft' }),
    S(sketchCircle(252, 252, 20, 230), { width: 3.6, color: 'inkSoft' }),
    S(sketchCircle(148, 254, 14, 231), { width: 3.8, fill: BONE, fillOpacity: 0.9 }),
    S(sketchCircle(252, 254, 14, 232), { width: 3.8, fill: BONE, fillOpacity: 0.9 }),
    // femur necks + shaft stubs
    S(sketchLine(140, 264, 128, 310, 233, 4, 1), { width: 4.4, fill: BONE, fillOpacity: 0.8 }),
    S(sketchLine(260, 264, 272, 310, 234, 4, 1), { width: 4.4, fill: BONE, fillOpacity: 0.8 }),
    // pubic arch
    S(cubic(150, 288, 172, 312, 228, 312, 250, 288), { width: 4 }),
    S(sketchLine(200, 262, 200, 300, 235, 3, 0.7), { width: 3 }),
  ],
};

// --- Femur (long bone anatomy) ---------------------------------------------------
const femur: IllustrationSpec = {
  id: 'biology.femur',
  box: { w: 400, h: 400 },
  strokes: [
    // head
    S(sketchCircle(150, 78, 34, 241), { width: 4.8, fill: BONE, fillOpacity: 0.85 }),
    // neck
    S(sketchLine(174, 92, 204, 130, 242, 4.4, 1), { width: 4.6 }),
    S(sketchLine(166, 108, 196, 144, 243, 4.4, 1), { width: 4.6 }),
    // greater trochanter
    S(blob(226, 122, 26, 20, 244, 7, 0.12, 20), { width: 4, fill: BONE, fillOpacity: 0.8 }),
    // shaft (slightly bowed, double line)
    S(cubic(196, 140, 186, 200, 190, 260, 200, 312), { width: 4.8, fill: BONE, fillOpacity: 0.7 }),
    S(cubic(224, 140, 236, 200, 234, 260, 226, 312), { width: 4.8, fill: BONE, fillOpacity: 0.7 }),
    // nutrient foramen dot
    S(sketchCircle(212, 220, 4, 245), { width: 2.6, color: 'inkSoft' }),
    // condyles (distal end)
    S(cubic(200, 312, 176, 320, 162, 340, 172, 358), { width: 4.4, fill: BONE, fillOpacity: 0.85 }),
    S(cubic(226, 312, 250, 320, 264, 340, 254, 358), { width: 4.4, fill: BONE, fillOpacity: 0.85 }),
    S(cubic(172, 358, 196, 372, 230, 372, 254, 358), { width: 4.4 }),
    // patella groove hint
    S(sketchLine(213, 320, 213, 350, 246, 2.6, 0.8), { width: 2.6, color: 'inkSoft' }),
  ],
};

// --- Knee joint -------------------------------------------------------------------
const kneeJoint: IllustrationSpec = {
  id: 'biology.knee-joint',
  box: { w: 400, h: 400 },
  strokes: [
    // femur entering from above, condyles
    S(cubic(176, 40, 170, 100, 168, 140, 160, 172), { width: 4.8, fill: BONE, fillOpacity: 0.85 }),
    S(cubic(224, 40, 230, 100, 232, 140, 240, 172), { width: 4.8, fill: BONE, fillOpacity: 0.85 }),
    S(cubic(160, 172, 176, 196, 224, 196, 240, 172), { width: 4.4 }),
    // tibia plateau + shaft
    S(cubic(152, 232, 180, 218, 220, 218, 248, 232), { width: 4.4, fill: BONE, fillOpacity: 0.85 }),
    S(cubic(180, 226, 184, 280, 188, 320, 186, 360), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    S(cubic(222, 226, 218, 280, 214, 320, 216, 360), { width: 4.8, fill: BONE, fillOpacity: 0.8 }),
    // fibula stub
    S(sketchLine(252, 240, 258, 330, 247, 3.4, 1), { width: 3.4, fill: BONE, fillOpacity: 0.7 }),
    // articular cartilage (light blue)
    S(cubic(162, 200, 184, 212, 216, 212, 238, 200), { width: 5, color: '#74C0FC', fillOpacity: 0 }),
    // meniscus wedges
    S(sketchPolygon([[168, 214], [196, 222], [172, 228]], 248), { width: 3, color: '#74C0FC', fill: '#74C0FC', fillOpacity: 0.4 }),
    S(sketchPolygon([[232, 214], [204, 222], [228, 228]], 249), { width: 3, color: '#74C0FC', fill: '#74C0FC', fillOpacity: 0.4 }),
    // patella (kneecap) in front
    S(blob(200, 160, 24, 20, 250, 8, 0.1), { width: 4.4, fill: BONE, fillOpacity: 0.9 }),
    // cruciate ligaments (crossing inside)
    S(sketchLine(178, 190, 226, 226, 251, 3.4, 1.2), { width: 3.4, color: NERVE }),
    S(sketchLine(222, 190, 174, 226, 252, 3.4, 1.2), { width: 3.4, color: NERVE }),
    // collateral ligaments
    S(sketchLine(148, 176, 144, 236, 253, 3.2, 1), { width: 3.2, color: 'inkSoft' }),
    S(sketchLine(254, 176, 258, 236, 254, 3.2, 1), { width: 3.2, color: 'inkSoft' }),
  ],
};

// --- Muscles of the arm ------------------------------------------------------------
const muscleArm: IllustrationSpec = {
  id: 'biology.muscle-arm',
  box: { w: 400, h: 400 },
  strokes: [
    // upper arm skin outline
    S(cubic(140, 60, 112, 90, 104, 130, 108, 168), { width: 4.6 }),
    S(cubic(210, 66, 220, 100, 214, 140, 196, 170), { width: 4.6 }),
    // biceps belly (red)
    S(blob(156, 128, 44, 52, 261, 9, 0.1, -8), { width: 4.2, fill: MUSCLE, fillOpacity: 0.62 }),
    // muscle fibre lines
    S(cubic(136, 96, 128, 128, 132, 160, 148, 182), { width: 2.4, color: '#C92A2A' }),
    S(cubic(156, 90, 150, 126, 154, 158, 166, 182), { width: 2.4, color: '#C92A2A' }),
    S(cubic(178, 94, 172, 124, 176, 152, 186, 176), { width: 2.4, color: '#C92A2A' }),
    // triceps hint behind
    S(blob(206, 118, 20, 34, 262, 7, 0.12, 6), { width: 3.4, fill: '#C92A2A', fillOpacity: 0.4 }),
    // tendon to elbow
    S(sketchLine(158, 180, 152, 208, 263, 3.2, 1), { width: 3.2, color: 'inkSoft' }),
    // forearm with flexor lines
    S(cubic(152, 208, 140, 250, 138, 290, 146, 322), { width: 4.4 }),
    S(cubic(196, 170, 188, 230, 184, 280, 176, 322), { width: 4.4 }),
    S(cubic(158, 236, 154, 268, 156, 296, 162, 318), { width: 2.4, color: 'inkSoft' }),
    S(cubic(172, 232, 168, 268, 170, 296, 172, 318), { width: 2.4, color: 'inkSoft' }),
    // hand
    S(blob(162, 348, 20, 26, 264, 8, 0.13), { width: 4 }),
    // shoulder joint cap
    S(sketchCircle(176, 62, 26, 265), { width: 4.2, fill: MUSCLE, fillOpacity: 0.45 }),
  ],
};

// --- Heart (anterior view, great vessels) --------------------------------------------
const heart: IllustrationSpec = {
  id: 'biology.heart',
  box: { w: 400, h: 400 },
  strokes: [
    // aortic arch (red) behind
    S(cubic(200, 150, 186, 96, 214, 62, 246, 84), { width: 7, color: ARTERY }),
    ...Array.from({ length: 3 }, (_, i) =>
      S(sketchLine(222 + i * 12, 62 - i * 2, 226 + i * 12, 40 - i * 2, 271 + i, 3.4, 0.8), { width: 3.4, color: ARTERY }),
    ),
    // pulmonary artery (blue) crossing
    S(cubic(178, 140, 150, 100, 118, 108, 108, 138), { width: 6.4, color: VEIN }),
    // superior vena cava (blue)
    S(sketchLine(148, 118, 144, 66, 275, 6, 1), { width: 7, color: VEIN }),
    // main heart body
    S(blob(200, 234, 92, 84, 281, 10, 0.07, -6), { width: 5, fill: ARTERY, fillOpacity: 0.58 }),
    // atria bumps
    S(blob(152, 158, 34, 26, 282, 7, 0.1, -14), { width: 4.2, fill: '#C92A2A', fillOpacity: 0.5 }),
    S(blob(252, 158, 32, 24, 283, 7, 0.1, 12), { width: 4.2, fill: '#C92A2A', fillOpacity: 0.5 }),
    // interventricular groove + coronary artery
    S(cubic(206, 168, 216, 210, 214, 262, 226, 302), { width: 3.2, color: '#A61E4D' }),
    S(cubic(160, 200, 150, 240, 162, 274, 186, 296), { width: 3, color: ARTERY }),
    // apex tip
    S(cubic(226, 302, 218, 318, 206, 326, 196, 330), { width: 4 }),
    // inferior vena cava
    S(sketchLine(246, 306, 268, 342, 284, 6, 1), { width: 6, color: VEIN }),
    // aorta descends behind apex
    S(cubic(246, 84, 262, 130, 258, 170, 250, 196), { width: 5.4, color: ARTERY }),
  ],
};

// --- Lungs with trachea + bronchi ------------------------------------------------------
const lungs: IllustrationSpec = {
  id: 'biology.lungs',
  box: { w: 400, h: 400 },
  strokes: [
    // trachea with cartilage rings
    S(sketchLine(200, 46, 200, 128, 291, 4.6, 1), { width: 5 }),
    ...Array.from({ length: 6 }, (_, i) => S(sketchLine(193, 58 + i * 12, 207, 58 + i * 12, 292 + i, 2.6, 0.5), { width: 2.6, color: 'inkSoft' })),
    // bronchi split
    S(cubic(200, 128, 180, 148, 158, 160, 138, 178), { width: 4.4, color: 'inkSoft' }),
    S(cubic(200, 128, 220, 148, 242, 160, 262, 178), { width: 4.4, color: 'inkSoft' }),
    // right lung (3 lobes, viewer-left): upper, middle, lower
    S(blob(136, 236, 66, 104, 301, 10, 0.08, 6), { width: 4.6, fill: TISSUE, fillOpacity: 0.42 }),
    S(cubic(84, 226, 108, 216, 136, 220, 158, 234), { width: 2.8, color: '#C92A2A' }), // horizontal fissure
    S(cubic(78, 268, 104, 258, 132, 262, 156, 276), { width: 2.8, color: '#C92A2A' }), // oblique fissure
    // left lung (2 lobes, viewer-right)
    S(blob(266, 244, 64, 98, 302, 10, 0.08, -5), { width: 4.6, fill: TISSUE, fillOpacity: 0.42 }),
    S(cubic(226, 250, 252, 240, 280, 246, 310, 262), { width: 2.8, color: '#C92A2A' }), // oblique fissure
    // cardiac notch (left lung cutaway for the heart)
    S(cubic(232, 262, 226, 282, 236, 300, 252, 310), { width: 3, color: 'inkSoft' }),
    // alveoli clusters at bronchi ends
    ...Array.from({ length: 5 }, (_, i) => {
      const a = -0.6 + i * 0.3;
      return S(sketchCircle(126 + Math.cos(a) * 16, 196 + Math.abs(Math.sin(a)) * 10, 5.5, 310 + i), { width: 2.4, color: VEIN });
    }),
    ...Array.from({ length: 5 }, (_, i) =>
      S(sketchCircle(268 + Math.cos(i * 0.28) * 16, 196 + Math.abs(Math.sin(i * 0.28)) * 10, 5.5, 320 + i), { width: 2.4, color: VEIN }),
    ),
    // diaphragm dome below
    S(cubic(70, 348, 140, 318, 260, 318, 330, 348), { width: 4, color: MUSCLE }),
  ],
};

// --- Brain (sagittal-ish) ---------------------------------------------------------------
const brain: IllustrationSpec = {
  id: 'biology.brain',
  box: { w: 400, h: 400 },
  strokes: [
    // cerebrum
    S(blob(196, 168, 118, 92, 331, 12, 0.07, -4), { width: 4.8, fill: '#EEB1D6', fillOpacity: 0.5 }),
    // longitudinal fissure
    S(cubic(196, 84, 200, 130, 198, 190, 196, 244), { width: 3, color: 'inkSoft' }),
    // gyri squiggles (frontal, parietal, temporal, occipital)
    S(wave(110, 150, 180, 130, 5, 9, 341), { width: 2.6, color: '#C2549B' }),
    S(wave(120, 190, 190, 172, 5, 9, 342), { width: 2.6, color: '#C2549B' }),
    S(wave(214, 128, 286, 150, 5, 9, 343), { width: 2.6, color: '#C2549B' }),
    S(wave(214, 186, 288, 200, 5, 9, 344), { width: 2.6, color: '#C2549B' }),
    S(wave(104, 214, 170, 216, 4, 9, 345), { width: 2.6, color: '#C2549B' }),
    // cerebellum (striped)
    S(blob(258, 268, 52, 30, 346, 9, 0.09, 10), { width: 4.4, fill: '#F1A7C0', fillOpacity: 0.55 }),
    ...Array.from({ length: 4 }, (_, i) =>
      S(sketchLine(222 + i * 4, 258 + i * 6, 292 - i * 4, 268 + i * 4, 351 + i, 2.4, 0.7), { width: 2.4, color: '#C2549B' }),
    ),
    // brainstem
    S(sketchPolyline([[186, 248], [182, 278], [190, 306], [206, 330]], 356), { width: 4.4, fill: '#EEB1D6', fillOpacity: 0.5 }),
    // frontal lobe label tick (facing left)
    S(sketchLine(88, 180, 112, 176, 357, 2.6, 0.8), { width: 2.6, color: 'inkSoft' }),
  ],
};

// --- Stomach ------------------------------------------------------------------------------
const stomach: IllustrationSpec = {
  id: 'biology.stomach',
  box: { w: 400, h: 400 },
  strokes: [
    // esophagus entering
    S(cubic(150, 52, 156, 86, 162, 112, 170, 140), { width: 4.6 }),
    // fundus + body (J-shape)
    S(blob(200, 210, 88, 104, 361, 11, 0.08, -14), { width: 4.8, fill: TISSUE, fillOpacity: 0.4 }),
    S(cubic(158, 150, 124, 190, 130, 252, 172, 292), { width: 4.2, color: 'inkSoft' }),
    // greater curvature + pylorus
    S(cubic(284, 176, 312, 230, 300, 290, 246, 312), { width: 4.2 }),
    // rugae (inner folds)
    S(wave(170, 190, 250, 210, 4, 8, 362), { width: 2.4, color: '#C2549B' }),
    S(wave(176, 230, 262, 248, 4, 8, 363), { width: 2.4, color: '#C2549B' }),
    S(wave(184, 268, 256, 282, 4, 8, 364), { width: 2.4, color: '#C2549B' }),
    // duodenum C-loop
    S(cubic(246, 312, 286, 322, 306, 296, 296, 262), { width: 4.2 }),
    S(cubic(296, 262, 288, 236, 302, 214, 326, 210), { width: 4.2 }),
    // pyloric sphincter pinch
    S(sketchLine(252, 300, 268, 286, 365, 3.4, 1), { width: 3.4, color: 'inkSoft' }),
  ],
};

// --- Neuron ---------------------------------------------------------------------------------
const neuron: IllustrationSpec = {
  id: 'biology.neuron',
  box: { w: 400, h: 400 },
  strokes: [
    // dendrites
    S(cubic(150, 190, 118, 150, 92, 130, 62, 112), { width: 3.4 }),
    S(cubic(146, 214, 108, 208, 84, 216, 54, 232), { width: 3.4 }),
    S(cubic(150, 232, 120, 268, 96, 286, 70, 306), { width: 3.4 }),
    // dendrite twigs
    S(sketchLine(84, 136, 66, 122, 371, 2.4, 0.7), { width: 2.4 }),
    S(sketchLine(78, 222, 58, 220, 372, 2.4, 0.7), { width: 2.4 }),
    S(sketchLine(92, 278, 76, 296, 373, 2.4, 0.7), { width: 2.4 }),
    // soma
    S(blob(172, 210, 42, 36, 374, 10, 0.1, 8), { width: 4.4, fill: '#B2F2BB', fillOpacity: 0.55 }),
    S(sketchCircle(170, 208, 12, 375), { width: 3, fill: NERVE, fillOpacity: 0.6 }), // nucleus
    // axon hillock + axon
    S(sketchLine(214, 210, 244, 210, 376, 3.6, 1), { width: 3.8 }),
    // myelin sheath segments (amber)
    ...Array.from({ length: 4 }, (_, i) =>
      S(blob(266 + i * 33, 210, 15, 12, 380 + i, 7, 0.08), { width: 3, fill: NERVE, fillOpacity: 0.62 }),
    ),
    // nodes of Ranvier gaps visible between segments
    // terminal branch point
    S(sketchLine(366, 210, 374, 210, 385, 3, 0.8), { width: 3 }),
    // axon terminals
    S(cubic(374, 210, 384, 202, 392, 196, 386, 188), { width: 3 }),
    S(cubic(374, 210, 384, 218, 392, 224, 386, 232), { width: 3 }),
    S(sketchCircle(386, 186, 5, 386), { width: 2.6, fill: NERVE, fillOpacity: 0.7 }),
    S(sketchCircle(386, 234, 5, 387), { width: 2.6, fill: NERVE, fillOpacity: 0.7 }),
  ],
};

// --- Eye anatomy (section) ---------------------------------------------------------------------
const eyeAnatomy: IllustrationSpec = {
  id: 'biology.eye-anatomy',
  box: { w: 400, h: 400 },
  strokes: [
    // eyeball
    S(sketchCircle(196, 200, 100, 391), { width: 4.8, fill: '#F8F9FA', fillOpacity: 0.75 }),
    // cornea bulge (front, viewer-left)
    S(cubic(100, 168, 78, 184, 78, 216, 100, 232), { width: 4.2, fill: '#A5D8FF', fillOpacity: 0.5 }),
    // iris + pupil
    S(sketchPolygon([[104, 178], [150, 168], [150, 232], [104, 222]], 392), { width: 3.6, fill: '#1971C2', fillOpacity: 0.65 }),
    S(sketchCircle(138, 200, 14, 393), { width: 3.4, fill: '#1A1A1A', fillOpacity: 0.85 }),
    // lens (behind iris)
    S(sketchEllipse(176, 200, 18, 30, 394), { width: 3.6, fill: '#D0EBFF', fillOpacity: 0.6 }),
    // retina (inner back lining)
    S(cubic(246, 120, 306, 152, 306, 248, 246, 280), { width: 3.6, color: '#E8590C' }),
    // vitreous humour hint
    S(wave(200, 170, 260, 220, 4, 8, 395), { width: 2.2, color: 'inkSoft' }),
    // optic nerve exiting back
    S(cubic(296, 200, 330, 204, 356, 210, 382, 216), { width: 7, color: NERVE }),
    // sclera shading + fovea dot
    S(sketchCircle(258, 200, 4, 396), { width: 2.6, color: '#E8590C' }),
    S(cubic(214, 118, 240, 112, 262, 112, 284, 122), { width: 2.6, color: 'inkSoft' }),
  ],
};

export const ANATOMY_ASSETS: IllustrationSpec[] = [
  skeleton,
  skull,
  ribcage,
  spine,
  pelvis,
  femur,
  kneeJoint,
  muscleArm,
  heart,
  lungs,
  brain,
  stomach,
  neuron,
  eyeAnatomy,
];
