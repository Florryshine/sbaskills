// CharacterRig v2 — jointed layered SVG cartoon human.
// Fixes from the historical prototype (feature/cartoon-character-system):
//   * real joints: hip->knee->ankle and shoulder->elbow->hand (nested rotate groups)
//   * opposite-phase arm/leg swing during walk/run (prototype swung same-side together)
//   * continuous lip-sync openness (prototype was a binary flap)
//   * parameterised DNA: any character, any palette, proportions, hair, outfit
// Deterministic per-frame math (Remotion-friendly): every value derives from `t`.
import React from "react";
import type { CharacterDNA, Expression, Action } from "../types";
import { darken, lighten } from "../palette";
import { HairBack, HairFront } from "./hair";
import { FaceParts, HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY } from "./face";

// ---- base rig geometry (character stands with feet at y=620, centre x=200) ----
export const RIG = {
  w: 400,
  h: 640,
  footY: 620,
  headCX: HEAD_CX, headCY: HEAD_CY,
  neckTop: 196,
  shoulderY: 232, shoulderLX: 152, shoulderRX: 248,
  elbowY: 302,
  handY: 372,
  hipY: 424, hipLX: 172, hipRX: 228,
  kneeY: 524,
  ankleY: 606,
};

interface PoseAngles {
  bobY: number;
  lean: number; // torso lean degrees
  headTilt: number;
  hipL: number; hipR: number; // thigh rotation at hip (deg, + = forward swing of leg)
  kneeL: number; kneeR: number; // shin bend at knee (deg, + = bend backwards naturally)
  shoulderL: number; shoulderR: number; // arm rotation at shoulder (deg, + = forward)
  elbowL: number; elbowR: number; // forearm bend (deg, + = natural forward bend)
  shoulderLift: number; // torso shrug
  xShift: number;
}

const DEG = Math.PI / 180;

