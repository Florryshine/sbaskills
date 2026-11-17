// src/remotion/elements/Pen.tsx — the marker hand that follows the drawing tip.
//
// The tip position is computed from the same build-time geometry the renderers
// animate, so the nib sits exactly on the drawing frontier. It now follows:
//   • illustration / arrow / highlight strokes and auto-captions
//   • the colour-wash marker sweep of traced images
//   • handwritten text (headings, body, bullets, callouts, ticks)
//   • equation terms
//
// The hand is a REAL PHOTOGRAPHIC sprite (high-res photo of a hand gripping a
// whiteboard marker, transparent background) carried inside the timeline as a
// data URI. Fallbacks: staticFile copy of the same PNG, then the inline
// cartoon vector — the pen can never silently disappear again.

import React, { useState, useEffect } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, staticFile } from 'remotion';
import type { ElementTimeline, HandSprite as HandSpriteData, LaidOutText } from '../../types';
import { pointOnStroke } from '../../geometry/path-sample';

interface PenProps {
  elements: ElementTimeline[];
  accent: string;
  /** Scene-level texts (heading / sub) so the hand follows them too. */
  texts?: Array<LaidOutText | undefined>;
  /** Ink colour used for sprite outlines. */
  ink?: string;
}

type Tip = { x: number; y: number };

function textTip(t: LaidOutText, sceneSec: number): Tip | null {
  for (const r of t.wordRects) {
    const d = r.writeDuration || 0.3;
    if (sceneSec >= r.writeStart - 0.02 && sceneSec <= r.writeStart + d) {
      const p = Math.max(0, Math.min(1, (sceneSec - r.writeStart) / d));
      // nib rides the baseline, slightly above it so the ink looks "just written"
      return { x: r.x + r.w * p, y: r.y + t.fontSize * 0.82 };
    }
  }
  return null;
}

/** Board-coordinate tip of whatever is being drawn / written at sceneSec, or null. */
export function activeTipAt(
  elements: ElementTimeline[],
  sceneSec: number,
  texts: Array<LaidOutText | undefined> = [],
): Tip | null {
  let latest: Tip | null = null;

  for (const t of texts) {
    if (!t) continue;
    const tip = textTip(t, sceneSec);
    if (tip) latest = tip;
  }

  for (const el of elements) {
    if (el.text) {
      const tip = textTip(el.text, sceneSec);
      if (tip) latest = tip;
    }

    if (el.caption) {
      const tip = textTip(el.caption, sceneSec);
      if (tip) latest = tip;
    }

    if (el.equation) {
      for (const term of el.equation.terms) {
        if (term.kind === 'arrow') continue;
        const du = term.duration || 0.4;
        if (sceneSec >= term.start && sceneSec <= term.start + du) {
          const p = (sceneSec - term.start) / du;
          latest = { x: term.x + term.w * p, y: el.equation.y + el.equation.fontSize * 0.8 };
        }
      }
    }

    const ill = el.illustration;
    if (!ill) continue;
    for (const s of ill.sampled.strokes) {
      const st = s.start ?? 0;
      const du = s.duration ?? 0.3;
      const t = sceneSec - el.start - st;
      if (t >= -0.02 && t <= du) {
        const p = Math.max(0, Math.min(1, t / du));
        const pt = pointOnStroke(s, p * s.length);
        latest = { x: ill.x + pt.x * ill.scale, y: ill.y + pt.y * ill.scale };
      }
    }
    // marker sweep that paints a traced image's colour in
    const cl = ill.sampled.colorLayer;
    if (cl) {
      const t = sceneSec - el.start - cl.start;
      if (t >= 0 && t <= cl.duration) {
        const p = Math.max(0, Math.min(1, t / cl.duration));
        const pt = pointOnStroke(
          { points: cl.zigzag.points, length: cl.zigzag.length } as never,
          p * cl.zigzag.length,
        );
        latest = { x: ill.x + pt.x * ill.scale, y: ill.y + pt.y * ill.scale };
      }
    }
  }
  return latest;
}

const PEN_ANGLE = 42;
const HAND_SCALE = 0.62;

/** Board height (px) of the photographic hand sprite on the 1080p board. */
const PHOTO_HAND_HEIGHT = 680;
/** Nib pixel inside public/whiteboard/marker-hand.png (measured, matches meta). */
const PHOTO_HAND_FILE = { tipX: 4, tipY: 240, width: 721, height: 760 };

/**
 * Photographic hand: an <image> sprite anchored so the marker nib lands exactly
 * on the computed drawing tip. Works with a data URI (embedded in the timeline
 * by the renderer) or a staticFile copy — whichever the caller provides.
 */
export const PhotoHandSprite: React.FC<{ src: string; tipX: number; tipY: number; width: number; height: number; wobble: number }> = ({
  src,
  tipX,
  tipY,
  width,
  height,
  wobble,
}) => {
  const s = PHOTO_HAND_HEIGHT / height;
  return (
    <g transform={`rotate(${wobble})`}>
      <image
        href={src}
        x={-tipX * s}
        y={-tipY * s}
        width={width * s}
        height={height * s}
        preserveAspectRatio="xMidYMid meet"
      />
    </g>
  );
};

