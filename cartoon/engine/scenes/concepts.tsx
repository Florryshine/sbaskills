// VisualConcept backgrounds — 12 animated worlds.
// Each fills the whole frame (W x H pixels) and is drawn in SVG with
// fraction-based coordinates so all three aspect ratios compose well.
import React from "react";
import type { VisualConcept } from "../types";
import { darken, lighten, seededRand } from "../palette";

export interface ConceptProps {
  W: number; H: number; t: number; seed: string; label?: string;
}

const Sky = ({ W, H, from, to }: { W: number; H: number; from: string; to: string }) => (
  <>
    <defs>
      <linearGradient id={`sky-${from.replace("#", "")}-${to.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
    <rect x={0} y={0} width={W} height={H} fill={`url(#sky-${from.replace("#", "")}-${to.replace("#", "")})`} />
  </>
);

function Clouds({ W, H, t, seed, n = 4, color = "#ffffff", opacity = 0.9 }: ConceptProps & { n?: number; color?: string; opacity?: number }) {
  const rnd = seededRand(seed);
  return (
    <g opacity={opacity}>
      {Array.from({ length: n }).map((_, i) => {
        const y = H * (0.08 + rnd() * 0.22);
        const base = rnd() * W;
        const speed = 12 + rnd() * 14;
        const s = 0.5 + rnd() * 0.9;
        const x = ((base + t * speed) % (W + 400)) - 200;
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse cx={0} cy={0} rx={90} ry={34} fill={color} />
            <ellipse cx={-46} cy={10} rx={54} ry={24} fill={color} />
            <ellipse cx={50} cy={8} rx={58} ry={26} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

// ================= CLASSROOM =================
function Classroom({ W, H, t, seed, label }: ConceptProps) {
  const floorY = H * 0.74;
  return (
    <g>
      <Sky W={W} H={H} from="#ffe9c7" to="#fff7ea" />
      <rect x={0} y={0} width={W} height={floorY} fill="#cfe3f7" />
      {/* wall panels */}
      <rect x={0} y={floorY} width={W} height={H - floorY} fill="#c8a06b" />
      <rect x={0} y={floorY} width={W} height={H * 0.02} fill="#a37f4d" />
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={(W / 6) * i + 8} y={floorY + H * 0.03} width={W / 6 - 16} height={H * 0.2} rx={6} fill="#b58e5c" opacity={0.5} />
      ))}
      {/* blackboard */}
      <g transform={`translate(${W * 0.5} ${H * 0.3})`}>
        <rect x={-W * 0.3} y={-H * 0.14} width={W * 0.6} height={H * 0.28} rx={12} fill="#2f5d50" stroke="#7a5a3b" strokeWidth={12} />
        <text x={-W * 0.26} y={-H * 0.05} fontSize={H * 0.05} fill="rgba(255,255,255,0.85)" fontFamily="Baloo2, sans-serif" fontWeight={700}>{(label || "").slice(0, 22)}</text>
        <path d={`M ${-W * 0.26} ${H * 0.02} L ${W * 0.1} ${H * 0.02}`} stroke="rgba(255,255,255,0.5)" strokeWidth={4} strokeLinecap="round" />
        <path d={`M ${-W * 0.26} ${H * 0.06} L ${-W * 0.05} ${H * 0.06}`} stroke="rgba(255,255,255,0.5)" strokeWidth={4} strokeLinecap="round" />
      </g>
      {/* windows */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${W * 0.5 + s * W * 0.42} ${H * 0.28})`}>
          <rect x={-W * 0.07} y={-H * 0.1} width={W * 0.14} height={H * 0.2} rx={8} fill="#9ed4ff" stroke="#ffffff" strokeWidth={8} />
          <path d={`M 0 ${-H * 0.1} L 0 ${H * 0.1} M ${-W * 0.07} 0 L ${W * 0.07} 0`} stroke="#ffffff" strokeWidth={6} />
          <circle cx={-W * 0.025} cy={-H * 0.055} r={W * 0.018} fill="#FFCC00" opacity={0.9} />
        </g>
      ))}
      {/* floating dust in light */}
      {Array.from({ length: 10 }).map((_, i) => {
        const rnd = seededRand(seed + i);
        const x = ((rnd() * W + t * 8) % W);
        const y = H * 0.2 + rnd() * H * 0.5 + Math.sin(t + i) * 8;
        return <circle key={i} cx={x} cy={y} r={2.4} fill="#ffffff" opacity={0.5} />;
      })}
    </g>
  );
}

// ================= PARK =================
function Park({ W, H, t, seed }: ConceptProps) {
  const horizon = H * 0.68;
  return (
    <g>
      <Sky W={W} H={H} from="#8ed0ff" to="#d8f1ff" />
      <Clouds W={W} H={H} t={t} seed={seed} n={4} />
      {/* sun + rays */}
      <g transform={`translate(${W * 0.82} ${H * 0.14})`}>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={-5} y={-H * 0.085} width={10} height={H * 0.032} rx={5} fill="#FFCC00" opacity={0.75} transform={`rotate(${i * 30 + t * 6})`} />
        ))}
        <circle cx={0} cy={0} r={H * 0.055} fill="#FFCC00" />
      </g>
      {/* hills */}
      <path d={`M 0 ${horizon} Q ${W * 0.25} ${horizon - H * 0.1} ${W * 0.5} ${horizon} T ${W} ${horizon} L ${W} ${H} L 0 ${H} Z`} fill="#8fd470" />
      <path d={`M 0 ${horizon + H * 0.06} Q ${W * 0.3} ${horizon - H * 0.04} ${W * 0.65} ${horizon + H * 0.05} T ${W} ${horizon + H * 0.04} L ${W} ${H} L 0 ${H} Z`} fill="#6fbe55" />
      {/* trees */}
      {[
        [0.12, 0.62, 1.15], [0.88, 0.64, 0.95], [0.68, 0.6, 0.7],
      ].map(([px, py, s], i) => (
        <g key={i} transform={`translate(${W * px} ${H * py}) scale(${s})`}>
          <g transform={`rotate(${Math.sin(t * 1.2 + i) * 2})`}>
            <rect x={-12} y={-10} width={24} height={70} rx={8} fill="#8a5a3b" stroke="#4a3220" strokeWidth={4} />
            <circle cx={-26} cy={-46} r={38} fill="#57b85c" stroke="#2e5b31" strokeWidth={4} />
            <circle cx={24} cy={-50} r={32} fill="#6fcf72" stroke="#2e5b31" strokeWidth={4} />
            <circle cx={0} cy={-74} r={40} fill="#57b85c" stroke="#2e5b31" strokeWidth={4} />
            <circle cx={-14} cy={-84} r={10} fill="#8fe08f" opacity={0.7} />
          </g>
        </g>
      ))}
      {/* flowers */}
      {Array.from({ length: 9 }).map((_, i) => {
        const rnd = seededRand(seed + "f" + i);
        const x = rnd() * W, y = horizon + H * (0.1 + rnd() * 0.22);
        const c = ["#e8483f", "#ff8c42", "#c25e8e", "#FFCC00"][i % 4];
        const sway = Math.sin(t * 2 + i) * 3;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${sway})`}>
            <line x1={0} y1={0} x2={0} y2={-16} stroke="#2e5b31" strokeWidth={3.5} />
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx={0} cy={-21} rx={5.5} ry={8} fill={c} transform={`rotate(${a} 0 -16)`} />
            ))}
            <circle cx={0} cy={-16} r={4.5} fill="#FFCC00" />
          </g>
        );
      })}
      {/* butterflies */}
      {Array.from({ length: 2 }).map((_, i) => {
        const rnd = seededRand(seed + "b" + i);
        const bx = W * (0.2 + rnd() * 0.6) + Math.sin(t * (0.9 + i * 0.3) + i * 3) * W * 0.08;
        const by = H * (0.35 + rnd() * 0.2) + Math.cos(t * 1.4 + i * 2) * H * 0.05;
        const flap = Math.sin(t * 18 + i * 4) * 0.7;
        return (
          <g key={i} transform={`translate(${bx} ${by})`}>
            <ellipse cx={-9} cy={0} rx={9} ry={13 * Math.abs(flap) + 3} fill={i ? "#c25e8e" : "#ff8c42"} transform="rotate(-25)" />
            <ellipse cx={9} cy={0} rx={9} ry={13 * Math.abs(flap) + 3} fill={i ? "#c25e8e" : "#ff8c42"} transform="rotate(25)" />
            <ellipse cx={0} cy={0} rx={2.5} ry={9} fill="#3a2a1e" />
          </g>
        );
      })}
    </g>
  );
}

