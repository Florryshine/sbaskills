// FaceParts — 10 expressions + continuous lip-sync mouth + blinking eyes.
import React from "react";
import type { CharacterDNA, Expression } from "../types";
import { darken } from "../palette";

export const HEAD_CX = 200;
export const HEAD_CY = 118;
export const HEAD_RX = 72;
export const HEAD_RY = 78;

interface ExprDef {
  browL: string; browR: string;      // paths (left = character's left on screen)
  eyeMode: "open" | "wide" | "narrow" | "closed-happy" | "closed-sad" | "half";
  mouth: "smile" | "big-smile" | "frown" | "o" | "wobble" | "flat" | "smirk" | "open-smile" | "gritted";
  tilt: number;
  blush?: boolean;
  sweat?: boolean;
  teeth?: boolean;
}

const E = HEAD_RX - 30; // eye offset from centre
const EY = HEAD_CY - 8; // eye height

const EXPRESSIONS: Record<Expression, ExprDef> = {
  neutral: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 26} Q ${HEAD_CX - E} ${EY - 34} ${HEAD_CX - E + 20} ${EY - 28}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 28} Q ${HEAD_CX + E} ${EY - 34} ${HEAD_CX + E + 22} ${EY - 26}`,
    eyeMode: "open", mouth: "smile", tilt: 0,
  },
  happy: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 28} Q ${HEAD_CX - E} ${EY - 38} ${HEAD_CX - E + 20} ${EY - 30}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 30} Q ${HEAD_CX + E} ${EY - 38} ${HEAD_CX + E + 22} ${EY - 28}`,
    eyeMode: "open", mouth: "big-smile", tilt: 0, teeth: true,
  },
  excited: {
    browL: `M ${HEAD_CX - E - 24} ${EY - 32} Q ${HEAD_CX - E} ${EY - 44} ${HEAD_CX - E + 22} ${EY - 34}`,
    browR: `M ${HEAD_CX + E - 22} ${EY - 34} Q ${HEAD_CX + E} ${EY - 44} ${HEAD_CX + E + 24} ${EY - 32}`,
    eyeMode: "wide", mouth: "open-smile", tilt: -2, teeth: true,
  },
  sad: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 26} Q ${HEAD_CX - E - 4} ${EY - 36} ${HEAD_CX - E + 18} ${EY - 30}`,
    browR: `M ${HEAD_CX + E - 18} ${EY - 30} Q ${HEAD_CX + E + 4} ${EY - 36} ${HEAD_CX + E + 22} ${EY - 26}`,
    eyeMode: "closed-sad", mouth: "frown", tilt: 3, blush: true,
  },
  angry: {
    browL: `M ${HEAD_CX - E - 24} ${EY - 36} Q ${HEAD_CX - E - 2} ${EY - 28} ${HEAD_CX - E + 20} ${EY - 20}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 20} Q ${HEAD_CX + E + 2} ${EY - 28} ${HEAD_CX + E + 24} ${EY - 36}`,
    eyeMode: "narrow", mouth: "gritted", tilt: 0,
  },
  surprised: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 38} Q ${HEAD_CX - E} ${EY - 50} ${HEAD_CX - E + 20} ${EY - 40}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 40} Q ${HEAD_CX + E} ${EY - 50} ${HEAD_CX + E + 22} ${EY - 38}`,
    eyeMode: "wide", mouth: "o", tilt: 0, blush: true,
  },
  scared: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 34} Q ${HEAD_CX - E} ${EY - 46} ${HEAD_CX - E + 20} ${EY - 36}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 36} Q ${HEAD_CX + E} ${EY - 46} ${HEAD_CX + E + 22} ${EY - 34}`,
    eyeMode: "wide", mouth: "wobble", tilt: -2, sweat: true, blush: true,
  },
  confused: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 30} Q ${HEAD_CX - E} ${EY - 40} ${HEAD_CX - E + 20} ${EY - 30}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 22} Q ${HEAD_CX + E} ${EY - 36} ${HEAD_CX + E + 22} ${EY - 32}`,
    eyeMode: "open", mouth: "wobble", tilt: 4, sweat: true,
  },
  proud: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 30} Q ${HEAD_CX - E} ${EY - 40} ${HEAD_CX - E + 20} ${EY - 30}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 30} Q ${HEAD_CX + E} ${EY - 40} ${HEAD_CX + E + 22} ${EY - 30}`,
    eyeMode: "closed-happy", mouth: "smirk", tilt: -4,
  },
  sleepy: {
    browL: `M ${HEAD_CX - E - 22} ${EY - 24} Q ${HEAD_CX - E} ${EY - 30} ${HEAD_CX - E + 20} ${EY - 24}`,
    browR: `M ${HEAD_CX + E - 20} ${EY - 24} Q ${HEAD_CX + E} ${EY - 30} ${HEAD_CX + E + 22} ${EY - 24}`,
    eyeMode: "half", mouth: "flat", tilt: 5,
  },
};

export function FaceParts({ dna, expression, talkOpen, blink, t }: {
  dna: CharacterDNA; expression: Expression; talkOpen: number; blink: number; t: number;
}) {
  const def = EXPRESSIONS[expression] || EXPRESSIONS.neutral;
  const outline = "rgba(28,20,18,0.85)";
  const browStroke = 6.5;

  // ---- eyes ----
  const eyeW = def.eyeMode === "wide" ? 24 : 21;
  const eyeH = def.eyeMode === "wide" ? 27 : def.eyeMode === "narrow" ? 12 : def.eyeMode === "half" ? 14 : 22;
  const pupilR = def.eyeMode === "wide" ? 9 : 7.5;
  const lookX = Math.sin(t * 0.9) * 2.5; // subtle eye drift

  const renderEye = (side: -1 | 1) => {
    const cx = HEAD_CX + side * E;
    if (def.eyeMode === "closed-happy") {
      return <path key={side} d={`M ${cx - 16} ${EY + 6} Q ${cx} ${EY - 12} ${cx + 16} ${EY + 6}`} fill="none" stroke={outline} strokeWidth={6} strokeLinecap="round" />;
    }
    if (def.eyeMode === "closed-sad") {
      return <path key={side} d={`M ${cx - 16} ${EY - 4} Q ${cx} ${EY + 12} ${cx + 16} ${EY - 4}`} fill="none" stroke={outline} strokeWidth={6} strokeLinecap="round" />;
    }
    const blinkScale = Math.max(0.08, 1 - blink);
    return (
      <g key={side}>
        <ellipse cx={cx} cy={EY} rx={eyeW} ry={eyeH * blinkScale} fill="#ffffff" stroke={outline} strokeWidth={5} />
        <ellipse cx={cx + lookX} cy={EY + 2} rx={pupilR} ry={Math.min(pupilR + 1.6, pupilR + 1.6 * blinkScale)} fill="#2d1d16" />
        <circle cx={cx + lookX + 3} cy={EY - 3} r={2.6} fill="#ffffff" />
      </g>
    );
  };

  // ---- mouth: lip-sync overrides the expression mouth when talking ----
  const mouthY = HEAD_CY + 44;
  const open = talkOpen; // 0..1
  let mouthEl: React.ReactNode;
  if (open > 0.06) {
    const rx = 15 + open * 9;
    const ry = 4 + open * 17;
    const smileUp = def.mouth === "big-smile" || def.mouth === "open-smile" || def.mouth === "smile" || def.mouth === "smirk";
    const cy = smileUp ? mouthY - 2 : mouthY;
    mouthEl = (
      <g>
        <ellipse cx={HEAD_CX} cy={cy} rx={rx} ry={ry} fill="#5f2637" stroke={outline} strokeWidth={4.5} />
        <ellipse cx={HEAD_CX} cy={cy + ry * 0.45} rx={rx * 0.62} ry={ry * 0.4} fill="#e4756d" />
        {open > 0.5 && <rect x={HEAD_CX - rx * 0.7} y={cy - ry + 2} width={rx * 1.4} height={5} rx={2.5} fill="#fff" />}
      </g>
    );
  } else {
    switch (def.mouth) {
      case "big-smile":
        mouthEl = (
          <g>
            <path d={`M ${HEAD_CX - 30} ${mouthY - 8} Q ${HEAD_CX} ${mouthY + 26} ${HEAD_CX + 30} ${mouthY - 8} Q ${HEAD_CX} ${mouthY + 2} ${HEAD_CX - 30} ${mouthY - 8} Z`}
              fill="#5f2637" stroke={outline} strokeWidth={4.5} strokeLinejoin="round" />
            <path d={`M ${HEAD_CX - 22} ${mouthY - 5} Q ${HEAD_CX} ${mouthY - 1} ${HEAD_CX + 22} ${mouthY - 5} L ${HEAD_CX + 18} ${mouthY - 8} Q ${HEAD_CX} ${mouthY + 1} ${HEAD_CX - 18} ${mouthY - 8} Z`} fill="#fff" />
          </g>
        );
        break;
      case "open-smile":
        mouthEl = (
          <g>
            <ellipse cx={HEAD_CX} cy={mouthY + 4} rx={20} ry={15} fill="#5f2637" stroke={outline} strokeWidth={4.5} />
            <ellipse cx={HEAD_CX} cy={mouthY + 10} rx={11} ry={6} fill="#e4756d" />
            <rect x={HEAD_CX - 14} y={mouthY - 9} width={28} height={6} rx={3} fill="#fff" />
          </g>
        );
        break;
      case "frown":
        mouthEl = <path d={`M ${HEAD_CX - 20} ${mouthY + 8} Q ${HEAD_CX} ${mouthY - 6} ${HEAD_CX + 20} ${mouthY + 8}`} fill="none" stroke={outline} strokeWidth={5.5} strokeLinecap="round" />;
        break;
      case "o":
        mouthEl = <ellipse cx={HEAD_CX} cy={mouthY + 2} rx={11} ry={14} fill="#5f2637" stroke={outline} strokeWidth={4.5} />;
        break;
      case "wobble":
        mouthEl = <path d={`M ${HEAD_CX - 18} ${mouthY + 2} Q ${HEAD_CX - 9} ${mouthY - 5} ${HEAD_CX} ${mouthY + 2} Q ${HEAD_CX + 9} ${mouthY + 9} ${HEAD_CX + 18} ${mouthY + 2}`} fill="none" stroke={outline} strokeWidth={5} strokeLinecap="round" />;
        break;
      case "smirk":
        mouthEl = <path d={`M ${HEAD_CX - 18} ${mouthY + 4} Q ${HEAD_CX + 2} ${mouthY + 8} ${HEAD_CX + 20} ${mouthY - 6}`} fill="none" stroke={outline} strokeWidth={5.5} strokeLinecap="round" />;
        break;
      case "gritted":
        mouthEl = (
          <g>
            <path d={`M ${HEAD_CX - 22} ${mouthY} L ${HEAD_CX + 22} ${mouthY} L ${HEAD_CX + 18} ${mouthY + 12} L ${HEAD_CX - 18} ${mouthY + 12} Z`} fill="#5f2637" stroke={outline} strokeWidth={4.5} strokeLinejoin="round" />
            <path d={`M ${HEAD_CX - 18} ${mouthY + 1} L ${HEAD_CX + 18} ${mouthY + 1}`} stroke="#fff" strokeWidth={4.5} />
            <path d={`M ${HEAD_CX - 18} ${mouthY + 11} L ${HEAD_CX + 18} ${mouthY + 11}`} stroke="#fff" strokeWidth={4.5} />
          </g>
        );
        break;
      case "flat":
        mouthEl = <path d={`M ${HEAD_CX - 14} ${mouthY + 2} L ${HEAD_CX + 14} ${mouthY + 2}`} stroke={outline} strokeWidth={5} strokeLinecap="round" />;
        break;
      default: // smile
        mouthEl = <path d={`M ${HEAD_CX - 20} ${mouthY - 2} Q ${HEAD_CX} ${mouthY + 14} ${HEAD_CX + 20} ${mouthY - 2}`} fill="none" stroke={outline} strokeWidth={5.5} strokeLinecap="round" />;
    }
  }

  // nose
  const nose = <path d={`M ${HEAD_CX - 2} ${HEAD_CY + 20} Q ${HEAD_CX + 7} ${HEAD_CY + 30} ${HEAD_CX - 3} ${HEAD_CY + 33}`} fill="none" stroke={outline} strokeWidth={4.5} strokeLinecap="round" />;

  // cheeks
  const blushEl = (def.blush || dna.blush) && expression !== "angry" && (
    <g opacity={0.55}>
      <ellipse cx={HEAD_CX - E - 4} cy={HEAD_CY + 26} rx={13} ry={7} fill="#ef8a8a" />
      <ellipse cx={HEAD_CX + E + 4} cy={HEAD_CY + 26} rx={13} ry={7} fill="#ef8a8a" />
    </g>
  );

  // freckles
  const freckles = dna.freckles && (
    <g fill={darken(dna.skin, 0.35)} opacity={0.75}>
      {[-1, 1].map((s) =>
        [0, 1, 2].map((i) => (
          <circle key={`${s}-${i}`} cx={HEAD_CX + s * (E + 2) + i * 7 - 7} cy={HEAD_CY + 22 + (i % 2) * 6} r={1.8} />
        ))
      )}
    </g>
  );

  // sweat drop (scared/confused)
  const sweat = def.sweat && (
    <path
      d={`M ${HEAD_CX + HEAD_RX - 6} ${HEAD_CY - 34} q 8 12 0 18 q -9 -6 0 -18 Z`}
      fill="#7cc4ff" stroke={outline} strokeWidth={2.5}
      opacity={0.9}
    />
  );

  // glasses
  const glasses = dna.glasses && (
    <g stroke={outline} strokeWidth={4.5} fill="rgba(200,230,255,0.22)">
      <circle cx={HEAD_CX - E} cy={EY} r={30} />
      <circle cx={HEAD_CX + E} cy={EY} r={30} />
      <path d={`M ${HEAD_CX - E + 30} ${EY - 4} L ${HEAD_CX + E - 30} ${EY - 4}`} fill="none" />
      <path d={`M ${HEAD_CX - E - 30} ${EY - 6} L ${HEAD_CX - HEAD_RX + 4} ${EY - 16}`} fill="none" />
      <path d={`M ${HEAD_CX + E + 30} ${EY - 6} L ${HEAD_CX + HEAD_RX - 4} ${EY - 16}`} fill="none" />
    </g>
  );

  return (
    <g>
      {freckles}
      {blushEl}
      {renderEye(-1)}
      {renderEye(1)}
      <path d={def.browL} fill="none" stroke={dna.hairColor} strokeWidth={browStroke} strokeLinecap="round" />
      <path d={def.browR} fill="none" stroke={dna.hairColor} strokeWidth={browStroke} strokeLinecap="round" />
      {nose}
      {mouthEl}
      {sweat}
      {glasses}
    </g>
  );
}
