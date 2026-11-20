// Hairstyles — 9 styles, drawn in head-local coordinates.
// HairBack is drawn BEFORE the face ellipse, HairFront AFTER.
import React from "react";
import type { CharacterDNA } from "../types";
import { darken, lighten } from "../palette";
import { HEAD_CX, HEAD_CY, HEAD_RX, HEAD_RY } from "./face";

const cap = (c: string) => c;

export function HairBack({ dna }: { dna: CharacterDNA }) {
  const h = dna.hairStyle;
  const c = dna.hairColor;
  const dark = darken(c, 0.25);
  switch (h) {
    case "afro-puff":
      return (
        <g>
          <circle cx={HEAD_CX - HEAD_RX - 26} cy={HEAD_CY - 30} r={34} fill={c} />
          <circle cx={HEAD_CX - HEAD_RX - 26} cy={HEAD_CY - 30} r={34} fill="none" stroke={dark} strokeWidth={4} />
          <path d={`M ${HEAD_CX - HEAD_RX - 6} ${HEAD_CY - 30} Q ${HEAD_CX - HEAD_RX - 30} ${HEAD_CY + 30} ${HEAD_CX - HEAD_RX - 12} ${HEAD_CY + 66}`} fill="none" stroke={dark} strokeWidth={5} />
        </g>
      );
    case "ponytail":
      return (
        <g>
          <path d={`M ${HEAD_CX + HEAD_RX - 8} ${HEAD_CY - 34} Q ${HEAD_CX + HEAD_RX + 52} ${HEAD_CY - 20} ${HEAD_CX + HEAD_RX + 40} ${HEAD_CY + 70} Q ${HEAD_CX + HEAD_RX + 20} ${HEAD_CY + 90} ${HEAD_CX + HEAD_RX - 2} ${HEAD_CY + 40} Z`} fill={c} stroke={dark} strokeWidth={4} />
        </g>
      );
    case "braids":
      return (
        <g>
          {[-1, 1].map((s) => (
            <g key={s}>
              <path d={`M ${HEAD_CX + s * (HEAD_RX - 10)} ${HEAD_CY - 10} Q ${HEAD_CX + s * (HEAD_RX + 26)} ${HEAD_CY + 40} ${HEAD_CX + s * (HEAD_RX + 8)} ${HEAD_CY + 96}`} fill="none" stroke={c} strokeWidth={16} strokeLinecap="round" />
              <path d={`M ${HEAD_CX + s * (HEAD_RX - 10)} ${HEAD_CY - 10} Q ${HEAD_CX + s * (HEAD_RX + 26)} ${HEAD_CY + 40} ${HEAD_CX + s * (HEAD_RX + 8)} ${HEAD_CY + 96}`} fill="none" stroke={dark} strokeWidth={4} strokeDasharray="8 9" strokeLinecap="round" />
              <circle cx={HEAD_CX + s * (HEAD_RX + 8)} cy={HEAD_CY + 100} r={7} fill={dna.accentColor} stroke={dark} strokeWidth={3} />
            </g>
          ))}
        </g>
      );
    case "long":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 8} ${HEAD_CY - 10} Q ${HEAD_CX - HEAD_RX - 22} ${HEAD_CY + 90} ${HEAD_CX - HEAD_RX + 2} ${HEAD_CY + 128} L ${HEAD_CX + HEAD_RX - 2} ${HEAD_CY + 128} Q ${HEAD_CX + HEAD_RX + 22} ${HEAD_CY + 90} ${HEAD_CX + HEAD_RX + 8} ${HEAD_CY - 10} Z`} fill={c} stroke={dark} strokeWidth={4} />
        </g>
      );
    case "buns":
      return (
        <g>
          <circle cx={HEAD_CX - HEAD_RX - 8} cy={HEAD_CY - 52} r={22} fill={c} stroke={dark} strokeWidth={4} />
          <circle cx={HEAD_CX + HEAD_RX + 8} cy={HEAD_CY - 52} r={22} fill={c} stroke={dark} strokeWidth={4} />
        </g>
      );
    case "headwrap":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 14} ${HEAD_CY + 6} Q ${HEAD_CX - HEAD_RX + 6} ${HEAD_CY + 30} ${HEAD_CX - HEAD_RX + 10} ${HEAD_CY + 44} L ${HEAD_CX + HEAD_RX - 10} ${HEAD_CY + 44} Q ${HEAD_CX + HEAD_RX - 6} ${HEAD_CY + 30} ${HEAD_CX + HEAD_RX + 14} ${HEAD_CY + 6} Z`} fill={dna.wrapColor || "#c25e8e"} stroke={darken(dna.wrapColor || "#c25e8e", 0.3)} strokeWidth={4} />
          <circle cx={HEAD_CX + HEAD_RX - 6} cy={HEAD_CY + 34} r={13} fill={dna.wrapColor || "#c25e8e"} stroke={darken(dna.wrapColor || "#c25e8e", 0.3)} strokeWidth={4} />
        </g>
      );
    default:
      return null;
  }
}

