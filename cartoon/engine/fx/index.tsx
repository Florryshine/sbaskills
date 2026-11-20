// FX layer: speech/thought bubbles, transitions, confetti, captions, labels.
import React from "react";
import type { Transition, CameraMove, Orientation } from "../types";
import { interpolate, spring, useVideoConfig } from "remotion";
import { seededRand } from "../palette";

// ---------------- Speech bubble ----------------
export function SpeechBubble({ x, y, text, t, thought = false, maxWidth = 320, flip = false, scale = 1 }: {
  x: number; y: number; text: string; t: number; thought?: boolean; maxWidth?: number; flip?: boolean; scale?: number;
}) {
  const appear = interpolate(t, [0.05, 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > 26) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur.trim());
  const shown = Math.max(1, Math.round(lines.length * interpolate(t, [0.1, 0.55], [0.3, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  const w = Math.min(maxWidth, 150 + Math.max(...lines.map((l) => l.length)) * 11);
  const h = 46 + lines.length * 34;
  const dir = flip ? 1 : -1;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale * appear})`} opacity={Math.min(1, appear * 1.4)}>
      <rect x={-w / 2} y={-h} width={w} height={h} rx={26} fill="#ffffff" stroke="rgba(30,25,50,0.85)" strokeWidth={5} />
      {thought ? (
        <>
          <circle cx={dir * 8} cy={-h + 2} r={10} fill="#fff" stroke="rgba(30,25,50,0.85)" strokeWidth={4} />
          <circle cx={dir * 22} cy={-h + 26} r={6} fill="#fff" stroke="rgba(30,25,50,0.85)" strokeWidth={3.5} />
        </>
      ) : (
        <path d={`M ${-14} -6 L ${dir * 34} 22 L 14 -10 Z`} fill="#ffffff" stroke="rgba(30,25,50,0.85)" strokeWidth={5} strokeLinejoin="round" />
      )}
      {lines.slice(0, Math.max(1, shown)).map((line, i) => (
        <text key={i} x={0} y={-h + 40 + i * 34} textAnchor="middle" fontSize={25} fontFamily="Baloo2, Nunito, sans-serif" fontWeight={700} fill="#232135">{line}</text>
      ))}
    </g>
  );
}

// ---------------- Label chip (heading / on-screen text) ----------------
export function LabelChip({ x, y, text, t, color = "#1a73e8", fontSize = 44 }: {
  x: number; y: number; text: string; t: number; color?: string; fontSize?: number;
}) {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: Math.round(t * fps), fps, config: { damping: 14, stiffness: 160, mass: 0.7 } });
  const w = text.length * fontSize * 0.58 + fontSize * 1.6;
  return (
    <g transform={`translate(${x} ${y}) scale(${Math.max(0.001, pop)})`}>
      <rect x={-w / 2} y={-fontSize * 0.95} width={w} height={fontSize * 1.9} rx={fontSize} fill={color} opacity={0.94} />
      <text x={0} y={fontSize * 0.38} textAnchor="middle" fontSize={fontSize} fontFamily="Baloo2, Nunito, sans-serif" fontWeight={800} fill="#ffffff">{text}</text>
    </g>
  );
}

// ---------------- Confetti burst ----------------
export function Confetti({ t, seed = "conf", n = 40, originX = 0.5, originY = 0.3, W, H }: {
  t: number; seed?: string; n?: number; originX?: number; originY?: number; W: number; H: number;
}) {
  const rnd = seededRand(seed);
  const colors = ["#FFCC00", "#e8483f", "#57b85c", "#4d9de0", "#c25e8e", "#ff8c42"];
  const pieces: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const angle = rnd() * Math.PI * 2;
    const speed = 0.25 + rnd() * 0.75;
    const delay = rnd() * 0.25;
    const tt = Math.max(0, t - delay);
    const dist = tt * 700 * speed;
    const x = W * originX + Math.cos(angle) * dist;
    const y = H * originY + Math.sin(angle) * dist * 0.8 + tt * tt * 500; // gravity
    const rot = tt * 420 + i * 47;
    const c = colors[i % colors.length];
    const size = 9 + rnd() * 9;
    const op = Math.max(0, 1 - tt / 1.8);
    if (op <= 0) continue;
    pieces.push(
      <rect key={i} x={x} y={y} width={size} height={size * 0.62} rx={2.5}
        fill={c} opacity={op}
        transform={`rotate(${rot} ${x} ${y})`} />
    );
  }
  if (pieces.length === 0) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
      {pieces}
    </svg>
  );
}

// ---------------- Sparkles ----------------
export function Sparkles({ t, seed = "spk", n = 8, W, H }: { t: number; seed?: string; n?: number; W: number; H: number }) {
  const rnd = seededRand(seed);
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, y = rnd() * H * 0.8;
    const phase = (t * (0.6 + rnd() * 0.5) + rnd()) % 1.6;
    const s = Math.sin(Math.min(1, phase / 1.6) * Math.PI);
    const r = 12 * s;
    if (r <= 0.01) continue;
    stars.push(
      <g key={i} transform={`translate(${x} ${y})`} opacity={s}>
        <path d={`M 0 ${-r} L ${r * 0.28} ${-r * 0.28} L ${r} 0 L ${r * 0.28} ${r * 0.28} L 0 ${r} L ${-r * 0.28} ${r * 0.28} L ${-r} 0 L ${-r * 0.28} ${-r * 0.28} Z`} fill="#fff9c4" />
      </g>
    );
  }
  if (stars.length === 0) return null;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
      {stars}
    </svg>
  );
}

// ---------------- Transitions ----------------
export function TransitionOverlay({ kind, t, W, H, entering }: { kind: Transition; t: number; W: number; H: number; entering: boolean }) {
  const dur = 0.5;
  const p = interpolate(t, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (p >= 1 || kind === "none") return null;
  const inv = 1 - p;
  let inner: React.ReactNode = null;
  switch (kind) {
    case "fade":
      inner = <rect x={0} y={0} width={W} height={H} fill="#ffffff" opacity={entering ? inv : p} />;
      break;
    case "slide":
      inner = <rect x={entering ? W * (1 - p) : W * p - W} y={0} width={W} height={H} fill="#FFCC00" opacity={0.96} />;
      break;
    case "wipe": {
      const edge = 90;
      inner = entering ? (
        <rect x={W * (1 - p)} y={0} width={W * p + edge} height={H} fill="#1a73e8" opacity={0.95} />
      ) : (
        <rect x={-edge} y={0} width={W * (1 - p) + edge} height={H} fill="#1a73e8" opacity={0.95} />
      );
      break;
    }
    case "iris": {
      const maxR = Math.sqrt(W * W + H * H) / 2;
      const r = entering ? maxR * (1 - p) : maxR * p;
      inner = (
        <g>
          <mask id={`iris-${entering ? "in" : "out"}`}>
            <rect x={0} y={0} width={W} height={H} fill="#fff" />
            <circle cx={W / 2} cy={H / 2} r={r} fill="#000" />
          </mask>
          <rect x={0} y={0} width={W} height={H} fill="#0e0e22" mask={`url(#iris-${entering ? "in" : "out"})`} />
        </g>
      );
      break;
    }
    default:
      return null;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
      {inner}
    </svg>
  );
}