/**
 * Hand-and-marker artwork INLINED as SVG geometry (no runtime asset fetch).
 * A `<image href>` sprite fails SILENTLY when the asset 404s in a worker or
 * preview context — which is exactly how the hand disappeared from exported
 * MP4s. Inline paths render everywhere, deterministically.
 *
 * Geometry: artwork viewBox "-20 0 720 406"; the marker nib tip sits at
 * (-15, 202) in artwork coordinates and lands at local (0,0) via the nested
 * svg placement (x=0, y=-141, 480x279), preserving active-tip tracking.
 * The marker band is tinted with the theme accent.
 */
export const HandSprite: React.FC<{ accent: string; ink: string; angle?: number }> = ({ accent, angle = PEN_ANGLE }) => (
  <g transform={`rotate(${angle})`}>
    <svg x={0} y={-141} width={480} height={279} viewBox="-20 0 720 406" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wbh-skin" x1="0" y1="0" x2=".7" y2="1">
          <stop stopColor="#8b4b2f" />
          <stop offset=".25" stopColor="#b96f4b" />
          <stop offset=".58" stopColor="#985536" />
          <stop offset="1" stopColor="#63351f" />
        </linearGradient>
        <linearGradient id="wbh-skinHi" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d18a65" />
          <stop offset="1" stopColor="#8b4a30" />
        </linearGradient>
        <linearGradient id="wbh-sleeve" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#274c83" />
          <stop offset=".55" stopColor="#102c59" />
          <stop offset="1" stopColor="#081b3b" />
        </linearGradient>
        <linearGradient id="wbh-marker" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#fff" />
          <stop offset=".45" stopColor="#f1f3f5" />
          <stop offset="1" stopColor="#b9c1ca" />
        </linearGradient>
        <filter id="wbh-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {/* soft grounding shadow */}
      <path d="M22 286 Q180 350 410 345 T690 375 L690 405 L20 405Z" fill="#111" opacity={0.14} filter="url(#wbh-shadow)" />
      {/* forearm and cuff */}
      <path d="M480 277 Q550 258 604 284 L700 315 L700 406 L489 406 Q458 365 455 324Z" fill="url(#wbh-sleeve)" />
      <path d="M481 278 Q540 255 604 283 L624 295 Q557 281 492 315 L470 344 Q458 308 481 278Z" fill="#355d96" opacity={0.75} />
      <path d="M476 300 Q528 278 594 301" fill="none" stroke="#6c8bb8" strokeWidth={4} opacity={0.45} />
      <path d="M490 318 Q548 298 613 325" fill="none" stroke="#071a39" strokeWidth={3} opacity={0.6} />
      {/* hand silhouette, wrist through palm */}
      <path
        d="M470 300 Q423 282 385 268 Q348 255 324 230 L281 187 Q256 159 244 128 Q235 105 251 91 Q268 78 285 95 L342 144 Q326 119 320 91 Q315 64 337 56 Q359 49 375 76 L414 131 Q403 99 407 75 Q411 52 433 51 Q455 50 466 76 L497 137 Q497 106 514 99 Q535 91 550 113 Q566 137 560 173 Q555 210 583 255 L607 291 Q553 330 470 300Z"
        fill="url(#wbh-skin)"
        stroke="#5d321f"
        strokeWidth={3}
      />
      {/* upper index finger resting over marker */}
      <path d="M251 111 Q237 87 253 69 Q268 53 289 69 Q315 91 338 131 L369 174 Q376 188 362 199 Q347 210 333 196 L286 151Z" fill="url(#wbh-skinHi)" stroke="#6a3926" strokeWidth={2} />
      <path d="M257 83 Q274 70 289 88 L321 127" fill="none" stroke="#e2a080" strokeWidth={5} opacity={0.55} strokeLinecap="round" />
      {/* thumb wrapping over marker */}
      <path d="M331 192 Q347 165 377 164 Q407 164 430 181 Q447 194 439 214 Q431 232 408 230 L360 222 Q335 219 331 192Z" fill="url(#wbh-skinHi)" stroke="#6a3926" strokeWidth={3} />
      <path d="M360 181 Q385 173 410 190" fill="none" stroke="#e7a17d" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
      {/* curled lower fingers */}
      <path d="M326 223 Q305 211 292 226 Q280 242 299 260 L344 298 Q361 311 376 295 Q389 280 373 264Z" fill="#8d4a2e" stroke="#63351f" strokeWidth={3} />
      <path d="M356 247 Q339 236 325 250 Q312 265 329 280 L366 309 Q385 320 399 301 Q409 285 392 269Z" fill="#a75e3c" stroke="#63351f" strokeWidth={3} />
      <path d="M386 263 Q370 252 357 267 Q345 282 361 298 L394 326 Q414 337 428 317 Q437 300 420 285Z" fill="#8e4c31" stroke="#63351f" strokeWidth={3} />
      {/* marker body across the grip, tip at x=-15 y=202 */}
      <path d="M12 177 L330 177 Q345 177 345 192 L345 219 Q345 234 330 234 L12 234 Q2 234 2 222 L2 189 Q2 177 12 177Z" fill="url(#wbh-marker)" stroke="#66717d" strokeWidth={3} />
      <path d="M22 185 L318 185" stroke="#fff" strokeWidth={5} opacity={0.9} />
      <path d="M22 226 L326 226" stroke="#87929e" strokeWidth={3} opacity={0.5} />
      {/* marker colour band — theme accent */}
      <rect x={286} y={177} width={20} height={57} rx={5} fill={accent} />
      <rect x={306} y={177} width={12} height={57} fill="#e9f0f8" />
      <path d="M2 189 L-4 194 L-4 217 L2 222Z" fill="#242a31" />
      <path d="M-4 194 L-15 202 L-4 217Z" fill="#15191f" />
      {/* nail and crease details */}
      <path d="M270 82 Q281 69 294 83 Q304 94 300 106 Q288 113 277 102Z" fill="#d99a7c" stroke="#7c4630" strokeWidth={2} />
      <path d="M278 84 Q289 78 296 89" fill="none" stroke="#f1c0a5" strokeWidth={3} strokeLinecap="round" />
      <path d="M434 72 Q448 67 457 81" fill="none" stroke="#e2a080" strokeWidth={4} strokeLinecap="round" />
      <path d="M460 112 Q472 126 476 145 M489 152 Q499 168 495 183 M523 163 Q530 184 522 203" fill="none" stroke="#63351f" strokeWidth={3} opacity={0.55} strokeLinecap="round" />
      <path d="M470 294 Q521 307 566 285" fill="none" stroke="#d18a65" strokeWidth={5} opacity={0.5} strokeLinecap="round" />
    </svg>
  </g>
);