// ================= CITY =================
function City({ W, H, t, seed }: ConceptProps) {
  const roadY = H * 0.8;
  return (
    <g>
      <Sky W={W} H={H} from="#2c3e6b" to="#7a9bd4" />
      <circle cx={W * 0.2} cy={H * 0.16} r={H * 0.045} fill="#f4f6f8" opacity={0.95} />
      {Array.from({ length: 24 }).map((_, i) => {
        const rnd = seededRand(seed + "s" + i);
        return <circle key={i} cx={rnd() * W} cy={rnd() * H * 0.4} r={2.2} fill="#fff" opacity={0.4 + rnd() * 0.5} />;
      })}
      {/* skyline back */}
      <g fill="#3d5382">
        {Array.from({ length: 8 }).map((_, i) => {
          const bw = W * 0.14;
          const bh = H * (0.18 + seededRand(seed + i)() * 0.16);
          return <rect key={i} x={i * bw - bw * 0.2} y={roadY - H * 0.05 - bh} width={bw * 0.8} height={bh} rx={6} />;
        })}
      </g>
      {/* skyline front with windows */}
      <g>
        {[[0.05, 0.34, "#54719f"], [0.24, 0.42, "#46618f"], [0.46, 0.3, "#5d7cab"], [0.68, 0.4, "#46618f"], [0.86, 0.36, "#54719f"]].map(([px, ph, c], i) => (
          <g key={i}>
            <rect x={W * (px as number)} y={roadY - H * (ph as number)} width={W * 0.13} height={H * (ph as number)} rx={8} fill={c as string} />
            {Array.from({ length: 12 }).map((_, j) => {
              const lit = seededRand(seed + i + "w" + j)() > 0.4;
              return (
                <rect key={j}
                  x={W * (px as number) + W * 0.02 + (j % 3) * W * 0.032}
                  y={roadY - H * (ph as number) + H * 0.03 + Math.floor(j / 3) * H * 0.06}
                  width={W * 0.02} height={H * 0.032} rx={2}
                  fill={lit ? "#ffd977" : "#2c3e6b"} opacity={lit ? 0.6 + Math.sin(t * 2 + j) * 0.25 : 0.5} />
              );
            })}
          </g>
        ))}
      </g>
      {/* road */}
      <rect x={0} y={roadY} width={W} height={H - roadY} fill="#4a4a55" />
      <rect x={0} y={roadY + (H - roadY) * 0.45} width={W} height={(H - roadY) * 0.1} fill="#f4f6f8" opacity={0.85} strokeDasharray={`${W * 0.06} ${W * 0.04}`} />
      <g strokeDashoffset={-t * 120} strokeDasharray={`${W * 0.06} ${W * 0.04}`}>
        <rect x={0} y={roadY + (H - roadY) * 0.45} width={W} height={(H - roadY) * 0.1} fill="#f4f6f8" opacity={0.85} />
      </g>
    </g>
  );
}