export function HairFront({ dna }: { dna: CharacterDNA }) {
  const h = dna.hairStyle;
  const c = dna.hairColor;
  const dark = darken(c, 0.25);
  const lite = lighten(c, 0.16);
  const top = HEAD_CY - HEAD_RY;
  switch (h) {
    case "short-curls":
      return (
        <g>
          {/* full crown silhouette with curl bumps */}
          <path d={`M ${HEAD_CX - HEAD_RX - 6} ${HEAD_CY - 4}
            Q ${HEAD_CX - HEAD_RX - 2} ${top - 18} ${HEAD_CX - HEAD_RX + 22} ${top - 26}
            Q ${HEAD_CX - HEAD_RX * 0.4} ${top - 40} ${HEAD_CX + HEAD_RX * 0.4} ${top - 34}
            Q ${HEAD_CX + HEAD_RX - 20} ${top - 26} ${HEAD_CX + HEAD_RX + 4} ${HEAD_CY - 12}
            Q ${HEAD_CX + HEAD_RX - 4} ${HEAD_CY - 30} ${HEAD_CX + 26} ${HEAD_CY - 38}
            Q ${HEAD_CX - 20} ${HEAD_CY - 46} ${HEAD_CX - HEAD_RX + 26} ${HEAD_CY - 30}
            Q ${HEAD_CX - HEAD_RX - 2} ${HEAD_CY - 20} ${HEAD_CX - HEAD_RX - 6} ${HEAD_CY - 4} Z`}
            fill={c} stroke={dark} strokeWidth={4} />
          {/* curl bumps */}
          {[
            [HEAD_CX - 44, top + 2, 15], [HEAD_CX - 12, top - 14, 17], [HEAD_CX + 26, top - 8, 15],
            [HEAD_CX + 52, HEAD_CY - 22, 12], [HEAD_CX - 60, HEAD_CY - 16, 12],
          ].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill={c} stroke={dark} strokeWidth={3.4} />
          ))}
          <circle cx={HEAD_CX - 18} cy={top - 8} r={7} fill={lite} />
          <circle cx={HEAD_CX + 20} cy={top - 6} r={4.5} fill={lite} opacity={0.8} />
        </g>
      );
    case "afro-puff":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 2} ${HEAD_CY - 12} Q ${HEAD_CX - 10} ${top - 30} ${HEAD_CX + HEAD_RX + 2} ${HEAD_CY - 12} Q ${HEAD_CX + 40} ${HEAD_CY - 44} ${HEAD_CX - 30} ${HEAD_CY - 36} Q ${HEAD_CX - HEAD_RX + 8} ${HEAD_CY - 26} ${HEAD_CX - HEAD_RX - 2} ${HEAD_CY - 12} Z`} fill={c} stroke={dark} strokeWidth={4} />
          <circle cx={HEAD_CX - 26} cy={top - 2} r={6} fill={lite} />
        </g>
      );
    case "braids":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 2} ${HEAD_CY - 6} Q ${HEAD_CX - HEAD_RX + 6} ${top - 22} ${HEAD_CX} ${top - 16} Q ${HEAD_CX + HEAD_RX - 6} ${top - 22} ${HEAD_CX + HEAD_RX + 2} ${HEAD_CY - 6} L ${HEAD_CX + HEAD_RX - 18} ${HEAD_CY - 18} Q ${HEAD_CX + 30} ${HEAD_CY - 38} ${HEAD_CX - 20} ${HEAD_CY - 34} Q ${HEAD_CX - HEAD_RX + 14} ${HEAD_CY - 26} ${HEAD_CX - HEAD_RX + 14} ${HEAD_CY - 6} Z`} fill={c} stroke={dark} strokeWidth={4} />
          {[-34, -12, 10, 32].map((dx, i) => (
            <path key={i} d={`M ${HEAD_CX + dx} ${top - 12} Q ${HEAD_CX + dx + 4} ${HEAD_CY - 40} ${HEAD_CX + dx + 2} ${top - 14}`} fill="none" stroke={dark} strokeWidth={3} />
          ))}
          <circle cx={HEAD_CX - 20} cy={top - 4} r={5.5} fill={lite} />
        </g>
      );
    case "buzz":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX + 2} ${HEAD_CY - 18} Q ${HEAD_CX - HEAD_RX + 10} ${top - 8} ${HEAD_CX} ${top - 10} Q ${HEAD_CX + HEAD_RX - 10} ${top - 8} ${HEAD_CX + HEAD_RX - 2} ${HEAD_CY - 18} Q ${HEAD_CX + 20} ${HEAD_CY - 34} ${HEAD_CX - 24} ${HEAD_CY - 30} Z`} fill={c} opacity={0.92} />
        </g>
      );
    case "fade":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX} ${HEAD_CY - 12} Q ${HEAD_CX - HEAD_RX + 6} ${top - 16} ${HEAD_CX} ${top - 14} Q ${HEAD_CX + HEAD_RX - 6} ${top - 16} ${HEAD_CX + HEAD_RX} ${HEAD_CY - 12} Q ${HEAD_CX + 30} ${HEAD_CY - 40} ${HEAD_CX - 26} ${HEAD_CY - 36} Z`} fill={c} stroke={dark} strokeWidth={4} />
          <path d={`M ${HEAD_CX + 24} ${top - 8} q 14 6 16 24`} fill="none" stroke={dark} strokeWidth={5} strokeLinecap="round" />
          <circle cx={HEAD_CX - 18} cy={top - 2} r={5} fill={lite} />
        </g>
      );
    case "ponytail":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 2} ${HEAD_CY - 10} Q ${HEAD_CX - HEAD_RX + 4} ${top - 24} ${HEAD_CX} ${top - 18} Q ${HEAD_CX + HEAD_RX - 4} ${top - 24} ${HEAD_CX + HEAD_RX + 2} ${HEAD_CY - 10} Q ${HEAD_CX + 26} ${HEAD_CY - 42} ${HEAD_CX - 24} ${HEAD_CY - 36} Z`} fill={c} stroke={dark} strokeWidth={4} />
          <circle cx={HEAD_CX - 16} cy={top - 4} r={5.5} fill={lite} />
        </g>
      );
    case "buns":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 4} ${HEAD_CY - 8} Q ${HEAD_CX - HEAD_RX + 4} ${top - 22} ${HEAD_CX} ${top - 16} Q ${HEAD_CX + HEAD_RX - 4} ${top - 22} ${HEAD_CX + HEAD_RX + 4} ${HEAD_CY - 8} L ${HEAD_CX + HEAD_RX - 16} ${HEAD_CY - 16} Q ${HEAD_CX + 24} ${HEAD_CY - 40} ${HEAD_CX - 22} ${HEAD_CY - 34} Z`} fill={c} stroke={dark} strokeWidth={4} />
          <path d={`M ${HEAD_CX - HEAD_RX + 2} ${HEAD_CY - 4} q 10 18 6 34`} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" />
          <path d={`M ${HEAD_CX + HEAD_RX - 2} ${HEAD_CY - 4} q -10 18 -6 34`} fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" />
          <circle cx={HEAD_CX - 14} cy={top - 2} r={5} fill={lite} />
        </g>
      );
    case "long":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 4} ${HEAD_CY - 4} Q ${HEAD_CX - HEAD_RX + 2} ${top - 26} ${HEAD_CX} ${top - 20} Q ${HEAD_CX + HEAD_RX - 2} ${top - 26} ${HEAD_CX + HEAD_RX + 4} ${HEAD_CY - 4} Q ${HEAD_CX + 30} ${HEAD_CY - 44} ${HEAD_CX - 20} ${HEAD_CY - 38} Q ${HEAD_CX - HEAD_RX + 10} ${HEAD_CY - 28} ${HEAD_CX - HEAD_RX + 8} ${HEAD_CY - 2} Z`} fill={c} stroke={dark} strokeWidth={4} />
          <circle cx={HEAD_CX - 18} cy={top - 4} r={6} fill={lite} />
        </g>
      );
    case "headwrap":
      return (
        <g>
          <path d={`M ${HEAD_CX - HEAD_RX - 6} ${HEAD_CY - 14} Q ${HEAD_CX - 20} ${top - 34} ${HEAD_CX + 30} ${top - 26} Q ${HEAD_CX + HEAD_RX + 10} ${HEAD_CY - 22} ${HEAD_CX + HEAD_RX - 2} ${HEAD_CY - 8} Q ${HEAD_CX + 20} ${HEAD_CY - 30} ${HEAD_CX - 26} ${HEAD_CY - 24} Z`} fill={dna.wrapColor || "#c25e8e"} stroke={darken(dna.wrapColor || "#c25e8e", 0.3)} strokeWidth={4} />
          <path d={`M ${HEAD_CX - HEAD_RX + 2} ${HEAD_CY - 12} Q ${HEAD_CX} ${HEAD_CY - 34} ${HEAD_CX + HEAD_RX - 6} ${HEAD_CY - 12}`} fill="none" stroke={lighten(dna.wrapColor || "#c25e8e", 0.25)} strokeWidth={6} strokeLinecap="round" />
          <path d={`M ${HEAD_CX + 16} ${top - 24} q 26 -8 44 14`} fill="none" stroke={darken(dna.wrapColor || "#c25e8e", 0.15)} strokeWidth={9} strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}