function poseFor(action: Action, t: number, dna: CharacterDNA, talk: boolean): PoseAngles {
  const breathe = Math.sin(t * 2.1) * 1.8;
  const idleSway = Math.sin(t * 1.05) * 1.6;
  switch (action) {
    case "walk": {
      const phi = t * Math.PI * 2 * 1.7; // ~1.7 steps/sec
      const s = Math.sin(phi), s2 = Math.sin(phi + Math.PI);
      const swing = 25;
      return {
        bobY: -Math.abs(Math.sin(phi)) * 3.2 + breathe * 0.4,
        lean: 4,
        headTilt: Math.sin(phi) * 1.2,
        hipL: s * swing, hipR: s2 * swing,
        kneeL: 6 + 22 * Math.max(0, Math.sin(phi + 1.05)), kneeR: 6 + 22 * Math.max(0, Math.sin(phi + Math.PI + 1.05)),
        shoulderL: -s * swing * 0.85, shoulderR: -s2 * swing * 0.85,
        elbowL: 14, elbowR: 14,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "run": {
      const phi = t * Math.PI * 2 * 2.7;
      const s = Math.sin(phi), s2 = Math.sin(phi + Math.PI);
      return {
        bobY: -Math.abs(Math.sin(phi)) * 6 + breathe * 0.3,
        lean: 13,
        headTilt: Math.sin(phi) * 2,
        hipL: s * 36, hipR: s2 * 36,
        kneeL: 12 + 46 * Math.max(0, Math.sin(phi + 0.9)), kneeR: 12 + 46 * Math.max(0, Math.sin(phi + Math.PI + 0.9)),
        shoulderL: -s * 44, shoulderR: -s2 * 44,
        elbowL: 78, elbowR: 78,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "jump": {
      // 1.4s loop: crouch, launch, air tuck, land
      const p = (t % 1.4) / 1.4;
      let y = 0, crouch = 0, arm = 30;
      if (p < 0.18) { crouch = (p / 0.18) * 16; y = crouch * 0.8; arm = -20; }
      else if (p < 0.72) {
        const a = (p - 0.18) / 0.54;
        y = -Math.sin(a * Math.PI) * 95;
        crouch = 0; arm = 150 * Math.sin(a * Math.PI);
      } else { const q = (p - 0.72) / 0.28; crouch = Math.sin(q * Math.PI) * 14; y = crouch * 0.8; arm = 10; }
      return {
        bobY: y + breathe * 0.2, lean: 2, headTilt: -y * 0.03,
        hipL: crouch * 2.2, hipR: crouch * 2.2,
        kneeL: 8 + crouch * 2.4, kneeR: 8 + crouch * 2.4,
        shoulderL: -arm, shoulderR: -arm,
        elbowL: 10, elbowR: 10, shoulderLift: 0, xShift: 0,
      };
    }
    case "dance": {
      const phi = t * Math.PI * 2 * 1.35;
      const s = Math.sin(phi), c = Math.cos(phi);
      return {
        bobY: -Math.abs(c) * 4 + breathe * 0.4,
        lean: s * 5,
        headTilt: s * 7,
        hipL: c * 8, hipR: -c * 8,
        kneeL: 10 + 8 * Math.max(0, s), kneeR: 10 + 8 * Math.max(0, -s),
        shoulderL: -70 - s * 55, shoulderR: -70 + s * 55,
        elbowL: 40 + s * 25, elbowR: 40 - s * 25,
        shoulderLift: 0, xShift: s * 5,
      };
    }
    case "point": {
      const bounce = Math.sin(t * 3.2) * 2;
      return {
        bobY: bounce + breathe * 0.5, lean: 2, headTilt: -3,
        hipL: 3, hipR: -3, kneeL: 4, kneeR: 4,
        shoulderL: 8, shoulderR: -96, elbowL: 12, elbowR: -4,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "wave": {
      const w = Math.sin(t * 7.5) * 22;
      return {
        bobY: breathe * 0.6, lean: 0, headTilt: -4 + Math.sin(t * 2) * 2,
        hipL: 2, hipR: -2, kneeL: 3, kneeR: 3,
        shoulderL: 6, shoulderR: -152, elbowL: 10, elbowR: -12 + w,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "sit": {
      return {
        bobY: -24, lean: 3, headTilt: 0,
        hipL: -86, hipR: -86, kneeL: 84, kneeR: 88,
        shoulderL: 10, shoulderR: -14, elbowL: 16, elbowR: 18,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "think": {
      const tap = Math.sin(t * 5.2) * 2.4;
      return {
        bobY: breathe * 0.5, lean: -2, headTilt: 8,
        hipL: 2, hipR: -2, kneeL: 3, kneeR: 3,
        shoulderL: 24, shoulderR: -38, elbowL: -74, elbowR: -108 + tap,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "cheer": {
      const jump = Math.abs(Math.sin(t * Math.PI * 1.6)) * 14;
      return {
        bobY: -jump + breathe * 0.3, lean: 0, headTilt: Math.sin(t * 3.1) * 3,
        hipL: 4, hipR: -4, kneeL: 6, kneeR: 6,
        shoulderL: -158, shoulderR: -162, elbowL: -8, elbowR: -12,
        shoulderLift: 0, xShift: 0,
      };
    }
    case "shrug": {
      const u = Math.sin(t * 2.4) * 2;
      return {
        bobY: breathe * 0.5, lean: 0, headTilt: 6,
        hipL: 4, hipR: -4, kneeL: 4, kneeR: 4,
        shoulderL: 52, shoulderR: -52, elbowL: -66, elbowR: -66,
        shoulderLift: 3 + u, xShift: 0,
      };
    }
    case "talk": {
      const emph = talk ? Math.sin(t * 5.4) * 2.2 : 0;
      return {
        bobY: breathe, lean: 1, headTilt: Math.sin(t * 1.4) * 2.4 + (talk ? Math.sin(t * 2.7) * 1.6 : 0),
        hipL: 2, hipR: -2, kneeL: 3, kneeR: 3,
        shoulderL: 10 + emph, shoulderR: -12 + emph, elbowL: 22, elbowR: 26,
        shoulderLift: 0, xShift: 0,
      };
    }
    default: { // idle
      return {
        bobY: breathe, lean: 0.5, headTilt: idleSway * 0.5,
        hipL: 1.5, hipR: -1.5, kneeL: 2.5, kneeR: 2.5,
        shoulderL: 4 + idleSway, shoulderR: -4 + idleSway, elbowL: 9, elbowR: 9,
        shoulderLift: 0, xShift: 0,
      };
    }
  }
}

// blink: closed for a few frames every ~3.5s
export function blinkAmount(t: number, seed = 0): number {
  const period = 3.4 + (seed % 1) * 0.8;
  const phase = (t + seed * 1.7) % period;
  if (phase > period - 0.14) {
    const k = (phase - (period - 0.14)) / 0.14;
    return Math.sin(k * Math.PI);
  }
  return 0;
}

export interface CharacterRigProps {
  dna: CharacterDNA;
  expression?: Expression;
  action?: Action;
  talkOpen?: number;      // 0..1 continuous lip-sync
  t?: number;             // seconds since scene start
  blinkSeed?: number;
  scale?: number;         // 1 = rig height ~620 units
  x?: number; y?: number; // placement of FEET centre (in parent's coordinate space)
  flip?: boolean;
  shadow?: boolean;
  style?: React.CSSProperties;
}

export function CharacterRig(props: CharacterRigProps) {
  const {
    dna, expression = "neutral", action = "idle", talkOpen = 0,
    t = 0, blinkSeed = 0, scale = 1, x = 0, y = 0, flip = false,
    shadow = true, style,
  } = props;
  const p = poseFor(action, t, dna, talkOpen > 0.08);
  const bodyW = dna.bodyWidth;
  const H = dna.height;

  // ground shadow (scales with jump height)
  const airLift = Math.max(0, -p.bobY);
  const shadowScale = Math.max(0.45, 1 - airLift / 160);

  const skinShade = darken(dna.skin, 0.22);
  const skinLight = lighten(dna.skin, 0.18);

  const outfit = dna.outfit;
  const hasSkirt = outfit === "dress" || outfit === "pinafore" || outfit === "skirt-blouse";
  const shortsOrSkirt = outfit === "sports";

  const outline = "rgba(28,20,18,0.82)";
  const SW = 5; // stroke width base

  // feet stand at (x, y); rig drawn with feet at RIG.footY
  const footSquash = action === "sit" ? 1 : 1;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale * footSquash}) translate(${-RIG.w / 2} ${-RIG.footY})`}
      style={style}
    >
      {shadow && (
        <ellipse
          cx={RIG.w / 2} cy={RIG.footY + 6} rx={95 * shadowScale} ry={16 * shadowScale}
          fill="rgba(15,15,30,0.18)"
        />
      )}

      <g transform={`translate(${p.xShift} ${p.bobY})`}>
        {/* ---------- BACK ARM (left, drawn behind torso) ---------- */}
        <g transform={`rotate(${p.shoulderL} ${RIG.shoulderLX} ${RIG.shoulderY})`}>
          <g transform={`rotate(${p.elbowL} ${RIG.shoulderLX - 22} ${RIG.elbowY})`}>
            <ArmBack dna={dna} skinShade={skinShade} outline={outline} sw={SW} />
          </g>
        </g>

        {/* ---------- LEGS (behind torso/skirt) ---------- */}
        <Leg
          side="L" dna={dna} skinShade={skinShade} outline={outline} sw={SW}
          hip={p.hipL} knee={p.kneeL} shortsOrSkirt={shortsOrSkirt} hasSkirt={hasSkirt}
        />
        <Leg
          side="R" dna={dna} skinShade={skinShade} outline={outline} sw={SW}
          hip={p.hipR} knee={p.kneeR} shortsOrSkirt={shortsOrSkirt} hasSkirt={hasSkirt}
        />

        {/* ---------- TORSO ---------- */}
        <Torso dna={dna} outline={outline} sw={SW} lean={p.lean} lift={p.shoulderLift} />

        {/* skirt/dress drawn over upper legs */}
        {hasSkirt && <Skirt dna={dna} outfit={outfit} outline={outline} sw={SW} />}

        {/* ---------- HEAD ---------- */}
        <g transform={`rotate(${p.headTilt} ${HEAD_CX} ${RIG.neckTop + 20})`}>
          <g transform={`translate(${HEAD_CX} ${HEAD_CY}) scale(${dna.headScale}) translate(${-HEAD_CX} ${-HEAD_CY})`}>
            {/* hair behind head */}
            <HairBack dna={dna} />
            {/* ears */}
            <g>
              <ellipse cx={HEAD_CX - HEAD_RX - 4} cy={HEAD_CY + 8} rx={13} ry={17} fill={dna.skin} stroke={outline} strokeWidth={SW * 0.8} />
              <ellipse cx={HEAD_CX + HEAD_RX + 4} cy={HEAD_CY + 8} rx={13} ry={17} fill={dna.skin} stroke={outline} strokeWidth={SW * 0.8} />
              {dna.earrings && (
                <>
                  <circle cx={HEAD_CX - HEAD_RX - 4} cy={HEAD_CY + 24} r={6} fill={dna.accentColor} stroke={outline} strokeWidth={2.5} />
                  <circle cx={HEAD_CX + HEAD_RX + 4} cy={HEAD_CY + 24} r={6} fill={dna.accentColor} stroke={outline} strokeWidth={2.5} />
                </>
              )}
            </g>
            {/* face */}
            <ellipse cx={HEAD_CX} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY} fill={dna.skin} stroke={outline} strokeWidth={SW} />
            <FaceParts
              dna={dna} expression={expression} talkOpen={talkOpen}
              blink={blinkAmount(t, blinkSeed)} t={t}
            />
            {/* hair front */}
            <HairFront dna={dna} />
          </g>
        </g>

        {/* ---------- FRONT ARM (right, drawn over torso) ---------- */}
        <g transform={`rotate(${p.shoulderR} ${RIG.shoulderRX} ${RIG.shoulderY})`}>
          <g transform={`rotate(${p.elbowR} ${RIG.shoulderRX + 22} ${RIG.elbowY})`}>
            <ArmFront dna={dna} skin={dna.skin} skinLight={skinLight} outline={outline} sw={SW} />
          </g>
        </g>
      </g>
    </g>
  );
}

// ================= body parts =================

function ArmBack({ dna, skinShade, outline, sw }: { dna: CharacterDNA; skinShade: string; outline: string; sw: number }) {
  const sleeve = dna.outfit === "lab-coat" ? "#f4f4f2" : dna.topColor;
  const sleeveColor = darken(sleeve, 0.12);
  const shortSleeve = dna.outfit === "tshirt" || dna.outfit === "sports" || dna.outfit === "skirt-blouse" || dna.outfit === "dress";
  return (
    <g>
      {/* upper arm */}
      <path
        d={`M ${RIG.shoulderLX - 12} ${RIG.shoulderY - 8} L ${RIG.shoulderLX + 14} ${RIG.shoulderY - 6}
            L ${RIG.shoulderLX - 4} ${RIG.elbowY + 14} L ${RIG.shoulderLX - 30} ${RIG.elbowY + 8} Z`}
        fill={shortSleeve ? sleeveColor : sleeveColor}
        stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      {!shortSleeve && (
        <path
          d={`M ${RIG.shoulderLX - 28} ${RIG.elbowY + 4} L ${RIG.shoulderLX - 2} ${RIG.elbowY + 12}
              L ${RIG.shoulderLX - 8} ${RIG.handY - 6} L ${RIG.shoulderLX - 34} ${RIG.handY - 12} Z`}
          fill={sleeveColor} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
        />
      )}
      {/* forearm (skin) */}
      <path
        d={`M ${RIG.shoulderLX - 26} ${RIG.elbowY + 6} L ${RIG.shoulderLX + 0} ${RIG.elbowY + 12}
            L ${RIG.shoulderLX - 6} ${RIG.handY - 4} L ${RIG.shoulderLX - 32} ${RIG.handY - 10} Z`}
        fill={skinShade} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      <circle cx={RIG.shoulderLX - 19} cy={RIG.handY + 2} r={13} fill={skinShade} stroke={outline} strokeWidth={sw * 0.85} />
    </g>
  );
}

function ArmFront({ dna, skin, skinLight, outline, sw }: { dna: CharacterDNA; skin: string; skinLight: string; outline: string; sw: number }) {
  const sleeve = dna.outfit === "lab-coat" ? "#ffffff" : dna.topColor;
  const shortSleeve = dna.outfit === "tshirt" || dna.outfit === "sports" || dna.outfit === "skirt-blouse" || dna.outfit === "dress";
  return (
    <g>
      {/* upper arm */}
      <path
        d={`M ${RIG.shoulderRX - 14} ${RIG.shoulderY - 8} L ${RIG.shoulderRX + 12} ${RIG.shoulderY - 8}
            L ${RIG.shoulderRX + 30} ${RIG.elbowY + 8} L ${RIG.shoulderRX + 4} ${RIG.elbowY + 14} Z`}
        fill={sleeve} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      {!shortSleeve && (
        <path
          d={`M ${RIG.shoulderRX + 2} ${RIG.elbowY + 12} L ${RIG.shoulderRX + 28} ${RIG.elbowY + 4}
              L ${RIG.shoulderRX + 34} ${RIG.handY - 12} L ${RIG.shoulderRX + 8} ${RIG.handY - 6} Z`}
          fill={sleeve} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
        />
      )}
      {/* forearm */}
      <path
        d={`M ${RIG.shoulderRX + 0} ${RIG.elbowY + 12} L ${RIG.shoulderRX + 26} ${RIG.elbowY + 6}
            L ${RIG.shoulderRX + 32} ${RIG.handY - 10} L ${RIG.shoulderRX + 6} ${RIG.handY - 4} Z`}
        fill={skin} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      {/* hand */}
      <circle cx={RIG.shoulderRX + 19} cy={RIG.handY + 2} r={13} fill={skin} stroke={outline} strokeWidth={sw * 0.85} />
      <circle cx={RIG.shoulderRX + 22} cy={RIG.handY - 1} r={4.5} fill={skinLight} />
    </g>
  );
}

function Leg({ side, dna, skinShade, outline, sw, hip, knee, shortsOrSkirt, hasSkirt }: {
  side: "L" | "R"; dna: CharacterDNA; skinShade: string; outline: string; sw: number;
  hip: number; knee: number; shortsOrSkirt: boolean; hasSkirt: boolean;
}) {
  const hipX = side === "L" ? RIG.hipLX : RIG.hipRX;
  const kneeX = side === "L" ? RIG.hipLX - 4 : RIG.hipRX + 4;
  const ankleX = side === "L" ? RIG.hipLX - 8 : RIG.hipRX + 8;
  const trouserColor = side === "L" ? darken(dna.bottomColor, 0.08) : dna.bottomColor;
  const skinLeg = side === "L" ? skinShade : dna.skin;
  const bareLeg = hasSkirt || shortsOrSkirt;
  return (
    <g transform={`rotate(${hip} ${hipX} ${RIG.hipY})`}>
      {/* thigh */}
      <path
        d={`M ${hipX - 17} ${RIG.hipY - 6} L ${hipX + 17} ${RIG.hipY - 6}
            L ${kneeX + 14} ${RIG.kneeY} L ${kneeX - 14} ${RIG.kneeY} Z`}
        fill={bareLeg ? skinLeg : trouserColor} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      {/* shin (nested knee rotation) */}
      <g transform={`rotate(${knee} ${kneeX} ${RIG.kneeY})`}>
        <path
          d={`M ${kneeX - 14} ${RIG.kneeY - 4} L ${kneeX + 14} ${RIG.kneeY - 4}
              L ${ankleX + 11} ${RIG.ankleY} L ${ankleX - 11} ${RIG.ankleY} Z`}
          fill={bareLeg ? skinLeg : trouserColor} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
        />
        {/* sock */}
        <rect x={ankleX - 12} y={RIG.ankleY - 26} width={24} height={16} rx={6}
          fill={bareLeg ? "#ffffff" : trouserColor} stroke={outline} strokeWidth={sw * 0.7} />
        {/* shoe */}
        <g>
          <path
            d={`M ${ankleX - 14} ${RIG.ankleY - 10}
                Q ${ankleX + (side === "L" ? -26 : 30)} ${RIG.ankleY - 12} ${ankleX + (side === "L" ? -28 : 34)} ${RIG.ankleY + 8}
                Q ${ankleX + (side === "L" ? -26 : 32)} ${RIG.ankleY + 18} ${ankleX - 10} ${RIG.ankleY + 16}
                L ${ankleX - 13} ${RIG.ankleY - 4} Z`}
            fill={dna.shoeColor} stroke={outline} strokeWidth={sw * 0.9} strokeLinejoin="round"
          />
          <ellipse cx={ankleX + (side === "L" ? -6 : 8)} cy={RIG.ankleY + 12} rx={16} ry={5}
            fill={darken(dna.shoeColor, 0.25)} />
        </g>
      </g>
    </g>
  );
}

function Torso({ dna, outline, sw, lean, lift }: { dna: CharacterDNA; outline: string; sw: number; lean: number; lift: number }) {
  const w = dna.bodyWidth;
  const topColor = dna.topColor;
  const topShade = darken(topColor, 0.14);
  const shoulderY = RIG.shoulderY + lift;
  const top = RIG.neckTop + 14;
  const hip = RIG.hipY;
  // torso silhouette (wide shoulders -> hips)
  const body = `M ${200 - 52 * w} ${shoulderY + 4}
    Q ${200 - 62 * w} ${shoulderY - 14} ${200 - 40 * w} ${top}
    L ${200 + 40 * w} ${top}
    Q ${200 + 62 * w} ${shoulderY - 14} ${200 + 52 * w} ${shoulderY + 4}
    Q ${200 + 58 * w} ${(shoulderY + hip) / 2} ${200 + 50 * w} ${hip}
    L ${200 - 50 * w} ${hip}
    Q ${200 - 58 * w} ${(shoulderY + hip) / 2} ${200 - 52 * w} ${shoulderY + 4} Z`;
  return (
    <g transform={`rotate(${lean} 200 ${RIG.hipY})`}>
      {/* neck */}
      <rect x={200 - 16} y={RIG.neckTop - 10} width={32} height={36} rx={12}
        fill={darken(dna.skin, 0.1)} stroke={outline} strokeWidth={sw * 0.8} />
      {/* main torso */}
      <path d={body} fill={topColor} stroke={outline} strokeWidth={sw} strokeLinejoin="round" />
      {/* outfit details */}
      {dna.outfit === "hoodie" && (
        <>
          <path d={`M ${200 - 34} ${top - 4} Q 200 ${top + 26} ${200 + 34} ${top - 4} L ${200 + 26} ${top + 18} Q 200 ${top + 44} ${200 - 26} ${top + 18} Z`}
            fill={topShade} stroke={outline} strokeWidth={sw * 0.8} />
          <rect x={200 - 3} y={top + 26} width={6} height={44} rx={3} fill="#ffffff" opacity={0.9} />
          <rect x={200 - 30 * w} y={hip - 46} width={60 * w} height={26} rx={9} fill={topShade} stroke={outline} strokeWidth={sw * 0.7} />
        </>
      )}
      {dna.outfit === "lab-coat" && (
        <>
          <path d={`M 200 ${top + 6} L ${200 - 4} ${hip} L ${200 + 30} ${hip} L ${200 + 26} ${top + 6} Z`} fill={darken(topColor, 0.05)} stroke={outline} strokeWidth={sw * 0.7} />
          <path d={`M ${200 - 20} ${top + 2} L 200 ${top + 12} L ${200 + 20} ${top + 2} L ${200 + 14} ${top - 8} L ${200 - 14} ${top - 8} Z`} fill="#cfe3ff" stroke={outline} strokeWidth={sw * 0.7} />
          <circle cx={200 + 18} cy={top + 34} r={5} fill={dna.accentColor} />
          <rect x={200 - 42 * w} y={top + 42} width={16} height={20} rx={3} fill="#e8eef7" stroke={outline} strokeWidth={2} />
          <rect x={200 + 26 * w} y={top + 42} width={16} height={20} rx={3} fill="#e8eef7" stroke={outline} strokeWidth={2} />
        </>
      )}
      {dna.outfit === "tshirt" && (
        <path d={`M ${200 - 30 * w} ${top + 16} Q 200 ${top + 40} ${200 + 30 * w} ${top + 16}`} fill="none" stroke={outline} strokeWidth={sw * 0.7} />
      )}
      {dna.outfit === "sports" && (
        <>
          <path d={`M ${200 - 26} ${top + 10} L ${200 + 26} ${top + 10}`} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
          <circle cx={200} cy={top + 52} r={12} fill="#fff" opacity={0.92} />
        </>
      )}
      {dna.outfit === "shirt-trousers" && (
        <>
          <path d={`M 200 ${top + 4} L 200 ${hip}`} stroke={darken(topColor, 0.3)} strokeWidth={3} />
          <circle cx={200} cy={top + 26} r={4.5} fill="#fff" stroke={outline} strokeWidth={1.6} />
          <circle cx={200} cy={top + 52} r={4.5} fill="#fff" stroke={outline} strokeWidth={1.6} />
          <circle cx={200} cy={top + 78} r={4.5} fill="#fff" stroke={outline} strokeWidth={1.6} />
          <path d={`M ${200 - 18} ${top - 2} L ${200 - 6} ${top + 18} L ${200 + 6} ${top + 18} L ${200 + 18} ${top - 2} Z`} fill={darken(topColor, 0.25)} stroke={outline} strokeWidth={sw * 0.7} />
        </>
      )}
      {(dna.outfit === "dress" || dna.outfit === "pinafore" || dna.outfit === "skirt-blouse") && (
        <>
          {/* chest accent / strap */}
          <path d={`M ${200 - 30 * w} ${top + 8} L 200 ${top + 30} L ${200 + 30 * w} ${top + 8}`} fill="none" stroke={dna.accentColor} strokeWidth={6} strokeLinecap="round" />
        </>
      )}
      {/* hem shadow */}
      <path d={`M ${200 - 50 * w} ${hip - 6} L ${200 + 50 * w} ${hip - 6} L ${200 + 48 * w} ${hip} L ${200 - 48 * w} ${hip} Z`} fill={topShade} />
    </g>
  );
}

function Skirt({ dna, outfit, outline, sw }: { dna: CharacterDNA; outfit: string; outline: string; sw: number }) {
  const color = outfit === "skirt-blouse" ? dna.bottomColor : dna.topColor === dna.bottomColor ? dna.topColor : dna.bottomColor;
  const hemY = outfit === "dress" ? 512 : outfit === "pinafore" ? 496 : 478;
  const flare = outfit === "dress" ? 86 : 66;
  return (
    <g>
      <path
        d={`M ${200 - 50} ${RIG.hipY - 18}
            Q ${200 - flare - 14} ${RIG.hipY + (hemY - RIG.hipY) / 2} ${200 - flare} ${hemY}
            Q 200 ${hemY + 16} ${200 + flare} ${hemY}
            Q ${200 + flare + 14} ${RIG.hipY + (hemY - RIG.hipY) / 2} ${200 + 50} ${RIG.hipY - 18} Z`}
        fill={color} stroke={outline} strokeWidth={sw} strokeLinejoin="round"
      />
      <path d={`M ${200 - flare + 8} ${hemY - 4} Q 200 ${hemY + 10} ${200 + flare - 8} ${hemY - 4}`}
        fill="none" stroke={darken(color, 0.2)} strokeWidth={sw * 0.7} />
    </g>
  );
}