export const Pen: React.FC<PenProps & { hand?: HandSpriteData | null }> = ({ elements, accent, texts = [], ink = '#26343C', hand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneSec = frame / fps;

  // Probe the staticFile copy once so a missing asset can be detected and the
  // inline cartoon used instead — the silent-404 failure mode is eliminated.
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => {
    if (hand?.dataUri || photoFailed) return;
    const probe = new Image();
    probe.onerror = () => setPhotoFailed(true);
    probe.src = staticFile('whiteboard/marker-hand.png');
  }, [hand?.dataUri, photoFailed]);

  const photoSrc = hand?.dataUri ?? (photoFailed ? null : staticFile('whiteboard/marker-hand.png'));
  const photoMeta = hand ?? PHOTO_HAND_FILE;

  const tip = activeTipAt(elements, sceneSec, texts);

  // Keep the last known position briefly after drawing ends so the hand eases
  // off instead of vanishing on the first idle frame.
  let visibleTip = tip;
  let lastTipAge = 0;
  if (!visibleTip) {
    for (let back = 1; back <= 15; back++) {
      const previous = activeTipAt(elements, sceneSec - back / fps, texts);
      if (previous) {
        visibleTip = previous;
        lastTipAge = back / fps;
        break;
      }
    }
  }

  if (!visibleTip) return null;
  const fadeOut = interpolate(lastTipAge, [0, 0.5], [1, 0], { extrapolateRight: 'clamp' });

  // Detect the beginning of the current continuous writing/drawing action.
  // This gives the hand a short natural entrance instead of popping in.
  let activeAge = 0;
  if (tip) {
    for (let back = 1; back <= 12; back++) {
      if (!activeTipAt(elements, sceneSec - back / fps, texts)) break;
      activeAge = back / fps;
    }
  }
  const fadeIn = tip
    ? interpolate(activeAge, [0, 0.18], [0.35, 1], { extrapolateRight: 'clamp' })
    : 1;
  const opacity = Math.max(0, fadeOut * fadeIn);
  if (opacity <= 0.02) return null;

  // Small deterministic wrist movement while drawing, with a gentle lift
  // between strokes. Keep the marker nib anchored to the computed tip.
  const wobble = tip ? Math.sin(sceneSec * 8.5) * (photoSrc ? 0.9 : 1.15) : 0;
  const drop = (1 - fadeOut) * 26; // lift away as the writing action ends

  return (
    <svg
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      viewBox="0 0 1920 1080"
    >
      <defs>
        <filter id="handShadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="4" dy="7" stdDeviation="6" floodColor="#1a1a1a" floodOpacity="0.18" />
        </filter>
      </defs>
      <g
        opacity={opacity}
        filter="url(#handShadow)"
        transform={`translate(${visibleTip.x + drop} ${visibleTip.y + drop})`}
      >
        {photoSrc ? (
          <PhotoHandSprite
            src={photoSrc}
            tipX={photoMeta.tipX}
            tipY={photoMeta.tipY}
            width={photoMeta.width}
            height={photoMeta.height}
            wobble={wobble}
          />
        ) : (
          <g transform={`scale(${HAND_SCALE})`}>
            <HandSprite accent={accent} ink={ink} angle={PEN_ANGLE + wobble} />
          </g>
        )}
      </g>
    </svg>
  );
};
