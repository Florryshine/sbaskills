/**
 * SBA Kinetic Typography Engine.
 *
 * Canvas-2D renderer driven entirely by the shared Timeline: every word,
 * letter, pulse and background transition is a function of absolute song
 * time, so the visuals and the audio can never drift apart — and exported
 * video frames are deterministic (offline re-render possible).
 *
 * Original SBA visual identity: bold word performance, vivid color cycling,
 * beat-reactive backgrounds. Inspired by the energy of sung lyric videos
 * (e.g. the Airtel *444# advert style) but an independent design.
 */
import type { BackgroundId, LineTiming, Timeline, TypographyId, WordTiming } from './types';

export interface TypographyStyle {
  typography: TypographyId;
  background: BackgroundId;
}

const SBA_COLORS = [
  '#FFD60A', '#FF9F1C', '#FF5D8F', '#A78BFA',
  '#2EC4B6', '#A7F432', '#FF7A00', '#F72585', '#7CFFB2',
];

const SECTION_BG_HUES: Record<string, string[]> = {
  intro: ['#2A1A5E', '#3D2A8C'],
  verse: ['#31135E', '#4A1E7E'],
  prechorus: ['#5E1A47', '#8C2A5E'],
  chorus: ['#7E2A0E', '#B34A00'],
  bridge: ['#0E4A44', '#0F6660'],
  hook: ['#61105E', '#8C1E8C'],
  outro: ['#1E1E3A', '#2E2E5E'],
};

const BG_FALLBACK = ['#31135E', '#4A1E7E'];

function clamp01(v: number): number { return Math.max(0, Math.min(1, v)); }
function easeOutBack(p: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
function easeOutCubic(p: number): number { return 1 - Math.pow(1 - p, 3); }
function hashSeed(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function displayFont(size: number, weight = 900): string {
  return `${weight} ${size}px 'Arial Black','Avenir Next Heavy',Impact,'DejaVu Sans',sans-serif`;
}

export function drawFrame(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  tSec: number,
  timeline: Timeline,
  style: TypographyStyle,
) {
  const beatPos = tSec / timeline.secPerBeat;
  const beatPhase = beatPos - Math.floor(beatPos);
  const section = timeline.sections.find((s) => tSec >= s.startSec && tSec < s.endSec)
    ?? timeline.sections[timeline.sections.length - 1];

  drawBackground(c, W, H, tSec, beatPhase, section?.name ?? 'verse', style.background);

  const allLines: LineTiming[] = timeline.sections.flatMap((s) => s.lines);
  const firstSing = allLines[0];
  const lastSing = allLines[allLines.length - 1];
  const inIntro = !firstSing || tSec < firstSing.startSec - 0.05;
  const inOutro = lastSing && tSec > lastSing.endSec + 1.0;

  if (inIntro) {
    drawTitleCard(c, W, H, timeline, beatPhase, tSec);
    drawHud(c, W, H, timeline, section?.name ?? 'intro', beatPos);
    return;
  }
  if (inOutro) {
    drawEndCard(c, W, H, timeline, beatPhase, tSec - (lastSing.endSec + 1.0));
    drawHud(c, W, H, timeline, 'outro', beatPos);
    return;
  }

  // current line: last line that has started
  let current: LineTiming | null = null;
  let next: LineTiming | null = null;
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].startSec - 0.12 <= tSec) {
      current = allLines[i];
      next = allLines[i + 1] ?? null;
    }
  }
  if (!current) { drawHud(c, W, H, timeline, section?.name ?? 'verse', beatPos); return; }

  const lineAge = tSec - current.startSec;
  const lineRemaining = current.endSec - tSec;
  const fadeOut = clamp01(lineRemaining / 0.35);
  const fadeIn = clamp01(lineAge / 0.25);

  // karaoke layout: measure words
  const active = current.words.find((w) => tSec >= w.startSec && tSec < w.endSec) ?? null;
  const wordSize = Math.round(H * 0.088);
  c.font = displayFont(wordSize);
  const gap = wordSize * 0.34;
  const maxW = W * 0.86;
  // wrap words into rows
  const rows: WordTiming[][] = [];
  let row: WordTiming[] = [];
  let rowW = 0;
  for (const w of current.words) {
    const ww = c.measureText(w.text).width + gap;
    if (rowW + ww > maxW && row.length) { rows.push(row); row = []; rowW = 0; }
    row.push(w); rowW += ww;
  }
  if (row.length) rows.push(row);
  const lineHeight = wordSize * 1.28;
  const blockH = rows.length * lineHeight;
  const centerY = H * 0.46;
  let y = centerY - blockH / 2 + lineHeight / 2;

  rows.forEach((words, ri) => {
    const totalW = words.reduce((a, w) => a + c.measureText(w.text).width + gap, 0) - gap;
    let x = (W - totalW) / 2;
    for (const w of words) {
      const wWidth = c.measureText(w.text).width;
      const isActive = active?.text === w.text && tSec >= w.startSec && tSec < w.endSec;
      const sung = tSec >= w.endSec;
      const idx = current!.words.indexOf(w) + ri * 3;
      const color = isActive ? SBA_COLORS[(Math.floor(beatPos) + idx) % SBA_COLORS.length]
        : sung ? '#F4F1FF' : 'rgba(255,255,255,0.55)';
      drawWord(c, w, x, y, wWidth, wordSize, tSec, beatPhase, style.typography, color, idx, isActive, sung, fadeIn * fadeOut);
      x += wWidth + gap;
    }
    y += lineHeight;
  });

  // fact ribbon
  if (current.fact) {
    drawFactRibbon(c, W, H, current.fact, beatPhase, fadeIn);
  } else if (next && next.startSec - tSec < 0.6) {
    drawBeatDots(c, W, H * 0.72, beatPos);
  }

  drawHud(c, W, H, timeline, section?.name ?? 'verse', beatPos);
}