// ================= BLOODSTREAM =================
function Bloodstream({ W, H, t, seed }: ConceptProps) {
  const rnd = seededRand(seed);
  // vessel tunnel with flowing cells
  return (
    <g>
      <defs>
        <radialGradient id="vessel-grad" cx="0.5" cy="0.5" r="0.75">
          <stop offset="0" stopColor="#b3122e" />
          <stop offset="0.72" stopColor="#8c1029" />
          <stop offset="1" stopColor="#56091c" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#vessel-grad)" />
      {/* vessel wall ridges */}
      {Array.from({ length: 7 }).map((_, i) => {
        const phase = ((i / 7 + t * 0.12) % 1);
        const s = 0.4 + phase * 1.4;
        const y = H * (0.5 + Math.sin(i * 2.1 + seed.length) * 0.06);
        const op = Math.max(0, 1 - phase) * 0.7;
        return (
          <g key={i} opacity={op}>
            <ellipse cx={W * 0.5} cy={y - H * 0.42 * s} rx={W * 0.56 * s} ry={H * 0.07 * s} fill="#4a0a18" />
            <ellipse cx={W * 0.5} cy={y + H * 0.46 * s} rx={W * 0.56 * s} ry={H * 0.07 * s} fill="#4a0a18" />
          </g>
        );
      })}
      {/* plasma streaks */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = rnd() * H;
        const speed = 120 + rnd() * 220;
        const x = ((rnd() * W * 1.4 - t * speed) % (W * 1.4) + W * 1.4) % (W * 1.4) - W * 0.2;
        return <rect key={i} x={x} y={y} width={40 + rnd() * 60} height={5 + rnd() * 5} rx={4} fill="#ffd9dd" opacity={0.16 + rnd() * 0.2} />;
      })}
      {/* red blood cells flowing toward camera */}
      {Array.from({ length: 12 }).map((_, i) => {
        const phase = ((rnd() + i * 0.13 + t * 0.14) % 1);
        const s = 0.25 + phase * 1.5;
        const x = W * (0.15 + rnd() * 0.7) + Math.sin(i * 2.4 + t * 0.8) * W * 0.06;
        const y = H * (0.2 + rnd() * 0.6) + Math.cos(i * 1.7 + t * 0.6) * H * 0.05;
        const op = Math.max(0, Math.min(1, phase * 1.6)) * (1 - Math.max(0, phase - 0.75) * 4);
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${t * 30 + i * 40})`} opacity={op}>
            <ellipse cx={0} cy={0} rx={46} ry={34} fill="#e8483f" stroke="#8c1f2a" strokeWidth={6} />
            <ellipse cx={0} cy={0} rx={19} ry={13} fill="#c22f3a" />
            <ellipse cx={-13} cy={-10} rx={9} ry={6} fill="#ff8f96" opacity={0.85} />
          </g>
        );
      })}
      {/* white blood cell occasionally */}
      {(() => {
        const phase = (t * 0.07) % 1;
        const s = 0.3 + phase * 1.6;
        return (
          <g transform={`translate(${W * (0.25 + Math.sin(t * 0.4) * 0.1)} ${H * 0.68}) scale(${s})`} opacity={Math.max(0, 1 - phase) * 0.9}>
            <circle cx={0} cy={0} r={54} fill="#dfe7f5" stroke="#8fa3c4" strokeWidth={6} />
            <circle cx={-12} cy={-8} r={13} fill="#b9c7e2" />
            <circle cx={14} cy={10} r={10} fill="#b9c7e2" />
          </g>
        );
      })()}
    </g>
  );
}

// ================= LEAF WORLD =================
function LeafWorld({ W, H, t, seed }: ConceptProps) {
  const rnd = seededRand(seed);
  return (
    <g>
      <defs>
        <radialGradient id="leaf-grad" cx="0.5" cy="0.4" r="0.9">
          <stop offset="0" stopColor="#7ed957" />
          <stop offset="1" stopColor="#2e7d32" />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#leaf-grad)" />
      {/* giant palisade cells backdrop */}
      {Array.from({ length: 8 }).map((_, i) => {
        const cw = W / 4;
        const x = (i % 4) * cw;
        const y = Math.floor(i / 4) * H * 0.52;
        return (
          <rect key={i} x={x + 8} y={y + 8} width={cw - 16} height={H * 0.5} rx={26} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth={4} />
        );
      })}
      {/* sunbeams */}
      {Array.from({ length: 4 }).map((_, i) => {
        const a = -30 + i * 20;
        return (
          <rect key={i} x={W * (0.2 + i * 0.2)} y={-H * 0.2} width={W * 0.05} height={H * 1.4} fill="#fff9c4" opacity={0.13 + Math.sin(t * 1.2 + i) * 0.05} transform={`rotate(${a} ${W * (0.2 + i * 0.2)} 0)`} />
        );
      })}
      {/* chloroplasts drifting */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = (rnd() * W + t * (10 + rnd() * 16)) % (W + 120) - 60;
        const y = H * rnd() + Math.sin(t * 0.9 + i * 2.2) * H * 0.03;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${t * 20 + i * 40})`}>
            <ellipse cx={0} cy={0} rx={34} ry={22} fill="#3f9142" stroke="#2a5f2d" strokeWidth={4} />
            {Array.from({ length: 4 }).map((__, j) => (
              <circle key={j} cx={-14 + j * 9} cy={j % 2 ? -5 : 6} r={6} fill="#2a5f2d" opacity={0.75} />
            ))}
          </g>
        );
      })}
      {/* oxygen bubbles rising */}
      {Array.from({ length: 10 }).map((_, i) => {
        const speed = 40 + rnd() * 50;
        const y = H - ((t * speed + rnd() * H * 2) % (H * 1.2));
        const x = W * rnd();
        return (
          <g key={i} opacity={0.7}>
            <circle cx={x} cy={y} r={7 + rnd() * 9} fill="rgba(210,245,255,0.55)" stroke="#bfeaff" strokeWidth={2.5} />
            <circle cx={x - 3} cy={y - 3} r={2.5} fill="#fff" />
          </g>
        );
      })}
      {/* water droplets sliding */}
      {Array.from({ length: 3 }).map((_, i) => {
        const y = (t * 26 + i * H * 0.4) % (H * 1.1);
        return <path key={i} d={`M ${W * (0.14 + i * 0.32)} ${y} q 10 16 0 24 q -11 -8 0 -24 Z`} fill="#bfeaff" opacity={0.8} />;
      })}
    </g>
  );
}