// ---------------- Camera ----------------
export function cameraTransform(move: CameraMove, t: number, duration: number): { scale: number; tx: number; ty: number } {
  const p = Math.min(1, Math.max(0, t / Math.max(0.001, duration)));
  switch (move) {
    case "zoom-in":
      return { scale: 1 + 0.1 * p, tx: 0, ty: -10 * p };
    case "zoom-out":
      return { scale: 1.12 - 0.12 * p, tx: 0, ty: 8 * p };
    case "pan-left":
      return { scale: 1.1, tx: 60 * (p - 0.5), ty: 0 };
    case "pan-right":
      return { scale: 1.1, tx: -60 * (p - 0.5), ty: 0 };
    default:
      return { scale: 1, tx: 0, ty: 0 };
  }
}

// ---------------- Subtitles (word-highlighted) ----------------
export function SubtitleBar({ W, H, text, progress, t, active }: {
  W: number; H: number; text: string; progress: number; t: number; active: boolean;
}) {
  if (!active || !text || progress <= 0) return null;
  const words = text.split(/\s+/);
  const shown = Math.max(1, Math.round(words.length * progress));
  const half = Math.ceil(words.length / 2);
  const l1 = words.slice(0, Math.min(shown, half)).join(" ");
  const l2 = shown > half ? words.slice(half, shown).join(" ") : "";
  const bob = Math.sin(t * 2) * 3;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
      <g transform={`translate(0 ${bob})`} opacity={0.96}>
        {l1 && (
          <text x={W / 2} y={H * 0.9} textAnchor="middle" fontSize={H * 0.028} fontFamily="Nunito, sans-serif" fontWeight={800}
            fill="#ffffff" stroke="rgba(20,16,40,0.85)" strokeWidth={H * 0.007} paintOrder="stroke">
            {l1}
          </text>
        )}
        {l2 && (
          <text x={W / 2} y={H * 0.9 + H * 0.04} textAnchor="middle" fontSize={H * 0.028} fontFamily="Nunito, sans-serif" fontWeight={800}
            fill="#ffffff" stroke="rgba(20,16,40,0.85)" strokeWidth={H * 0.007} paintOrder="stroke">
            {l2}
          </text>
        )}
      </g>
    </svg>
  );
}

// ---------------- Watermark / brand ----------------
export function BrandWatermark({ W, H, text = "Shiney Brain Academy" }: { W: number; H: number; text?: string }) {
  const fs = H * 0.018;
  const w = text.length * fs * 0.52 + fs * 2.4;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}>
      <g transform={`translate(${W - w / 2 - W * 0.024} ${H * 0.045})`} opacity={0.85}>
        <rect x={-w / 2} y={-fs * 0.9} width={w} height={fs * 1.8} rx={fs} fill="rgba(255,255,255,0.85)" />
        <circle cx={-w / 2 + fs * 1.05} cy={0} r={fs * 0.55} fill="#1a73e8" />
        <text x={fs * 0.6} y={fs * 0.36} textAnchor="middle" fontSize={fs * 0.95} fontFamily="Baloo2, sans-serif" fontWeight={800} fill="#1a73e8">{text}</text>
      </g>
    </svg>
  );
}

// aspect helper (used by composition)
export function ratioOf(orientation: Orientation): number {
  if (orientation === "9:16") return 9 / 16;
  if (orientation === "1:1") return 1;
  return 16 / 9;
}