/* ------------------------------------------------------------------ */
/* Word effects                                                         */
/* ------------------------------------------------------------------ */

function drawWord(
  c: CanvasRenderingContext2D,
  w: WordTiming,
  x: number,
  y: number,
  wWidth: number,
  size: number,
  tSec: number,
  beatPhase: number,
  preset: TypographyId,
  color: string,
  idx: number,
  isActive: boolean,
  sung: boolean,
  masterAlpha: number,
) {
  const p = clamp01((tSec - w.startSec) / Math.max(0.05, w.endSec - w.startSec));
  c.save();
  c.globalAlpha = masterAlpha;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  const baseX = x;
  const baseY = y;

  const bounce = Math.max(0, 1 - beatPhase) ** 1.6;
  const beatPulse = 1 + 0.1 * bounce;

  switch (preset) {
    case 'bounce': {
      const inP = easeOutBack(clamp01(p * 2.2));
      const scale = (isActive ? beatPulse : sung ? 0.94 : 0.8) * (0.6 + 0.4 * inP);
      const hop = isActive ? Math.sin(clamp01(p) * Math.PI) * size * 0.22 : 0;
      c.translate(baseX + wWidth / 2, baseY - hop);
      c.scale(scale, scale);
      strokeFill(c, w.text, 0, 0, size, color);
      break;
    }
    case 'letters': {
      const chars = Array.from(w.text);
      const perLetter = 1 / Math.max(1, chars.length);
      c.translate(baseX + wWidth / 2, baseY);
      let cx = -(wWidth / 2);
      chars.forEach((ch, ci) => {
        const lp = clamp01((p - ci * perLetter) / Math.max(perLetter, 0.001));
        const s = lp > 0 ? easeOutBack(clamp01(lp * 1.8)) : 0;
        const cw = c.measureText(ch).width;
        if (s > 0.01) {
          c.save();
          c.translate(cx + cw / 2, 0);
          c.scale(s, s);
          c.rotate((1 - s) * (ci % 2 === 0 ? 0.35 : -0.35));
          const lc = isActive ? SBA_COLORS[(idx + ci) % SBA_COLORS.length] : color;
          strokeFill(c, ch, 0, 0, size, lc);
          c.restore();
        }
        cx += cw;
      });
      break;
    }
    case 'wave': {
      const phase = Math.sin(tSec * 7 + idx * 1.1);
      c.translate(baseX + wWidth / 2, baseY + phase * size * 0.14);
      c.rotate(phase * 0.05);
      const scale = isActive ? 1.06 * beatPulse : 0.95;
      c.scale(scale, scale);
      strokeFill(c, w.text, 0, 0, size, color);
      break;
    }
    case 'stretch': {
      const sq = isActive ? Math.sin(clamp01(p) * Math.PI) : 0;
      const sx = 1 + 0.3 * sq + (isActive ? 0.06 * bounce : 0);
      const sy = 1 - 0.14 * sq;
      c.translate(baseX + wWidth / 2, baseY);
      c.scale(sx, sy);
      strokeFill(c, w.text, 0, 0, size, color);
      break;
    }
    case 'neon': {
      c.translate(baseX + wWidth / 2, baseY);
      const scale = isActive ? 1.05 : 0.92;
      c.scale(scale, scale);
      c.shadowColor = isActive ? color : 'transparent';
      c.shadowBlur = isActive ? 22 + 14 * bounce : 0;
      strokeFill(c, w.text, 0, 0, size, color, { fillDark: true });
      break;
    }
    case 'burst': {
      const arrive = easeOutCubic(clamp01(p * 1.6));
      c.translate(baseX + wWidth / 2, baseY);
      const chars = Array.from(w.text);
      let cx = -(wWidth / 2);
      chars.forEach((ch, ci) => {
        const seed = hashSeed(idx * 13 + ci);
        const dx = (seed - 0.5) * size * 2.2 * (1 - arrive);
        const dy = (hashSeed(idx * 7 + ci * 3) - 0.5) * size * 1.8 * (1 - arrive);
        const rot = (seed - 0.5) * 1.2 * (1 - arrive);
        const cw = c.measureText(ch).width;
        c.save();
        c.translate(cx + cw / 2 + dx, dy);
        c.rotate(rot);
        const s = (isActive ? beatPulse : sung ? 0.94 : 0.85) * (0.4 + 0.6 * arrive);
        c.scale(s, s);
        const lc = isActive ? SBA_COLORS[(idx * 2 + ci) % SBA_COLORS.length] : color;
        strokeFill(c, ch, 0, 0, size, lc);
        c.restore();
        cx += cw;
      });
      break;
    }
  }
  c.restore();
}