// ================= CHEMISTRY LAB =================
function ChemistryLab({ W, H, t, seed }: ConceptProps) {
  const benchY = H * 0.72;
  return (
    <g>
      <Sky W={W} H={H} from="#e8f4ff" to="#f9fcff" />
      {/* wall tiles */}
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={(W / 10) * i + 4} y={4} width={W / 10 - 8} height={benchY - 8} rx={10} fill="#dff0fb" opacity={0.7} />
      ))}
      {/* shelf with flasks */}
      <rect x={W * 0.05} y={H * 0.18} width={W * 0.9} height={H * 0.03} rx={8} fill="#b58e5c" />
      {Array.from({ length: 6 }).map((_, i) => {
        const c = ["#e8483f", "#57b85c", "#3a86ff", "#c25e8e", "#ffb703", "#7a4dd8"][i];
        const x = W * (0.12 + i * 0.15);
        const bub = (t * 0.9 + i * 0.4) % 1;
        return (
          <g key={i} transform={`translate(${x} ${H * 0.14})`}>
            <path d="M -8 -8 L -8 10 L -20 34 Q -24 42 -16 42 L 16 42 Q 24 42 20 34 L 8 10 L 8 -8 Z" fill="rgba(220,240,255,0.9)" stroke="#33556b" strokeWidth={4} />
            <path d={`M -14 26 L 14 26 L 16 36 Q 16 40 10 40 L -10 40 Q -16 40 -16 36 Z`} fill={c} />
            {bub < 0.7 && <circle cx={-2 + i * 2} cy={22 - bub * 12} r={3 - bub * 2} fill={lighten(c, 0.4)} />}
          </g>
        );
      })}
      {/* periodic table poster */}
      <g transform={`translate(${W * 0.82} ${H * 0.4})`}>
        <rect x={-W * 0.1} y={-H * 0.1} width={W * 0.2} height={H * 0.18} rx={8} fill="#ffffff" stroke="#c9d6e2" strokeWidth={5} />
        {Array.from({ length: 12 }).map((_, i) => {
          const c = ["#e8483f", "#57b85c", "#3a86ff", "#ffb703"][i % 4];
          return <rect key={i} x={-W * 0.085 + (i % 4) * W * 0.045} y={-H * 0.08 + Math.floor(i / 4) * H * 0.045} width={W * 0.035} height={H * 0.035} rx={4} fill={c} opacity={0.8} />;
        })}
      </g>
      {/* bench */}
      <rect x={0} y={benchY} width={W} height={H - benchY} fill="#8a6a48" />
      <rect x={0} y={benchY} width={W} height={H * 0.025} fill="#6e5237" />
      {/* big bubbling flask on bench */}
      <g transform={`translate(${W * 0.16} ${benchY - H * 0.05})`}>
        <path d="M -26 -60 L -26 -10 L -58 40 Q -66 54 -50 54 L 50 54 Q 66 54 58 40 L 26 -10 L 26 -60 Z" fill="rgba(220,240,255,0.92)" stroke="#33556b" strokeWidth={6} strokeLinejoin="round" />
        <path d={`M -46 18 L 46 18 Q 52 44 44 50 L -44 50 Q -52 44 -46 18 Z`} fill="#7a4dd8" />
        {Array.from({ length: 5 }).map((_, i) => {
          const ph = (t * 0.7 + i * 0.21) % 1;
          return <circle key={i} cx={-18 + i * 9} cy={8 - ph * 40} r={5 - ph * 3.5} fill="#b393ec" opacity={1 - ph} />;
        })}
        <rect x={-34} y={-72} width={68} height={14} rx={7} fill="#33556b" />
      </g>
      {/* molecule model */}
      <g transform={`translate(${W * 0.6} ${benchY - H * 0.09}) rotate(${t * 18})`}>
        {[[0, -30], [26, 15], [-26, 15]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={15} fill={["#e8483f", "#57b85c", "#3a86ff"][i]} stroke="rgba(20,20,40,0.7)" strokeWidth={4} />
        ))}
        <path d="M 0 -30 L 26 15 M 0 -30 L -26 15 M 26 15 L -26 15" stroke="rgba(20,20,40,0.7)" strokeWidth={5} />
      </g>
      {/* spirit lamp */}
      <g transform={`translate(${W * 0.38} ${benchY - 6})`}>
        <path d="M -16 0 L 16 0 L 10 -22 L -10 -22 Z" fill="#33556b" />
        <path d={`M -7 -22 Q 0 ${-52 + Math.sin(t * 9) * 4} 7 -22`} fill="#ffb703" opacity={0.9} />
        <path d={`M -3.5 -22 Q 0 ${-40 + Math.sin(t * 9) * 3} 3.5 -22`} fill="#fff3c4" />
      </g>
    </g>
  );
}

