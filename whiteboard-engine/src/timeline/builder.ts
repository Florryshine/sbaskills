// src/timeline/builder.ts — VideoSpec + narration → render-ready Timeline.
//
// The builder owns three jobs:
//   1. LAYOUT  — place every element in board coordinates (1920x1080) with
//                per-word rectangles for the handwriting reveal.
//   2. SCHEDULE — convert narration word timings + sync refs into seconds.
//   3. GEOMETRY — sample every stroke into polylines and assign draw slices.
//
// Output is a plain JSON timeline: the Remotion composition does no layout
// or path math at render time — frames stay cheap and deterministic.

import type {
  BBox,
  ElementSpec,
  ElementTimeline,
  EquationTerm,
  IllustrationSpec,
  LaidOutText,
  ResolvedTheme,
  SampledIllustration,
  SceneSpec,
  SceneTimeline,
  SyncRef,
  Timeline,
  VideoSpec,
  WordRect,
  WordTiming,
} from '../types';
import { getTheme, resolveColor, FONT_WIDTH_FACTOR } from '../themes';
import { getIllustration } from '../illustrations/registry';
import { sampleIllustration, scheduleStrokes } from '../geometry/path-sample';
import { straightArrow, curvedArrow, sketchLine, sketchCircle, sketchEllipse, arrowHead } from '../geometry/paths';
import { findPhraseWordIndex } from '../script/parser';

export const BOARD = { w: 1920, h: 1080, margin: 110 };
export const LEAD_IN = 0.5;
export const TAIL_PAD = 1.0;
const ELEMENT_GAP = 0.35;
/** Seconds of drawing per unit of stroke length (at scale 1). */
const DRAW_RATE = 0.0021;

export interface BuildOptions {
  fps?: number;
  /** Pre-computed narration per scene (from the narration pipeline). */
  narration: Array<{ audioFile: string; duration: number; words: WordTiming[] }>;
}