function strokeFill(
  c: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  opts?: { fillDark?: boolean },
) {
  c.font = displayFont(size);
  c.lineJoin = 'round';
  c.miterLimit = 2;
  c.strokeStyle = 'rgba(20,8,40,0.9)';
  c.lineWidth = size * 0.16;
  c.strokeText(text, x, y);
  if (opts?.fillDark) {
    c.fillStyle = '#1b0f33';
    c.fillText(text, x, y);
    c.strokeStyle = color;
    c.lineWidth = size * 0.05;
    c.strokeText(text, x, y);
  } else {
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
}

/* ------------------------------------------------------------------ */
/* Ribbons, dots, HUD                                                   */
/* ------------------------------------------------------------------ */

function drawFactRibbon(c: CanvasRenderingContext2D, W: number, H: number, fact: string, beatPhase: number, alpha: number) {
  const size = Math.round(H * 0.034);
  c.font = `700 ${size}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  const text = fact.length > 68 ? fact.slice(0, 65) + '…' : fact;
  const tw = c.measureText(text).width;
  const padX = size * 1.1;
  const bw = tw + padX * 2 + size * 1.4;
  const bh = size * 2.1;
  const bx = (W - bw) / 2;
  const by = H - bh - H * 0.075;
  const pulse = 1 + 0.05 * Math.max(0, 1 - beatPhase);
  c.save();
  c.globalAlpha = alpha;
  c.translate(W / 2, by + bh / 2);
  c.scale(pulse, pulse);
  c.translate(-W / 2, -(by + bh / 2));
  roundRect(c, bx, by, bw, bh, bh / 2);
  c.fillStyle = 'rgba(255,214,10,0.94)';
  c.fill();
  c.fillStyle = '#2A1A5E';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(text, W / 2 + size * 0.55, by + bh / 2);
  // star bullet
  c.beginPath();
  const sx = bx + padX * 0.75, sy = by + bh / 2, R = size * 0.52;
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? R : R * 0.45;
    c.lineTo(sx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr);
  }
  c.closePath();
  c.fillStyle = '#FF5D8F';
  c.fill();
  c.restore();
}

function drawBeatDots(c: CanvasRenderingContext2D, W: number, y: number, beatPos: number) {
  const n = 4;
  const size = Math.min(W, 420) * 0.012;
  const gap = size * 3.2;
  const startX = W / 2 - (gap * (n - 1)) / 2;
  for (let i = 0; i < n; i++) {
    const phase = (beatPos * 4 - i) % n;
    const a = Math.max(0, 1 - Math.abs(phase) / 1.4);
    c.save();
    c.globalAlpha = 0.25 + 0.6 * a;
    c.beginPath();
    c.arc(startX + i * gap, y, size * (1 + a * 0.8), 0, Math.PI * 2);
    c.fillStyle = '#FFD60A';
    c.fill();
    c.restore();
  }
}

function drawHud(c: CanvasRenderingContext2D, W: number, H: number, timeline: Timeline, sectionName: string, beatPos: number) {
  // section chip
  const size = Math.round(H * 0.028);
  c.font = `800 ${size}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  const label = sectionName.toUpperCase();
  const tw = c.measureText(label).width;
  const padX = size * 0.9;
  const bh = size * 2;
  c.save();
  roundRect(c, W * 0.05, H * 0.045, tw + padX * 2, bh, bh / 2);
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.3)';
  c.lineWidth = 1.5;
  c.stroke();
  c.fillStyle = '#FFD60A';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(label, W * 0.05 + tw / 2 + padX, H * 0.045 + bh / 2);
  c.restore();

  // progress bar with section markers
  const t = beatPos * timeline.secPerBeat / timeline.durationSec;
  const barY = H - H * 0.018;
  const barH = Math.max(3, H * 0.006);
  c.fillStyle = 'rgba(255,255,255,0.22)';
  c.fillRect(W * 0.05, barY, W * 0.9, barH);
  const grad = c.createLinearGradient(W * 0.05, 0, W * 0.95, 0);
  grad.addColorStop(0, '#FF9F1C');
  grad.addColorStop(0.5, '#FF5D8F');
  grad.addColorStop(1, '#A7F432');
  c.fillStyle = grad;
  c.fillRect(W * 0.05, barY, W * 0.9 * clamp01(t), barH);
  for (const s of timeline.sections) {
    const px = W * 0.05 + W * 0.9 * clamp01(s.startSec / timeline.durationSec);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fillRect(px - 1, barY - barH, 2, barH * 3);
  }
}