// ================= SPACE =================
function Space({ W, H, t, seed }: ConceptProps) {
  const rnd = seededRand(seed);
  return (
    <g>
      <defs>
        <radialGradient id="nebula" cx="0.7" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3b2f8f" stopOpacity={0.55} />
          <stop offset="1" stopColor="#0b0b1e" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="#0b0b1e" />
      <rect x={0} y={0} width={W} height={H} fill="url(#nebula)" />
      {/* stars with twinkle */}
      {Array.from({ length: 60 }).map((_, i) => {
        const x = rnd() * W, y = rnd() * H;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.8 + rnd() * 2) + i));
        return <circle key={i} cx={x} cy={y} r={1.6 + rnd() * 2.4} fill="#fff" opacity={tw} />;
      })}
      {/* planet with ring */}
      <g transform={`translate(${W * 0.78} ${H * 0.24}) rotate(-14)`}>
        <ellipse cx={0} cy={0} rx={H * 0.16} ry={H * 0.05} fill="none" stroke="#c9a06e" strokeWidth={H * 0.018} opacity={0.9} />
        <circle cx={0} cy={0} r={H * 0.11} fill="#e8a15c" />
        <path d={`M ${-H * 0.1} ${-H * 0.03} Q 0 ${-H * 0.08} ${H * 0.1} ${-H * 0.02}`} stroke="#c97b3d" strokeWidth={H * 0.02} fill="none" opacity={0.8} />
        <path d={`M ${-H * 0.09} ${H * 0.04} Q 0 ${H * 0.08} ${H * 0.09} ${H * 0.03}`} stroke="#c97b3d" strokeWidth={H * 0.015} fill="none" opacity={0.7} />
        <ellipse cx={0} cy={0} rx={H * 0.16} ry={H * 0.05} fill="none" stroke="#e8c49a" strokeWidth={H * 0.014} strokeDasharray={`${H * 0.05} ${H * 0.03}`} opacity={0.9} transform="rotate(2)" />
      </g>
      {/* small moon */}
      <circle cx={W * 0.16} cy={H * 0.2} r={H * 0.035} fill="#cfd6e2" />
      <circle cx={W * 0.15} cy={H * 0.19} r={H * 0.008} fill="#9aa5b5" />
      <circle cx={W * 0.17} cy={H * 0.215} r={H * 0.006} fill="#9aa5b5" />
      {/* comet */}
      {(() => {
        const p = (t * 0.11) % 1.4;
        const x = W * (1.2 - p * 1.4), y = H * (0.1 + p * 0.3);
        return p < 1.2 ? (
          <g transform={`translate(${x} ${y}) rotate(28)`}>
            <rect x={-H * 0.16} y={-4} width={H * 0.16} height={8} rx={4} fill="url(#comet-tail)" opacity={0.8} />
            <circle cx={0} cy={0} r={7} fill="#fff" />
          </g>
        ) : null;
      })()}
      <defs>
        <linearGradient id="comet-tail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity={0.9} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
    </g>
  );
}

