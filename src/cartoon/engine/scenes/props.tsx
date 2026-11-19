// Props library — animated educational props rendered as SVG.
// All props are drawn in a local space where the prop fits a 200x200 box
// centred at (0,0); scale from the scene spec applies outside.
import React from "react";
import type { PropKind } from "../types";
import { darken, lighten, seededRand } from "../palette";

export function Prop({ kind, t, seed = "p" }: { kind: PropKind; t: number; seed?: string }) {
  const rnd = seededRand(seed + kind);
  const sway = Math.sin(t * 1.6 + rnd() * 6) * 4;
  const pulse = 1 + Math.sin(t * 2.6 + rnd() * 6) * 0.05;
  switch (kind) {
    case "book":
      return (
        <g>
          <path d="M -70 -40 Q -30 -58 0 -40 Q 30 -58 70 -40 L 70 42 Q 30 26 0 42 Q -30 26 -70 42 Z" fill="#ff8c42" stroke="#3a2a1e" strokeWidth={6} strokeLinejoin="round" />
          <path d="M 0 -40 L 0 42" stroke="#3a2a1e" strokeWidth={5} />
          <path d="M -56 -26 Q -30 -40 -10 -28 M -56 -8 Q -30 -22 -10 -10 M 10 -28 Q 30 -40 56 -26 M 10 -10 Q 30 -22 56 -8" stroke="#fff" strokeWidth={4} fill="none" opacity={0.85} />
        </g>
      );
    case "apple":
      return (
        <g>
          <circle cx={0} cy={6} r={44} fill="#e8483f" stroke="#4a1410" strokeWidth={6} />
          <path d="M 0 -36 Q 2 -52 12 -58" stroke="#5b3a1e" strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M 4 -50 Q 26 -64 34 -46 Q 12 -40 4 -50 Z" fill="#57b85c" stroke="#2e5b31" strokeWidth={4} />
          <ellipse cx={-14} cy={-8} rx={10} ry={16} fill={lighten("#e8483f", 0.3)} opacity={0.8} />
        </g>
      );
    case "heart":
      return (
        <g transform={`scale(${1 + Math.sin(t * 6.2) * 0.06})`}>
          <path d="M 0 40 C -52 8 -52 -36 -20 -40 C -6 -42 0 -30 0 -24 C 0 -30 6 -42 20 -40 C 52 -36 52 8 0 40 Z" fill="#e8483f" stroke="#571017" strokeWidth={6} strokeLinejoin="round" />
          <path d="M -14 -26 Q -30 -14 -26 6 M 14 -26 Q 30 -14 26 6" stroke={lighten("#e8483f", 0.35)} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d="M -34 -18 Q -46 -12 -44 2 M 34 -18 Q 46 -12 44 2" stroke="#3355aa" strokeWidth={7} fill="none" strokeLinecap="round" />
        </g>
      );
    case "leaf":
      return (
        <g transform={`rotate(${Math.sin(t * 1.8) * 6})`}>
          <path d="M 0 50 Q -52 12 -34 -30 Q -16 -62 0 -66 Q 16 -62 34 -30 Q 52 12 0 50 Z" fill="#57b85c" stroke="#285c2e" strokeWidth={6} strokeLinejoin="round" />
          <path d="M 0 50 L 0 -60 M 0 -20 L -22 -32 M 0 -20 L 22 -32 M 0 4 L -26 -8 M 0 4 L 26 -8" stroke="#285c2e" strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    case "flask":
      return (
        <g>
          <path d="M -12 -56 L -12 -14 L -40 44 Q -46 56 -34 56 L 34 56 Q 46 56 40 44 L 12 -14 L 12 -56 Z" fill="rgba(210,235,255,0.85)" stroke="#33556b" strokeWidth={6} strokeLinejoin="round" />
          <path d={`M -30 22 L 30 22 Q 36 42 30 48 L -30 48 Q -36 42 -30 22 Z`} fill="#7a4dd8" opacity={0.9} />
          {Array.from({ length: 3 }).map((_, i) => {
            const ph = (t * 0.8 + i * 0.33) % 1;
            return <circle key={i} cx={-8 + i * 8} cy={18 - ph * 26} r={4 - ph * 2} fill="#b393ec" opacity={1 - ph} />;
          })}
          <rect x={-18} y={-64} width={36} height={10} rx={5} fill="#33556b" />
        </g>
      );
    case "molecule":
      return (
        <g transform={`rotate(${t * 24})`}>
          {[[0, -34], [30, 16], [-30, 16]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={17} fill={["#e8483f", "#57b85c", "#3a86ff"][i]} stroke="rgba(20,20,40,0.7)" strokeWidth={5} />
          ))}
          <path d="M 0 -34 L 30 16 M 0 -34 L -30 16 M 30 16 L -30 16" stroke="rgba(20,20,40,0.7)" strokeWidth={6} />
        </g>
      );
    case "star":
      return (
        <g transform={`rotate(${Math.sin(t * 2 + rnd() * 6) * 14})`}>
          <path d="M 0 -46 L 11 -14 L 45 -14 L 17 6 L 27 40 L 0 20 L -27 40 L -17 6 L -45 -14 L -11 -14 Z" fill="#FFCC00" stroke="#8a6d00" strokeWidth={5} strokeLinejoin="round" />
        </g>
      );
    case "sun":
      return (
        <g transform={`rotate(${t * 14})`}>
          {Array.from({ length: 12 }).map((_, i) => (
            <rect key={i} x={-4} y={-64} width={8} height={22} rx={4} fill="#ffb703" transform={`rotate(${i * 30})`} />
          ))}
          <circle cx={0} cy={0} r={40} fill="#FFCC00" stroke="#a87900" strokeWidth={5} />
          <circle cx={-12} cy={-6} r={4.5} fill="#7a5a00" />
          <circle cx={12} cy={-6} r={4.5} fill="#7a5a00" />
          <path d="M -12 10 Q 0 20 12 10" stroke="#7a5a00" strokeWidth={4} fill="none" strokeLinecap="round" />
        </g>
      );
    case "cloud":
      return (
        <g opacity={0.95}>
          <ellipse cx={-24} cy={8} rx={30} ry={20} fill="#ffffff" />
          <ellipse cx={8} cy={-8} rx={34} ry={26} fill="#ffffff" />
          <ellipse cx={34} cy={10} rx={28} ry={18} fill="#ffffff" />
        </g>
      );
    case "blood-cell":
      return (
        <g transform={`rotate(${t * 40})`}>
          <ellipse cx={0} cy={0} rx={34} ry={26} fill="#e8483f" stroke="#8c1f2a" strokeWidth={5} />
          <ellipse cx={0} cy={0} rx={14} ry={10} fill={darken("#e8483f", 0.18)} />
          <ellipse cx={-10} cy={-8} rx={6} ry={4} fill={lighten("#e8483f", 0.35)} />
        </g>
      );
    case "magnifier":
      return (
        <g transform={`rotate(${-30 + Math.sin(t * 2) * 4})`}>
          <circle cx={0} cy={-14} r={30} fill="rgba(190,225,255,0.5)" stroke="#33556b" strokeWidth={7} />
          <rect x={8} y={12} width={12} height={44} rx={6} fill="#8a5a3b" stroke="#3a2a1e" strokeWidth={4} transform="rotate(45 14 34)" />
        </g>
      );
    case "bulb":
      return (
        <g>
          <circle cx={0} cy={-10} r={34} fill="#FFCC00" stroke="#8a6d00" strokeWidth={5} opacity={0.85 + Math.sin(t * 5) * 0.15} />
          <path d="M -10 22 L -10 34 L 10 34 L 10 22" fill="#9aa5ad" stroke="#4a555e" strokeWidth={4} />
          <rect x={-12} y={34} width={24} height={8} rx={3} fill="#7a858d" stroke="#4a555e" strokeWidth={3} />
          <path d="M -8 -8 L 0 2 L 8 -8 M 0 2 L 0 14" stroke="#8a6d00" strokeWidth={4} fill="none" />
        </g>
      );
    case "trophy":
      return (
        <g>
          <path d="M -26 -44 L 26 -44 L 20 -6 Q 12 14 0 14 Q -12 14 -20 -6 Z" fill="#FFCC00" stroke="#8a6d00" strokeWidth={5} strokeLinejoin="round" />
          <path d="M -26 -38 Q -52 -34 -44 -10 Q -38 2 -22 -2" fill="none" stroke="#8a6d00" strokeWidth={6} />
          <path d="M 26 -38 Q 52 -34 44 -10 Q 38 2 22 -2" fill="none" stroke="#8a6d00" strokeWidth={6} />
          <rect x={-8} y={14} width={16} height={16} fill="#c98a2b" stroke="#6e4a12" strokeWidth={4} />
          <rect x={-26} y={30} width={52} height={14} rx={4} fill="#8a5a3b" stroke="#3a2a1e" strokeWidth={4} />
        </g>
      );
    case "blackboard":
      return (
        <g>
          <rect x={-90} y={-60} width={180} height={110} rx={10} fill="#2f5d50" stroke="#7a5a3b" strokeWidth={9} />
          <path d="M -60 -30 Q -20 -44 20 -28 M -60 0 L -10 -6 M -60 24 L 30 18" stroke="rgba(255,255,255,0.75)" strokeWidth={5} fill="none" strokeLinecap="round" />
        </g>
      );
    case "droplet":
      return (
        <g>
          <path d="M 0 -42 Q 26 -6 26 14 Q 26 40 0 40 Q -26 40 -26 14 Q -26 -6 0 -42 Z" fill="#4d9de0" stroke="#1e5e94" strokeWidth={5} strokeLinejoin="round" />
          <ellipse cx={-8} cy={6} rx={6} ry={10} fill={lighten("#4d9de0", 0.4)} />
        </g>
      );
    case "rocket":
      return (
        <g transform={`rotate(${Math.sin(t * 2) * 4 - 8})`}>
          <path d="M 0 -60 Q 22 -24 20 24 L -20 24 Q -22 -24 0 -60 Z" fill="#f4f6f8" stroke="#33556b" strokeWidth={5} strokeLinejoin="round" />
          <path d="M 20 24 L 34 44 L 14 36 Z M -20 24 L -34 44 L -14 36 Z" fill="#e8483f" stroke="#7a1a1a" strokeWidth={4} />
          <circle cx={0} cy={-12} r={9} fill="#4d9de0" stroke="#1e5e94" strokeWidth={4} />
          <path d={`M -8 28 Q 0 ${46 + Math.sin(t * 20) * 8} 8 28`} fill="#ffb703" stroke="#c96a00" strokeWidth={3} />
        </g>
      );
    case "backpack":
      return (
        <g>
          <rect x={-34} y={-36} width={68} height={76} rx={20} fill="#4d9de0" stroke="#1e5e94" strokeWidth={5} />
          <rect x={-20} y={-14} width={40} height={26} rx={8} fill="#FFCC00" stroke="#8a6d00" strokeWidth={4} />
          <path d="M -18 -36 Q -18 -54 0 -54 Q 18 -54 18 -36" fill="none" stroke="#1e5e94" strokeWidth={6} />
        </g>
      );
    case "ruler":
      return (
        <g transform={`rotate(-18)`}>
          <rect x={-70} y={-14} width={140} height={28} rx={5} fill="#ffb703" stroke="#8a5a00" strokeWidth={4} />
          {Array.from({ length: 7 }).map((_, i) => (
            <rect key={i} x={-60 + i * 20} y={-14} width={3} height={i % 2 ? 10 : 14} fill="#8a5a00" />
          ))}
        </g>
      );
    case "globe":
      return (
        <g transform={`rotate(${Math.sin(t * 0.9) * 8})`}>
          <circle cx={0} cy={0} r={40} fill="#4d9de0" stroke="#1e5e94" strokeWidth={5} />
          <path d="M -26 -18 Q -6 -30 14 -20 Q 30 -12 20 2 Q 2 10 -8 0 Q -26 6 -26 -18 Z" fill="#57b85c" />
          <path d="M 8 18 Q 20 14 26 24 Q 16 34 8 26 Z" fill="#57b85c" />
          <ellipse cx={0} cy={0} rx={40} ry={12} fill="none" stroke="#1e5e94" strokeWidth={3} opacity={0.6} />
          <path d="M -46 -22 L -46 22" stroke="#8a5a3b" strokeWidth={6} strokeLinecap="round" />
        </g>
      );
    case "chair":
      return (
        <g>
          <rect x={-44} y={-20} width={88} height={16} rx={6} fill="#8a5a3b" stroke="#3a2a1e" strokeWidth={5} />
          <rect x={-44} y={-110} width={14} height={96} rx={5} fill="#8a5a3b" stroke="#3a2a1e" strokeWidth={5} />
          <rect x={-36} y={-4} width={12} height={54} fill="#6e4527" stroke="#3a2a1e" strokeWidth={4} />
          <rect x={24} y={-4} width={12} height={54} fill="#6e4527" stroke="#3a2a1e" strokeWidth={4} />
        </g>
      );
    case "speech-plant":
      return (
        <g transform={`rotate(${sway})`}>
          <path d="M -6 60 L 6 60 L 4 -20 L -4 -20 Z" fill="#5b8a3c" stroke="#2e5b31" strokeWidth={4} />
          <path d="M 0 -20 Q -44 -30 -48 -66 Q -6 -62 0 -20 Z" fill="#57b85c" stroke="#2e5b31" strokeWidth={4} />
          <path d="M 0 -20 Q 44 -34 52 -72 Q 4 -64 0 -20 Z" fill="#6fcf72" stroke="#2e5b31" strokeWidth={4} />
        </g>
      );
    case "oxygen-bubble":
      return (
        <g opacity={0.9}>
          <circle cx={0} cy={0} r={26} fill="rgba(140,220,255,0.5)" stroke="#4d9de0" strokeWidth={4} />
          <circle cx={-8} cy={-8} r={5} fill="#fff" opacity={0.8} />
        </g>
      );
    case "co2-bubble":
      return (
        <g opacity={0.9}>
          <circle cx={0} cy={0} r={24} fill="rgba(160,160,180,0.5)" stroke="#5a5a72" strokeWidth={4} />
          <circle cx={-7} cy={-7} r={4} fill="#fff" opacity={0.7} />
        </g>
      );
    default:
      return null;
  }
}

export const PROP_RENDER_SIZE: Record<PropKind, number> = {
  book: 1.0, apple: 0.85, heart: 1.0, leaf: 1.0, flask: 1.0, molecule: 0.9,
  star: 0.8, sun: 1.2, cloud: 1.4, "blood-cell": 0.8, magnifier: 0.9, bulb: 0.9,
  trophy: 1.0, blackboard: 1.6, droplet: 0.8, rocket: 1.1, backpack: 0.9,
  ruler: 1.1, globe: 0.9, chair: 1.5, "speech-plant": 1.2, "oxygen-bubble": 0.7, "co2-bubble": 0.6,
};