function drawTitleCard(c: CanvasRenderingContext2D, W: number, H: number, timeline: Timeline, beatPhase: number, tSec: number) {
  const bounce = Math.max(0, 1 - beatPhase) ** 1.5;
  const pulse = 1 + 0.05 * bounce;
  const grow = clamp01(tSec / 0.6);

  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  // brand chip
  const chipSize = Math.round(H * 0.032);
  c.font = `800 ${chipSize}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  const brand = 'SHINEY BRAIN ACADEMY';
  const bw = c.measureText(brand).width + chipSize * 2.4;
  roundRect(c, (W - bw) / 2, H * 0.2, bw, chipSize * 2.2, chipSize * 1.1);
  c.fillStyle = 'rgba(255,214,10,0.95)';
  c.fill();
  c.fillStyle = '#2A1A5E';
  c.fillText(brand, W / 2, H * 0.2 + chipSize * 1.1);

  // title with letter pop
  const titleSize = Math.round(H * 0.085);
  const chars = Array.from(timeline.spec.title);
  c.font = displayFont(titleSize);
  const totalW = chars.reduce((a, ch) => a + c.measureText(ch).width + titleSize * 0.06, 0);
  let x = W / 2 - totalW / 2;
  chars.forEach((ch, i) => {
    const lp = clamp01(grow * 2 - i * 0.06);
    const s = lp > 0 ? easeOutBack(lp) : 0;
    const cw = c.measureText(ch).width;
    if (s > 0.01) {
      c.save();
      c.translate(x + cw / 2, H * 0.42);
      c.scale(s * pulse, s * pulse);
      strokeFill(c, ch, 0, 0, titleSize, SBA_COLORS[i % SBA_COLORS.length]);
      c.restore();
    }
    x += cw + titleSize * 0.06;
  });

  // topic line
  const topicSize = Math.round(H * 0.042);
  c.font = `700 ${topicSize}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.globalAlpha = clamp01((tSec - 0.5) / 0.5);
  c.fillText(timeline.spec.topic.toUpperCase(), W / 2, H * 0.55);

  // "learning song" tag
  c.globalAlpha = clamp01((tSec - 0.9) / 0.5);
  const tagSize = Math.round(H * 0.028);
  c.font = `800 ${tagSize}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  roundRect(c, W / 2 - tagSize * 5.4, H * 0.63, tagSize * 10.8, tagSize * 2.4, tagSize * 1.2);
  c.fillStyle = 'rgba(255,93,143,0.9)';
  c.fill();
  c.fillStyle = '#FFFFFF';
  c.fillText('A LEARNING SONG', W / 2, H * 0.63 + tagSize * 1.25);
  c.restore();
}

function drawEndCard(c: CanvasRenderingContext2D, W: number, H: number, timeline: Timeline, beatPhase: number, since: number) {
  const pulse = 1 + 0.04 * Math.max(0, 1 - beatPhase);
  c.save();
  c.textAlign = 'center';
  c.textBaseline = 'middle';

  // orbiting starburst
  const cx = W / 2, cy = H * 0.4;
  const R = Math.min(W, H) * 0.16 * pulse;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + since * 0.8;
    c.beginPath();
    c.arc(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R, Math.min(W, H) * 0.012, 0, Math.PI * 2);
    c.fillStyle = SBA_COLORS[i % SBA_COLORS.length];
    c.globalAlpha = 0.7;
    c.fill();
  }
  c.globalAlpha = 1;
  const titleSize = Math.round(H * 0.055);
  c.font = displayFont(titleSize);
  c.fillText('SHINEY BRAIN', W / 2, cy);
  c.font = displayFont(Math.round(titleSize * 0.8));
  c.fillText('ACADEMY', W / 2, cy + titleSize * 1.2);

  const sub = Math.round(H * 0.032);
  c.font = `700 ${sub}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  c.fillStyle = 'rgba(255,255,255,0.88)';
  c.globalAlpha = clamp01((since - 0.4) / 0.5);
  c.fillText(timeline.spec.title, W / 2, H * 0.62);
  c.globalAlpha = clamp01((since - 0.9) / 0.5);
  const tag = 'Made with the SBA Musical Learning Studio';
  c.font = `600 ${Math.round(H * 0.024)}px 'Trebuchet MS','DejaVu Sans',sans-serif`;
  c.fillStyle = 'rgba(255,214,10,0.9)';
  c.fillText(tag, W / 2, H * 0.69);
  c.restore();
}