// ================= WATER CYCLE =================
function WaterCycle({ W, H, t, seed }: ConceptProps) {
  const seaY = H * 0.78;
  return (
    <g>
      <Sky W={W} H={H} from="#9ed4ff" to="#e8f7ff" />
      <Clouds W={W} H={H} t={t} seed={seed} n={3} opacity={0.9} />
      {/* growing rain cloud */}
      <g transform={`translate(${W * 0.5} ${H * 0.2})`}>
        <ellipse cx={-60} cy={10} rx={80} ry={40} fill="#5d7cab" />
        <ellipse cx={10} cy={-12} rx={100} ry={52} fill="#6d8cbb" />
        <ellipse cx={86} cy={12} rx={72} ry={36} fill="#5d7cab" />
        {Array.from({ length: 9 }).map((_, i) => {
          const ry = ((t * 180 + i * 60) % (H * 0.42));
          return (
            <line key={i} x1={-90 + i * 24} y1={40} x2={-100 + i * 26} y2={40 + Math.min(ry, 34)} stroke="#4d9de0" strokeWidth={5} strokeLinecap="round" opacity={Math.min(1, ry / 30)} />
          );
        })}
      </g>
      {/* mountain */}
      <path d={`M ${W * 0.06} ${seaY} L ${W * 0.3} ${H * 0.42} L ${W * 0.52} ${seaY} Z`} fill="#7a8ba0" />
      <path d={`M ${W * 0.3} ${H * 0.42} L ${W * 0.36} ${H * 0.5} L ${W * 0.24} ${H * 0.5} Z`} fill="#fff" />
      <path d={`M ${W * 0.44} ${seaY} L ${W * 0.62} ${H * 0.52} L ${W * 0.82} ${seaY} Z`} fill="#8a9bb0" />
      {/* evaporation particles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const p = ((t * 0.24 + i * 0.09) % 1);
        const y = seaY - p * (seaY - H * 0.3);
        const x = W * (0.56 + (i % 6) * 0.07) + Math.sin(t * 1.4 + i) * 14;
        return p < 0.9 ? (
          <g key={i} opacity={Math.sin(p * Math.PI) * 0.85}>
            <circle cx={x} cy={y} r={5 + (i % 3) * 2} fill="#dff2ff" stroke="#9ed4ff" strokeWidth={2} />
          </g>
        ) : null;
      })}
      {/* sea */}
      <rect x={0} y={seaY} width={W} height={H - seaY} fill="#3f8fd4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <path key={i} d={`M ${((i * W / 4 + t * 30) % (W + 200)) - 100} ${seaY + (H - seaY) * (0.2 + (i % 3) * 0.25)} q 40 -12 80 0`} stroke="#bfe6ff" strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.7} />
      ))}
      {/* sun */}
      <g transform={`translate(${W * 0.1} ${H * 0.12})`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={-4} y={-H * 0.075} width={8} height={H * 0.026} rx={4} fill="#FFCC00" transform={`rotate(${i * 36 + t * 8})`} />
        ))}
        <circle cx={0} cy={0} r={H * 0.05} fill="#FFCC00" />
      </g>
    </g>
  );
}