export interface BuildResult {
  timeline: Timeline;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

const F1 = (n: number) => Math.round(n * 10) / 10;
const F2 = (n: number) => Math.round(n * 100) / 100;

function measureWord(word: string, fontSize: number, font: 'heading' | 'body' | 'label'): number {
  return Math.max(2, word.length) * fontSize * FONT_WIDTH_FACTOR[font];
}

function wrapWords(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: 'heading' | 'body' | 'label',
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const w = measureWord(candidate, fontSize, font);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function layoutText(
  text: string,
  opts: {
    x: number;
    y: number;
    width: number;
    fontSize: number;
    font: 'heading' | 'body' | 'label';
    align?: 'left' | 'center';
    color?: string;
    emphasis?: string[];
    writeStart: number;
    writeRate?: number;
    paceTo?: { words: WordTiming[]; fromIndex: number } | null;
  },
): LaidOutText {
  const align = opts.align ?? 'left';
  const lines = wrapWords(text, opts.width, opts.fontSize, opts.font);
  const lineHeight = opts.fontSize * 1.18;
  // Caveat's italic descenders sweep right, so headings need wider word gaps.
  const spaceW = opts.fontSize * FONT_WIDTH_FACTOR[opts.font] * (opts.font === 'heading' ? 0.66 : 0.45);
  const emphasis = new Set((opts.emphasis ?? []).map((e) => e.toLowerCase()));

  const wordRects: WordRect[] = [];
  let writeCursor = opts.writeStart;
  let syncCursor = opts.paceTo?.fromIndex ?? 0;

  lines.forEach((line, li) => {
    const words = line.split(/\s+/).filter(Boolean);
    const lineWidth = words.reduce((a, w) => a + measureWord(w, opts.fontSize, opts.font), 0) + spaceW * Math.max(0, words.length - 1);
    let cursor = align === 'center' ? opts.x + (opts.width - lineWidth) / 2 : opts.x;
    for (const word of words) {
      const w = measureWord(word, opts.fontSize, opts.font);
      const isEmphasis = emphasis.has(word.toLowerCase().replace(/[^a-z0-9]/g, ''));
      // If this element's text is quoted from the narration, ride the narration timing.
      let writeStart = writeCursor;
      let writeDuration = Math.max(0.15, Math.min(0.55, 0.13 + 0.048 * word.length));
      if (opts.paceTo && syncCursor < opts.paceTo.words.length) {
        const nw = opts.paceTo.words[syncCursor];
        writeStart = nw.start;
        writeDuration = Math.max(0.16, (nw.end - nw.start) * 0.88);
        syncCursor++;
      }
      wordRects.push({
        text: word,
        line: li,
        x: F2(cursor),
        y: F2(opts.y + li * lineHeight),
        w: F2(w),
        writeStart: F2(writeStart),
        writeDuration: F2(writeDuration),
        emphasis: isEmphasis,
      });
      cursor += w + spaceW;
      writeCursor = writeStart + writeDuration + 0.03;
    }
  });

  return {
    x: opts.x,
    y: opts.y,
    width: opts.width,
    lines,
    fontSize: opts.fontSize,
    font: opts.font,
    align,
    color: opts.color ?? 'ink',
    wordRects,
  };
}

function textBBox(t: LaidOutText): BBox {
  if (t.wordRects.length === 0) return { x: t.x, y: t.y, w: 0, h: t.fontSize };
  const xs = t.wordRects.map((r) => r.x);
  const xe = t.wordRects.map((r) => r.x + r.w);
  const lineHeight = t.fontSize * 1.18;
  const y0 = t.wordRects[0].y;
  const y1 = t.wordRects[t.wordRects.length - 1].y + lineHeight;
  return { x: Math.min(...xs), y: y0, w: Math.max(...xe) - Math.min(...xs), h: y1 - y0 };
}

/** BBox of a consecutive word run inside a laid-out text. */
function phraseBBox(t: LaidOutText, phrase: string): BBox | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (target.length === 0) return null;
  const rects = t.wordRects;
  for (let i = 0; i <= rects.length - target.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      if (norm(rects[i + j].text) !== target[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const slice = rects.slice(i, i + target.length);
      const lineHeight = t.fontSize * 1.18;
      return {
        x: slice[0].x - 6,
        y: slice[0].y - 4,
        w: slice[slice.length - 1].x + slice[slice.length - 1].w - slice[0].x + 12,
        h: slice[slice.length - 1].y - slice[0].y + lineHeight + 2,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Illustration fitting
// ---------------------------------------------------------------------------

function fitIllustration(
  spec: IllustrationSpec,
  zone: { cx: number; cy: number; maxW: number; maxH: number },
  userScale?: number,
): { sampled: SampledIllustration; x: number; y: number; scale: number; bbox: BBox } {
  const scale = Math.min(zone.maxW / spec.box.w, zone.maxH / spec.box.h) * (userScale ?? 1);
  const w = spec.box.w * scale;
  const h = spec.box.h * scale;
  const x = zone.cx - w / 2;
  const y = zone.cy - h / 2;
  return {
    sampled: null as unknown as SampledIllustration, // filled by caller (needs theme resolver)
    x: F2(x),
    y: F2(y),
    scale: F2(scale),
    bbox: { x: F2(x), y: F2(y), w: F2(w), h: F2(h) },
  };
}

// ---------------------------------------------------------------------------
// Highlight stroke geometry (drawn around a target bbox)
// ---------------------------------------------------------------------------

function highlightStrokes(
  style: string,
  bbox: BBox,
  seed: number,
): Array<{ d: string; width: number }> {
  const pad = 18;
  const x = bbox.x - pad;
  const y = bbox.y - pad * 0.4;
  const w = bbox.w + pad * 2;
  const h = bbox.h + pad * 0.9;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (style) {
    case 'circle': {
      return [
        { d: sketchEllipse(cx, cy, w / 2 + 8, h / 2 + 10, seed, 0), width: 5 },
        { d: sketchEllipse(cx + 4, cy + 2, w / 2 + 4, h / 2 + 7, seed + 7, 0), width: 4 },
      ];
    }
    case 'box': {
      return [{ d: sketchLine(x, y, x + w, y, seed) + ' ' + sketchLine(x + w, y, x + w, y + h, seed + 1) + ' ' + sketchLine(x + w, y + h, x, y + h, seed + 2) + ' ' + sketchLine(x, y + h, x, y, seed + 3), width: 4.5 }];
    }
    case 'underline':
    default: {
      return [
        { d: sketchLine(x - 4, y + h + 4, x + w + 6, y + h + 2, seed, 6, 2), width: 6 },
        { d: sketchLine(x + w * 0.12, y + h + 14, x + w * 0.8, y + h + 12, seed + 5, 5, 2), width: 3.5 },
      ];
    }
  }
}

function highlightColorForStyle(style: string, theme: ResolvedTheme): string {
  switch (style) {
    case 'circle':
      return theme.accent;
    case 'box':
      return theme.accent2;
    default:
      return theme.accent;
  }
}

// ---------------------------------------------------------------------------
// Arrow element geometry
// ---------------------------------------------------------------------------

function arrowStrokes(
  from: { x: number; y: number },
  to: { x: number; y: number },
  style: string,
  seed: number,
): Array<{ d: string; width: number }> {
  const built = style === 'straight'
    ? straightArrow(from.x, from.y, to.x, to.y, seed, 16)
    : curvedArrow(from.x, from.y, to.x, to.y, seed, 0.16, 16);
  return [
    { d: built.shaft, width: 5 },
    { d: built.head, width: 5 },
  ];
}

// ---------------------------------------------------------------------------
// Layout zones per scene layout
// ---------------------------------------------------------------------------

interface BodyCursor {
  y: number;
  x: number;
  width: number;
}

function layoutSceneElements(
  scene: SceneSpec,
  words: WordTiming[],
  theme: ResolvedTheme,
  duration: number,
  warnings: string[],
): ElementTimeline[] {
  const elements = scene.elements;
  const out: ElementTimeline[] = [];
  const layout = scene.layout;

  // ---- zone setup -------------------------------------------------------
  const headingSize = layout === 'title' ? 108 : 76;
  const bodyStartY = { concept: 330, list: 330, diagram: 250, equation: 300, title: 480, summary: 290 }[layout];

  let body: BodyCursor = {
    x: BOARD.margin,
    y: bodyStartY,
    width: layout === 'list' ? 700 : layout === 'diagram' ? 400 : 760,
  };
  const draws = elements.filter((e) => e.type === 'illustration');
  const drawCount = draws.length;

  // 3+ illustrations in concept layout flow as a full-width row at the bottom.
  const conceptRowMode = layout === 'concept' && drawCount >= 3;
  if (conceptRowMode) body.width = 760;

  const illustrationZoneFor = (index: number, count: number) => {
    if (layout === 'title') {
      if (count === 1) return { cx: 960, cy: 700, maxW: 760, maxH: 430 };
      return {
        cx: count === 2 ? 960 + (index === 0 ? -280 : 280) : 960 + (index - (count - 1) / 2) * 420,
        cy: 700,
        maxW: 480,
        maxH: 430,
      };
    }
    if (layout === 'diagram') {
      // first draw is the main diagram (right-of-center), later draws sit small on the left
      if (index === 0) {
        return count === 1
          ? { cx: 1000, cy: 600, maxW: 960, maxH: 600 }
          : { cx: 1120, cy: 620, maxW: 720, maxH: 540 };
      }
      if (index === 1) return { cx: 370, cy: 560, maxW: 400, maxH: 330 };
      return { cx: 370, cy: index === 2 ? 860 : 240, maxW: 360, maxH: 260 };
    }
    if (layout === 'equation') {
      return { cx: 1560, cy: 830, maxW: 480, maxH: 400 };
    }
    if (layout === 'summary') {
      return { cx: 1560, cy: 800, maxW: 460, maxH: 380 };
    }
    if (layout === 'list') {
      return { cx: 1430, cy: 640, maxW: 640, maxH: 560 };
    }
    // concept
    if (count === 1) return { cx: 1400, cy: 620, maxW: 740, maxH: 620 };
    if (count === 2) {
      return index === 0
        ? { cx: 1400, cy: 420, maxW: 620, maxH: 420 }
        : { cx: 1400, cy: 830, maxW: 620, maxH: 420 };
    }
    if (conceptRowMode) {
      const xs = [420, 960, 1500].slice(0, count);
      const cx = count === 3 ? xs[index] : 480 + index * 400;
      return { cx, cy: 820, maxW: 470, maxH: 380 };
    }
    return { cx: 1400, cy: 620, maxW: 600, maxH: 520 };
  };

  // ---- scheduling pass --------------------------------------------------
  let prevEnd = LEAD_IN;
  let bodyPrevEnd = LEAD_IN;
  const resolver = (c?: string) => resolveColor(theme, c);

  // Pre-resolve sync times
  const syncTimeOf = (sync: SyncRef | undefined, fallbackPrev: number): { time: number; wordIndex: number | null } => {
    if (sync) {
      if (sync.kind === 'phrase') {
        const idx = findPhraseWordIndex(words.map((w) => w.word), sync.phrase);
        if (idx !== null && words[idx]) {
          return { time: LEAD_IN + words[idx].start, wordIndex: idx };
        }
        warnings.push(`Sync phrase "${sync.phrase}" not found in narration of scene "${scene.id}" — falling back to sequential.`);
      } else if (sync.kind === 'fraction') {
        const last = words[words.length - 1];
        const t = last ? last.end * sync.fraction : duration * 0.5;
        return { time: LEAD_IN + Math.max(0.2, t), wordIndex: null };
      } else if (sync.kind === 'word') {
        const w = words[Math.min(sync.index, words.length - 1)];
        if (w) return { time: LEAD_IN + w.start, wordIndex: sync.index };
      }
    }
    return { time: fallbackPrev, wordIndex: null };
  };

  // First pass: assign starts + layout for text-ish elements so highlights can target them.
  const laidOut = new Map<string, LaidOutText>();

  // Heading
  if (scene.heading) {
    const headingAlign = layout === 'title' || layout === 'summary' || layout === 'diagram' ? 'center' : 'left';
    const hx = headingAlign === 'center' ? (BOARD.w - 1400) / 2 : BOARD.margin;
    const text = layoutText(scene.heading, {
      x: hx,
      y: layout === 'title' ? 250 : 110,
      width: 1400,
      fontSize: headingSize,
      font: 'heading',
      align: headingAlign,
      color: 'ink',
      writeStart: LEAD_IN,
      writeRate: 1.3,
    });
    laidOut.set('__heading', text);
  }
  if (scene.sub) {
    const align = layout === 'title' || layout === 'diagram' ? 'center' : 'left';
    const sx = align === 'center' ? (BOARD.w - 1300) / 2 : BOARD.margin;
    const sy = layout === 'title' ? 430 : scene.heading ? 210 : 120;
    const text = layoutText(scene.sub, {
      x: sx,
      y: sy,
      width: 1300,
      fontSize: 44,
      font: 'body',
      align,
      color: 'inkSoft',
      writeStart: LEAD_IN + 0.9,
    });
    laidOut.set('__sub', text);
  }

  // Element starts: computed in DOM order, respecting explicit syncs.
  // Pass 1 estimates each element's duration so sequential fallbacks keep
  // elements serialized instead of stacking at the same second.
  let cursor = LEAD_IN + (scene.heading ? 1.9 : 0) + (scene.sub ? 1.0 : 0);
  const startTimes = new Map<string, number>();
  const estimateDuration = (el: ElementSpec): number => {
    switch (el.type) {
      case 'text':
      case 'bullet':
        return (el.text?.split(/\s+/).filter(Boolean).length ?? 0) * 0.33 + 0.5;
      case 'tick':
        return 0.5 + (el.text?.split(/\s+/).filter(Boolean).length ?? 0) * 0.26;
      case 'callout':
        return (el.text?.split(/\s+/).filter(Boolean).length ?? 0) * 0.3 + 0.5;
      case 'illustration': {
        const illSpec = el.asset ? getIllustration(el.asset) : null;
        if (!illSpec) return 0;
        const zone = illustrationZoneFor(draws.indexOf(el), drawCount);
        const scale = Math.min(zone.maxW / illSpec.box.w, zone.maxH / illSpec.box.h) * (el.scale ?? 1);
        const estLen = illSpec.strokes.length * 220; // rough per-stroke length
        return Math.max(1.3, Math.min(7.5, estLen * scale * DRAW_RATE));
      }
      case 'arrow':
        return 0.7;
      case 'highlight':
        return 1.2;
      case 'equation':
        return (el.terms?.length ?? 0) * 0.55;
      default:
        return 1.0;
    }
  };

  for (const el of elements) {
    const est = estimateDuration(el);
    const { time } = syncTimeOf(el.sync, Math.max(cursor, prevEnd));
    let start = Math.max(time, LEAD_IN + 0.25);
    if (el.type === 'text' || el.type === 'bullet' || el.type === 'tick') {
      // keep the text column readable: serialize stacked body text
      start = Math.max(start, bodyPrevEnd + 0.15);
      bodyPrevEnd = start + est;
    }
    startTimes.set(el.id, start);
    cursor = start + est;
    prevEnd = Math.max(prevEnd, start + est);
  }

  // Second pass: build ElementTimeline entries.
  for (const el of elements) {
    let start = startTimes.get(el.id) ?? LEAD_IN;
    let drawDuration = 1.0;
    const t: ElementTimeline = { spec: el, start: F2(start), drawDuration: F2(drawDuration) };

    switch (el.type) {
      case 'text':
      case 'bullet': {
        const fontSize = 44;
        const text = layoutText(el.text ?? '', {
          x: el.type === 'bullet' ? body.x + 56 : body.x,
          y: body.y,
          width: body.width - (el.type === 'bullet' ? 56 : 0),
          fontSize,
          font: 'body',
          align: 'left',
          color: 'ink',
          emphasis: el.emphasis,
          writeStart: start,
          paceTo: null,
        });
        // Pace the writing to the narration span of its sync phrase when the
        // element text quotes the narration.
        if (el.sync?.kind === 'phrase') {
          const idx = findPhraseWordIndex(words.map((w) => w.word), el.sync.phrase);
          const elWords = el.text?.split(/\s+/).filter(Boolean).length ?? 0;
          if (idx !== null && elWords > 0) {
            const spanWords = words.slice(idx, idx + elWords);
            if (spanWords.length === elWords) {
              // exact quote → ride narration timing per word
              let wi = 0;
              for (const wr of text.wordRects) {
                const nw = words[idx + wi];
                if (!nw) break;
                wr.writeStart = F2(LEAD_IN + nw.start);
                wr.writeDuration = F2(Math.max(0.16, (nw.end - nw.start) * 0.88));
                wi++;
              }
            }
          }
        }
        const writeEnds = text.wordRects.map((r) => r.writeStart + r.writeDuration);
        drawDuration = Math.max(0.8, Math.max(...writeEnds, start + 0.8) - start);
        t.text = text;
        t.bbox = textBBox(text);
        laidOut.set(el.id, text);
        body.y += text.lines.length * (fontSize * 1.18) + (el.type === 'bullet' ? 34 : 30);
        bodyPrevEnd = start + drawDuration;
        break;
      }
      case 'illustration': {
        const illSpec = el.asset ? getIllustration(el.asset) : null;
        if (!illSpec) {
          warnings.push(`Scene "${scene.id}": illustration "${el.asset}" not found — skipping.`);
          start = startTimes.get(el.id) ?? LEAD_IN;
          break;
        }
        const drawIndex = draws.indexOf(el);
        const zone = illustrationZoneFor(drawIndex, drawCount);
        const fitted = fitIllustration(illSpec, zone, el.scale);
        const sampled = sampleIllustration(illSpec, resolver);
        // Scale-aware draw duration, clamped to a sensible teaching rhythm.
        const raw = sampled.totalLength * fitted.scale * DRAW_RATE;
        drawDuration = Math.max(1.3, Math.min(7.5, raw));
        if (start + drawDuration > duration - 0.5) {
          drawDuration = Math.max(1.0, duration - 0.5 - start);
        }
        scheduleStrokes(sampled.strokes, drawDuration);
        t.illustration = { sampled, x: fitted.x, y: fitted.y, scale: fitted.scale };
        t.bbox = fitted.bbox;
        t.start = F2(start);
        t.drawDuration = F2(drawDuration);
        prevEnd = start + drawDuration;
        break;
      }
      case 'arrow': {
        if (!el.from || !el.to) {
          warnings.push(`Scene "${scene.id}": arrow without from/to — skipping.`);
          continue;
        }
        const strokes = arrowStrokes(el.from, el.to, el.style ?? 'curved', hash(el.id) % 1000);
        const sampled: SampledIllustration = sampleIllustration(
          {
            id: `arrow:${el.id}`,
            strokes: strokes.map((s) => ({ d: s.d, width: s.width, color: theme.accent2 })),
            labels: [],
            box: { w: BOARD.w, h: BOARD.h },
          },
          resolver,
        );
        drawDuration = Math.max(0.55, Math.min(1.6, sampled.totalLength * 0.0016));
        scheduleStrokes(sampled.strokes, drawDuration);
        t.illustration = { sampled, x: 0, y: 0, scale: 1 };
        t.bbox = {
          x: Math.min(el.from.x, el.to.x),
          y: Math.min(el.from.y, el.to.y),
          w: Math.abs(el.to.x - el.from.x),
          h: Math.abs(el.to.y - el.from.y),
        };
        prevEnd = start + drawDuration;
        break;
      }
      case 'highlight': {
        // Find the target bbox: heading → sub → body texts.
        const phrase = el.text ?? '';
        let bbox: BBox | null = null;
        const heading = laidOut.get('__heading');
        const sub = laidOut.get('__sub');
        if (heading && phraseBBox(heading, phrase)) bbox = phraseBBox(heading, phrase);
        else if (sub && phraseBBox(sub, phrase)) bbox = phraseBBox(sub, phrase);
        else {
          for (const [id, text] of laidOut) {
            if (id.startsWith('__')) continue;
            const b = phraseBBox(text, phrase);
            if (b) {
              bbox = b;
              break;
            }
          }
        }
        if (!bbox) {
          warnings.push(`Scene "${scene.id}": highlight "${phrase}" matched no text — highlighting the heading instead.`);
          bbox = heading ? textBBox(heading) : { x: 760, y: 120, w: 400, h: 80 };
        }
        const style = el.style ?? 'circle';
        const strokes = highlightStrokes(style, bbox, hash(el.id) % 1000);
        const sampled = sampleIllustration(
          {
            id: `highlight:${el.id}`,
            strokes: strokes.map((s) => ({ d: s.d, width: s.width, color: highlightColorForStyle(style, theme) })),
            labels: [],
            box: { w: BOARD.w, h: BOARD.h },
          },
          resolver,
        );
        drawDuration = Math.max(0.6, Math.min(1.5, sampled.totalLength * 0.0018));
        scheduleStrokes(sampled.strokes, drawDuration);
        t.illustration = { sampled, x: 0, y: 0, scale: 1 };
        t.bbox = bbox;
        prevEnd = start + drawDuration;
        break;
      }
      case 'equation': {
        const terms = el.terms ?? [];
        const fontSize = 62;
        const gap = 30;
        const widths = terms.map((term) => {
          if (term.kind === 'arrow') {
            return Math.max(150, (term.label?.length ?? 0) * fontSize * 0.28 + 90);
          }
          return measureWord(term.text ?? '', fontSize, 'body');
        });
        const total = widths.reduce((a, b) => a + b, 0) + gap * (terms.length - 1);
        const startX = (BOARD.w - total) / 2;
        const eqY = 470;
        let termCursor = start;
        const termTimes: Array<{ start: number; duration: number }> = [];
        for (const term of terms) {
          const d = term.kind === 'arrow' ? 0.55 : Math.max(0.35, Math.min(0.9, (term.text?.length ?? 4) * 0.052 + 0.2));
          termTimes.push({ start: F2(termCursor), duration: F2(d) });
          termCursor += d + 0.14;
        }
        drawDuration = termCursor - start;
        let termX = startX;
        const laidTerms: Array<
          EquationTerm & { x: number; w: number; start: number; duration: number; strokes?: SampledIllustration }
        > = terms.map((term, i) => {
          const entry: EquationTerm & { x: number; w: number; start: number; duration: number; strokes?: SampledIllustration } = {
            ...term,
            x: F2(termX),
            w: F2(widths[i]),
            start: termTimes[i].start,
            duration: termTimes[i].duration,
          };
          if (term.kind === 'arrow') {
            const yMid = eqY;
            const x1 = termX + 10;
            const x2 = termX + widths[i] - 10;
            const strokes = arrowStrokes({ x: x1, y: yMid }, { x: x2, y: yMid }, 'straight', hash(el.id + i) % 1000);
            const sampled = sampleIllustration(
              {
                id: `eq-arrow:${el.id}:${i}`,
                strokes: strokes.map((s) => ({ d: s.d, width: s.width, color: theme.ink })),
                labels: [],
                box: { w: BOARD.w, h: BOARD.h },
              },
              resolver,
            );
            scheduleStrokes(sampled.strokes, termTimes[i].duration);
            entry.strokes = sampled;
          }
          termX += widths[i] + gap;
          return entry;
        });
        t.equation = {
          terms: laidTerms,
          y: eqY,
          fontSize,
        };
        prevEnd = start + drawDuration;
        break;
      }
      case 'callout': {
        const at = el.at ?? 'bottom-right';
        const positions: Record<string, { x: number; y: number }> = {
          'top-left': { x: BOARD.margin, y: 214 },
          'top-right': { x: BOARD.w - BOARD.margin - 620, y: 214 },
          'bottom-left': { x: BOARD.margin, y: BOARD.h - 180 },
          'bottom-right': { x: BOARD.w - BOARD.margin - 620, y: BOARD.h - 180 },
          left: { x: BOARD.margin, y: 520 },
          right: { x: BOARD.w - BOARD.margin - 620, y: 520 },
        };
        const pos = positions[at] ?? positions['bottom-right'];
        const text = layoutText(el.text ?? '', {
          x: pos.x,
          y: pos.y,
          width: 620,
          fontSize: 36,
          font: 'label',
          align: 'left',
          color: el.style === 'accent' ? theme.accent : 'inkSoft',
          writeStart: start,
        });
        drawDuration = Math.max(0.5, (text.wordRects.at(-1)?.writeStart ?? start) + (text.wordRects.at(-1)?.writeDuration ?? 0.4) - start);
        t.text = text;
        t.bbox = textBBox(text);
        prevEnd = start + drawDuration;
        break;
      }
      case 'tick': {
        // Draw a check mark + text, used in summary layouts.
        const checkStrokes = [
          { d: sketchLine(0, 0, 0, 0, 1), width: 8 }, // placeholder — built below
        ];
        void checkStrokes;
        const fontSize = 42;
        const tickX = body.x;
        const text = layoutText(el.text ?? '', {
          x: tickX + 76,
          y: body.y,
          width: 700,
          fontSize,
          font: 'body',
          align: 'left',
          color: 'ink',
          writeStart: start + 0.35,
        });
        const check = sampleIllustration(
          {
            id: `tick:${el.id}`,
            strokes: [
              { d: sketchLine(tickX + 12, body.y + 34, tickX + 34, body.y + 56, hash(el.id)), width: 7, color: theme.accent },
              { d: sketchLine(tickX + 34, body.y + 56, tickX + 66, body.y - 4, hash(el.id) + 3), width: 7, color: theme.accent },
            ],
            labels: [],
            box: { w: BOARD.w, h: BOARD.h },
          },
          resolver,
        );
        drawDuration = Math.max(0.7, ((text.wordRects.at(-1)?.writeStart ?? start) + (text.wordRects.at(-1)?.writeDuration ?? 0.4) - start) + 0.35);
        scheduleStrokes(check.strokes, 0.5);
        t.illustration = { sampled: check, x: 0, y: 0, scale: 1 };
        t.text = text;
        t.bbox = textBBox(text);
        body.y += 118;
        bodyPrevEnd = start + drawDuration;
        break;
      }
    }

    t.start = F2(start);
    t.drawDuration = F2(drawDuration);
    out.push(t);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildTimeline(spec: VideoSpec, narration: BuildOptions['narration'], options?: { fps?: number }): BuildResult {
  const warnings: string[] = [];
  const fps = options?.fps ?? 30;
  const theme = getTheme(spec.subject);

  if (spec.scenes.length !== narration.length) {
    throw new Error(`buildTimeline: ${spec.scenes.length} scenes but ${narration.length} narration entries`);
  }

  const scenes: SceneTimeline[] = [];
  let abs = 0;

  spec.scenes.forEach((scene, i) => {
    const nar = narration[i];
    const leadIn = LEAD_IN;
    let duration = leadIn + nar.duration + TAIL_PAD;
    duration = Math.max(duration, scene.minDuration ?? 5.5);

    const elements = layoutSceneElements(scene, nar.words, theme, duration, warnings);

    // make sure the last element fits
    const lastEnd = elements.reduce((acc, e) => Math.max(acc, e.start + e.drawDuration), 0);
    if (lastEnd + 0.5 > duration) duration = lastEnd + 0.8;

    const seed = hash(`${spec.title}:${scene.id}`);
    const camera = {
      zoomStart: F1(1.035 + ((seed % 10) - 5) * 0.0015),
      zoomEnd: F1(1.0),
      panX: ((seed >> 3) % 24) - 12,
      panY: ((seed >> 7) % 16) - 8,
    };

    const built: SceneTimeline = {
      id: scene.id,
      layout: scene.layout,
      heading: undefined,
      sub: undefined,
      start: F2(abs),
      duration: F2(duration),
      leadIn,
      audioFile: nar.audioFile,
      narration: scene.narration,
      words: nar.words.map((w) => ({ ...w, start: F2(w.start), end: F2(w.end) })),
      elements,
      camera,
    };

    // Heading/sub timelines live on the scene (drawn before elements).
    if (scene.heading) {
      const headingAlign = scene.layout === 'title' || scene.layout === 'summary' || scene.layout === 'diagram' ? 'center' : 'left';
      const headingSize = scene.layout === 'title' ? 108 : 76;
      const hx = headingAlign === 'center' ? (BOARD.w - 1400) / 2 : BOARD.margin;
      built.heading = layoutText(scene.heading, {
        x: hx,
        y: scene.layout === 'title' ? 250 : 110,
        width: 1400,
        fontSize: headingSize,
        font: 'heading',
        align: headingAlign,
        writeStart: LEAD_IN,
      });
      // pace heading words onto the narration if the heading appears verbatim
    }
    if (scene.sub) {
      const align = scene.layout === 'title' || scene.layout === 'diagram' ? 'center' : 'left';
      built.sub = layoutText(scene.sub, {
        x: align === 'center' ? (BOARD.w - 1300) / 2 : BOARD.margin,
        y: scene.layout === 'title' ? 430 : scene.heading ? 210 : 120,
        width: 1300,
        fontSize: 44,
        font: 'body',
        align,
        color: 'inkSoft',
        writeStart: LEAD_IN + 0.9,
      });
    }

    scenes.push(built);
    abs += duration;
  });

  return {
    timeline: {
      fps,
      width: BOARD.w,
      height: BOARD.h,
      title: spec.title,
      subject: spec.subject,
      theme,
      scenes,
      totalDuration: F2(abs),
    },
    warnings,
  };
}

// Re-export for consumers that need layout helpers (e.g. the LLM planner docs)
export { sketchCircle, arrowHead };