/* ------------------------------------------------------------------ */
/* Backgrounds                                                          */
/* ------------------------------------------------------------------ */

function drawBackground(
  c: CanvasRenderingContext2D,
  W: number,
  H: number,
  tSec: number,
  beatPhase: number,
  sectionName: string,
  bg: BackgroundId,
) {
  const [c1, c2] = SECTION_BG_HUES[sectionName] ?? BG_FALLBACK;
  const grad = c.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, c2);
  grad.addColorStop(1, c1);
  c.fillStyle = grad;
  c.fillRect(0, 0, W, H);

  const pulse = Math.max(0, 1 - beatPhase);

  switch (bg) {
    case 'rays': {
      const cx = W / 2, cy = H * 0.42;
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(255,255,255,0.14)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate(cx, cy);
      c.rotate(tSec * 0.25);
      const R = Math.max(W, H);
      for (let i = 0; i < 14; i++) {
        const a0 = (i / 14) * Math.PI * 2;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, R, a0, a0 + Math.PI / 14);
        c.closePath();
        c.fillStyle = `rgba(255,255,255,${0.03 + 0.03 * pulse})`;
        c.fill();
      }
      c.restore();
      break;
    }
    case 'blobs': {
      for (let i = 0; i < 7; i++) {
        const sx = hashSeed(i * 17);
        const sy = hashSeed(i * 29 + 3);
        const speed = 0.2 + hashSeed(i * 7) * 0.35;
        const x = (sx + Math.sin(tSec * speed + i) * 0.12) * W;
        const y = (sy + Math.cos(tSec * speed * 1.3 + i * 2) * 0.14) * H;
        const r = Math.min(W, H) * (0.14 + sx * 0.12) * (1 + pulse * 0.12);
        const bg2 = c.createRadialGradient(x, y, 0, x, y, r);
        bg2.addColorStop(0, hexA(SBA_COLORS[i % SBA_COLORS.length], 0.4));
        bg2.addColorStop(1, hexA(SBA_COLORS[i % SBA_COLORS.length], 0));
        c.fillStyle = bg2;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      break;
    }
    case 'grid': {
      const rows = 12;
      const speed = (tSec * 0.6) % 1;
      c.strokeStyle = `rgba(255,255,255,${0.10 + 0.06 * pulse})`;
      c.lineWidth = 1.4;
      for (let i = 0; i <= rows; i++) {
        const p = (i + speed) / rows;
        const y = H * 0.35 + Math.pow(p, 2.2) * H * 0.7;
        c.globalAlpha = p;
        c.beginPath();
        c.moveTo(0, y); c.lineTo(W, y);
        c.stroke();
      }
      c.globalAlpha = 0.14;
      for (let i = -8; i <= 8; i++) {
        c.beginPath();
        c.moveTo(W / 2 + i * W * 0.06, H * 0.35);
        c.lineTo(W / 2 + i * W * 0.3, H);
        c.stroke();
      }
      c.globalAlpha = 1;
      break;
    }
    case 'confetti': {
      for (let i = 0; i < 40; i++) {
        const sx = hashSeed(i * 3 + 1);
        const speed = 0.25 + hashSeed(i * 11) * 0.5;
        const x = sx * W + Math.sin(tSec * speed * 2 + i) * W * 0.04;
        const y = ((hashSeed(i * 5) + tSec * speed * 0.12) % 1) * H;
        const s = Math.min(W, H) * (0.008 + hashSeed(i * 13) * 0.012);
        c.save();
        c.translate(x, y);
        c.rotate(tSec * (1 + sx) + i);
        c.fillStyle = hexA(SBA_COLORS[i % SBA_COLORS.length], 0.55 + 0.35 * pulse);
        c.fillRect(-s, -s * 0.4, s * 2, s * 0.8);
        c.restore();
      }
      break;
    }
    case 'waves': {
      for (let layer = 0; layer < 4; layer++) {
        c.beginPath();
        const baseY = H * (0.55 + layer * 0.12);
        const amp = H * (0.03 + layer * 0.02) * (1 + pulse * 0.4);
        const speed = 1.2 + layer * 0.7;
        c.moveTo(0, baseY);
        for (let x = 0; x <= W; x += Math.max(6, W / 90)) {
          c.lineTo(x, baseY + Math.sin(x / W * 6 + tSec * speed + layer * 1.7) * amp);
        }
        c.lineTo(W, H); c.lineTo(0, H); c.closePath();
        c.fillStyle = hexA(SBA_COLORS[(layer + 2) % SBA_COLORS.length], 0.16 + layer * 0.05);
        c.fill();
      }
      break;
    }
    case 'spotlight': {
      const rg = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.min(W, H) * (0.5 + pulse * 0.08));
      rg.addColorStop(0, 'rgba(255,255,255,0.20)');
      rg.addColorStop(0.6, 'rgba(255,255,255,0.05)');
      rg.addColorStop(1, 'rgba(0,0,0,0.25)');
      c.fillStyle = rg;
      c.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        const x = hashSeed(i * 7) * W;
        const y = hashSeed(i * 13 + 5) * H;
        const tw = 0.5 + 0.5 * Math.sin(tSec * (1 + hashSeed(i)) * 3 + i);
        c.fillStyle = `rgba(255,255,255,${0.15 + tw * 0.5})`;
        c.fillRect(x, y, 2, 2);
      }
      break;
    }
  }

  // vignette
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,4,28,0.4)');
  c.fillStyle = vg;
  c.fillRect(0, 0, W, H);
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function hexA(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