// ================= OCEAN =================
function Ocean({ W, H, t, seed }: ConceptProps) {
  const rnd = seededRand(seed);
  return (
    <g>
      <defs>
        <linearGradient id="sea-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7cc4e8" />
          <stop offset="1" stopColor="#1e5e94" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#sea-grad)" />
      {/* light rays */}
      {Array.from({ length: 5 }).map((_, i) => (
        <rect key={i} x={W * (0.1 + i * 0.2)} y={-H * 0.1} width={W * 0.06} height={H * 1.3} fill="#d9f3ff" opacity={0.12 + Math.sin(t * 0.9 + i * 1.4) * 0.05} transform={`rotate(${-14 + i * 7} ${W * (0.1 + i * 0.2)} 0)`} />
      ))}
      {/* fish */}
      {Array.from({ length: 4 }).map((_, i) => {
        const dir = i % 2 ? 1 : -1;
        const speed = (30 + rnd() * 40) * dir;
        const x = ((rnd() * W * 1.3 + t * speed) % (W * 1.3) + W * 1.3) % (W * 1.3) - W * 0.15;
        const y = H * (0.18 + rnd() * 0.5) + Math.sin(t * 1.6 + i * 2.4) * H * 0.03;
        const s = 0.7 + rnd() * 0.6;
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${dir * s} ${s})`}>
            <path d="M -30 0 Q -10 -18 16 0 Q -10 18 -30 0 Z" fill={["#ffb703", "#e8483f", "#c25e8e", "#57b85c"][i]} stroke="rgba(20,40,60,0.5)" strokeWidth={4} />
            <path d="M -30 0 L -46 -14 L -44 0 L -46 14 Z" fill={darken(["#ffb703", "#e8483f", "#c25e8e", "#57b85c"][i], 0.15)} stroke="rgba(20,40,60,0.5)" strokeWidth={3} />
            <circle cx={4} cy={-3} r={4} fill="#1a1a2e" />
          </g>
        );
      })}
      {/* bubbles */}
      {Array.from({ length: 12 }).map((_, i) => {
        const speed = 30 + rnd() * 46;
        const y = H - ((t * speed + rnd() * H * 2) % (H * 1.15));
        const x = W * rnd();
        const r = 5 + rnd() * 10;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill="rgba(220,245,255,0.3)" stroke="rgba(220,245,255,0.7)" strokeWidth={2.5} />
            <circle cx={x - r / 3} cy={y - r / 3} r={r / 3.6} fill="#fff" opacity={0.85} />
          </g>
        );
      })}
      {/* seaweed */}
      {[0.06, 0.12, 0.9, 0.96].map((px, i) => (
        <g key={i} transform={`translate(${W * px} ${H})`}>
          {Array.from({ length: 4 }).map((__, j) => {
            const sway = Math.sin(t * 1.3 + i + j) * 12;
            return <path key={j} d={`M ${j * 16 - 24} 0 q ${sway} ${-H * 0.14} ${sway * 1.4} ${-H * (0.2 + (j % 3) * 0.05)}`} stroke="#2e7d4f" strokeWidth={10 + (j % 2) * 5} fill="none" strokeLinecap="round" opacity={0.85} />;
          })}
        </g>
      ))}
      {/* sandy floor */}
      <path d={`M 0 ${H * 0.94} Q ${W * 0.25} ${H * 0.9} ${W * 0.5} ${H * 0.94} T ${W} ${H * 0.93} L ${W} ${H} L 0 ${H} Z`} fill="#e8d5a8" />
    </g>
  );
}

// ================= FARM =================
function Farm({ W, H, t, seed }: ConceptProps) {
  const horizon = H * 0.66;
  return (
    <g>
      <Sky W={W} H={H} from="#ffe1a8" to="#fff6e0" />
      <g transform={`translate(${W * 0.14} ${H * 0.14})`}>
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x={-4} y={-H * 0.07} width={8} height={H * 0.024} rx={4} fill="#FFCC00" transform={`rotate(${i * 36 + t * 7})`} />
        ))}
        <circle cx={0} cy={0} r={H * 0.048} fill="#FFCC00" />
      </g>
      <Clouds W={W} H={H} t={t} seed={seed} n={3} />
      {/* fields */}
      <rect x={0} y={horizon} width={W} height={H - horizon} fill="#8fd470" />
      {/* crop rows converging */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x0 = W * (0.5 + (i - 3) * 0.09);
        const x1 = W * (0.5 + (i - 3) * 0.4);
        return <path key={i} d={`M ${x0} ${horizon + H * 0.02} L ${x1} ${H} L ${x1 + W * 0.07} ${H} L ${x0 + W * 0.02} ${horizon + H * 0.02} Z`} fill={i % 2 ? "#7cc45e" : "#94dd7c"} opacity={0.85} />;
      })}
      {/* maize plants */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = W * (0.04 + (i % 4) * 0.3) + (i > 3 ? W * 0.13 : 0);
        const y = H * (i > 3 ? 0.9 : 0.78);
        const s = i > 3 ? 1.15 : 0.8;
        const sway = Math.sin(t * 1.7 + i) * 4;
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${s}) rotate(${sway})`}>
            <path d="M 0 0 L 0 -54" stroke="#3d7a2a" strokeWidth={6} strokeLinecap="round" />
            <path d="M 0 -20 Q -22 -30 -26 -52 M 0 -30 Q 22 -40 26 -60 M 0 -40 Q -18 -50 -20 -66" stroke="#3d7a2a" strokeWidth={4} fill="none" strokeLinecap="round" />
            <ellipse cx={6} cy={-58} rx={6} ry={12} fill="#FFCC00" stroke="#8a6d00" strokeWidth={2.5} transform="rotate(8)" />
          </g>
        );
      })}
      {/* barn */}
      <g transform={`translate(${W * 0.84} ${horizon})`}>
        <rect x={-W * 0.09} y={-H * 0.16} width={W * 0.18} height={H * 0.16} fill="#c2453a" stroke="#6e1f1a" strokeWidth={5} />
        <path d={`M ${-W * 0.11} ${-H * 0.16} L 0 ${-H * 0.24} L ${W * 0.11} ${-H * 0.16} Z`} fill="#8a2e26" stroke="#6e1f1a" strokeWidth={5} />
        <rect x={-W * 0.035} y={-H * 0.1} width={W * 0.07} height={H * 0.1} fill="#fff" stroke="#6e1f1a" strokeWidth={4} />
        <path d={`M ${-W * 0.035} ${-H * 0.1} L ${W * 0.035} ${0} M ${W * 0.035} ${-H * 0.1} L ${-W * 0.035} 0`} stroke="#6e1f1a" strokeWidth={4} />
      </g>
    </g>
  );
}

// ================= STAGE =================
function Stage({ W, H, t, seed }: ConceptProps) {
  const floorY = H * 0.76;
  return (
    <g>
      <Sky W={W} H={H} from="#3b1f4e" to="#6b3fa0" />
      {/* spotlights */}
      {[-1, 1].map((s) => (
        <g key={s} transform={`translate(${W * 0.5 + s * W * 0.22} ${-H * 0.02}) rotate(${s * 14})`}>
          <path d={`M -30 0 L 30 0 L ${s * W * 0.16 + 130} ${floorY} L ${s * W * 0.16 - 130} ${floorY} Z`} fill="#fff8d9" opacity={0.16 + Math.sin(t * 1.6 + s) * 0.05} />
        </g>
      ))}
      {/* curtains */}
      {[-1, 1].map((s) => (
        <g key={s}>
          <rect x={s < 0 ? 0 : W * 0.88} y={0} width={W * 0.12} height={H * 0.8} fill="#8e2437" />
          {Array.from({ length: 4 }).map((_, i) => (
            <path key={i} d={`M ${W * (s < 0 ? 0.0 : 0.88) + (W * 0.03) * i} 0 q 14 ${H * 0.2} 0 ${H * 0.4} q -14 ${H * 0.2} 0 ${H * 0.4}`} stroke="#6e1626" strokeWidth={W * 0.014} fill="none" />
          ))}
          <path d={`M ${s < 0 ? W * 0.12 : W * 0.88} 0 q ${-s * W * 0.05} ${H * 0.12} ${-s * W * 0.01} ${H * 0.3}`} stroke="#8e2437" strokeWidth={W * 0.05} fill="none" />
        </g>
      ))}
      <rect x={0} y={0} width={W} height={H * 0.045} fill="#6e1626" />
      {/* wooden floor */}
      <rect x={0} y={floorY} width={W} height={H - floorY} fill="#a8724a" />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={W * (i / 7)} y1={floorY} x2={W * (i / 7) + (i - 3.5) * W * 0.06} y2={H} stroke="#8a5a3b" strokeWidth={4} opacity={0.5} />
      ))}
      {/* confetti sparkle */}
      {Array.from({ length: 8 }).map((_, i) => {
        const rnd = seededRand(seed + "c" + i);
        const x = rnd() * W, y = (rnd() * H * 0.7 + t * 30 * (0.5 + rnd())) % (H * 0.75);
        return <rect key={i} x={x} y={y} width={7} height={10} rx={2} fill={["#FFCC00", "#e8483f", "#57b85c", "#4d9de0"][i % 4]} opacity={0.7} transform={`rotate(${t * 90 + i * 45} ${x} ${y})`} />;
      })}
    </g>
  );
}

// ================= ABSTRACT =================
function Abstract({ W, H, t, seed }: ConceptProps) {
  const rnd = seededRand(seed);
  const colors = ["#1a73e8", "#FFCC00", "#e8483f", "#57b85c", "#c25e8e", "#4d9de0", "#7a4dd8"];
  return (
    <g>
      <defs>
        <linearGradient id="abs-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fdf6ec" />
          <stop offset="1" stopColor="#e8f4ff" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#abs-grad)" />
      {/* soft floating blobs */}
      {Array.from({ length: 10 }).map((_, i) => {
        const bx = rnd() * W, by = rnd() * H;
        const r = H * (0.05 + rnd() * 0.1);
        const x = bx + Math.sin(t * (0.4 + rnd() * 0.5) + i * 2) * W * 0.03;
        const y = by + Math.cos(t * (0.3 + rnd() * 0.4) + i) * H * 0.02;
        const c = colors[i % colors.length];
        return <circle key={i} cx={x} cy={y} r={r} fill={c} opacity={0.16} />;
      })}
      {/* geometric shapes */}
      {Array.from({ length: 7 }).map((_, i) => {
        const x = rnd() * W, y = rnd() * H;
        const s = H * (0.02 + rnd() * 0.045);
        const rot = t * (10 + rnd() * 24) + i * 40;
        const c = colors[(i + 2) % colors.length];
        const shape = i % 3;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`} opacity={0.5}>
            {shape === 0 && <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={s * 0.3} fill={c} />}
            {shape === 1 && <path d={`M 0 ${-s * 1.2} L ${s} ${s * 0.8} L ${-s} ${s * 0.8} Z`} fill={c} />}
            {shape === 2 && (
              <g>
                <circle cx={-s * 0.5} cy={0} r={s * 0.7} fill={c} opacity={0.75} />
                <circle cx={s * 0.5} cy={0} r={s * 0.7} fill={c} opacity={0.55} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ================= registry =================
export const CONCEPT_COMPONENTS: Record<VisualConcept, React.FC<ConceptProps>> = {
  classroom: Classroom,
  park: Park,
  city: City,
  bloodstream: Bloodstream,
  "leaf-world": LeafWorld,
  "chemistry-lab": ChemistryLab,
  space: Space,
  "water-cycle": WaterCycle,
  ocean: Ocean,
  farm: Farm,
  stage: Stage,
  abstract: Abstract,
};

export function VisualConceptBackground({ concept, W, H, t, seed, label }: { concept: VisualConcept } & ConceptProps) {
  const C = CONCEPT_COMPONENTS[concept] || Abstract;
  return <C W={W} H={H} t={t} seed={seed} label={label} />;
}
