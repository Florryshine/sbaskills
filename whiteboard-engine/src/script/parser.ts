// src/script/parser.ts — lesson script DSL → VideoSpec.
//
// The DSL is intentionally plain-text so teachers can write or paste it.
// Example:
//
//   @title Photosynthesis
//   @subject biology
//
//   scene title
//   heading: Photosynthesis
//   sub: How green plants make their own food
//   narration: Welcome to Shiney Brain Academy. Today we explore photosynthesis.
//   draw: biology.plant at:center scale:1.1
//
//   scene concept
//   heading: The Three Ingredients
//   narration: Photosynthesis needs three key ingredients. Sunlight provides the energy...
//   draw: biology.sun at:top-left sync:sunlight
//   highlight: three key ingredients style:underline

import type {
  ElementSpec,
  EquationTerm,
  SceneLayout,
  SceneSpec,
  Subject,
  SyncRef,
  VideoSpec,
} from '../types';
import { getIllustration, suggestIllustrations } from '../illustrations/registry';

const SUBJECTS: Subject[] = ['biology', 'chemistry', 'physics', 'mathematics', 'general'];

const LAYOUTS: SceneLayout[] = ['title', 'concept', 'diagram', 'list', 'equation', 'summary'];

export class ScriptParseError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`${message} (line ${line})`);
    this.line = line;
  }
}

// ---------------------------------------------------------------------------
// Inline option parsing:  "biology.sun at:top-left scale:1.2 sync:sunlight is energy"
// ---------------------------------------------------------------------------

const INLINE_KEY_RE = /\s([a-zA-Z]+):/g;

export interface InlineOpts {
  primary: string;
  opts: Record<string, string>;
}

export function parseInline(raw: string): InlineOpts {
  const boundaries: Array<{ key: string; start: number; valueStart: number }> = [];
  INLINE_KEY_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INLINE_KEY_RE.exec(raw)) !== null) {
    boundaries.push({ key: m[1], start: m.index, valueStart: m.index + m[0].length });
  }
  if (boundaries.length === 0) {
    return { primary: raw.trim(), opts: {} };
  }
  const primary = raw.slice(0, boundaries[0].start).trim();
  const opts: Record<string, string> = {};
  for (let i = 0; i < boundaries.length; i++) {
    const b = boundaries[i];
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : raw.length;
    opts[b.key] = raw.slice(b.valueStart, end).trim();
  }
  return { primary, opts };
}

function toSync(opts: Record<string, string>): SyncRef | undefined {
  if (opts.sync !== undefined) {
    const phrase = opts.sync.replace(/^["']|["']$/g, '').trim();
    if (phrase) return { kind: 'phrase', phrase };
    return undefined;
  }
  if (opts.fraction !== undefined) {
    const fr = parseFloat(opts.fraction);
    if (isFinite(fr)) return { kind: 'fraction', fraction: Math.max(0, Math.min(1, fr)) };
  }
  if (opts.word !== undefined) {
    const idx = parseInt(opts.word, 10);
    if (isFinite(idx)) return { kind: 'word', index: Math.max(0, idx) };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Equation parsing:  "6CO2 + 6H2O ->[light + chlorophyll] C6H12O6 + 6O2"
// ---------------------------------------------------------------------------

export function parseEquation(raw: string): EquationTerm[] {
  const terms: EquationTerm[] = [];
  const re = /->\[([^\]]*)\]|->/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const chunk = raw.slice(last, m.index).trim();
    if (chunk) terms.push({ kind: 'chem', text: chunk });
    const label = m[1];
    terms.push({ kind: 'arrow', label: label ? label.trim() : undefined });
    last = m.index + m[0].length;
  }
  const tail = raw.slice(last).trim();
  if (tail) terms.push({ kind: 'chem', text: tail });
  return terms.length > 0 ? terms : [{ kind: 'chem', text: raw.trim() }];
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface ParsedLine {
  key: string;
  value: string;
  line: number;
}

export function parseScript(source: string): VideoSpec {
  const lines = source.split(/\r?\n/);
  const meta: Record<string, string> = {};
  const rawScenes: Array<{ layout: SceneLayout; lines: ParsedLine[]; line: number }> = [];
  let current: { layout: SceneLayout; lines: ParsedLine[]; line: number } | null = null;

  lines.forEach((rawLine, idx) => {
    const line = idx + 1;
    let text = rawLine.trim();
    if (!text) return;
    if (text.startsWith('//') || text.startsWith('#')) return; // comments

    if (text.startsWith('@')) {
      const m = text.slice(1).match(/^([a-zA-Z]+)\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
      return;
    }

    const sceneMatch = text.match(/^scene\s+([a-zA-Z-]+)/i);
    if (sceneMatch) {
      const layoutRaw = sceneMatch[1].toLowerCase();
      if (!LAYOUTS.includes(layoutRaw as SceneLayout)) {
        throw new ScriptParseError(
          `Unknown scene layout "${sceneMatch[1]}". Use one of: ${LAYOUTS.join(', ')}`,
          line,
        );
      }
      current = { layout: layoutRaw as SceneLayout, lines: [], line };
      rawScenes.push(current);
      return;
    }

    if (!current) {
      throw new ScriptParseError('Found a directive before any "scene <layout>" line. Start the script with e.g. "scene title".', line);
    }

    const kv = text.match(/^([a-zA-Z]+)\s*:\s*(.*)$/);
    if (!kv) {
      throw new ScriptParseError(`Cannot parse directive "${text}". Expected "key: value".`, line);
    }
    current.lines.push({ key: kv[1].toLowerCase(), value: kv[2], line });
  });

  const title = meta.title || 'Untitled Lesson';
  const subjectRaw = (meta.subject || 'general').toLowerCase() as Subject;
  const subject: Subject = SUBJECTS.includes(subjectRaw) ? subjectRaw : 'general';

  if (rawScenes.length === 0) {
    throw new ScriptParseError('No scenes found. Add at least one "scene <layout>" block.', 1);
  }

  const scenes: SceneSpec[] = rawScenes.map((scene, si) => {
    const spec: SceneSpec = {
      id: `scene-${si + 1}-${scene.layout}`,
      layout: scene.layout,
      narration: '',
      elements: [],
    };
    let elementCounter = 0;
    const nextId = (prefix: string) => `${prefix}-${si + 1}-${++elementCounter}`;

    for (const { key, value, line } of scene.lines) {
      switch (key) {
        case 'narration':
        case 'voiceover':
        case 'speech': {
          if (spec.narration) {
            spec.narration = `${spec.narration} ${value.trim()}`;
          } else {
            spec.narration = value.trim();
          }
          break;
        }
        case 'heading':
        case 'title-text': {
          spec.heading = value.trim();
          break;
        }
        case 'sub':
        case 'subtitle': {
          spec.sub = value.trim();
          break;
        }
        case 'draw': {
          const { primary, opts } = parseInline(value);
          const asset = primary.trim();
          if (!asset) throw new ScriptParseError('draw: needs an illustration id, e.g. "draw: biology.plant".', line);
          const resolved = getIllustration(asset);
          if (!resolved) {
            const suggestions = suggestIllustrations(subject, asset.split(/[.\-_]/));
            throw new ScriptParseError(
              `Unknown illustration "${asset}". Known ids similar to it: ${suggestions.join(', ') || '(none — see listIllustrationIds())'}`,
              line,
            );
          }
          spec.elements.push({
            id: nextId('draw'),
            type: 'illustration',
            asset: resolved.id,
            sync: toSync(opts),
            at: opts.at,
            scale: opts.scale ? parseFloat(opts.scale) : undefined,
          });
          break;
        }
        case 'text': {
          const { primary, opts } = parseInline(value);
          spec.elements.push({
            id: nextId('text'),
            type: 'text',
            text: primary,
            sync: toSync(opts),
            at: opts.at,
            emphasis: opts.emphasis ? opts.emphasis.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          });
          break;
        }
        case 'bullet': {
          const { primary, opts } = parseInline(value);
          spec.elements.push({
            id: nextId('bullet'),
            type: 'bullet',
            text: primary,
            sync: toSync(opts),
            at: opts.at,
            emphasis: opts.emphasis ? opts.emphasis.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
          });
          break;
        }
        case 'arrow': {
          const { opts } = parseInline(value);
          const from = opts.from ? parsePoint(opts.from, line) : undefined;
          const to = opts.to ? parsePoint(opts.to, line) : undefined;
          if (!from || !to) {
            throw new ScriptParseError('arrow: needs from:x,y and to:x,y (board coordinates 1920x1080).', line);
          }
          spec.elements.push({
            id: nextId('arrow'),
            type: 'arrow',
            from,
            to,
            label: opts.label,
            style: opts.style ?? 'curved',
            sync: toSync(opts),
          });
          break;
        }
        case 'highlight': {
          const { primary, opts } = parseInline(value);
          const phrase = primary.replace(/^["']|["']$/g, '').trim();
          if (!phrase) throw new ScriptParseError('highlight: needs the phrase to emphasize.', line);
          spec.elements.push({
            id: nextId('highlight'),
            type: 'highlight',
            text: phrase,
            style: opts.style ?? 'circle',
            sync: toSync(opts) ?? { kind: 'phrase', phrase },
          });
          break;
        }
        case 'equation': {
          const { primary, opts } = parseInline(value);
          spec.elements.push({
            id: nextId('equation'),
            type: 'equation',
            terms: parseEquation(primary),
            sync: toSync(opts),
            at: opts.at,
          });
          break;
        }
        case 'callout': {
          const { primary, opts } = parseInline(value);
          spec.elements.push({
            id: nextId('callout'),
            type: 'callout',
            text: primary,
            at: opts.at,
            sync: toSync(opts),
            style: opts.style,
          });
          break;
        }
        case 'tick': {
          const { primary, opts } = parseInline(value);
          spec.elements.push({
            id: nextId('tick'),
            type: 'tick',
            text: primary,
            sync: toSync(opts),
          });
          break;
        }
        default:
          throw new ScriptParseError(
            `Unknown directive "${key}:". Valid: narration, heading, sub, draw, text, bullet, arrow, highlight, equation, callout, tick.`,
            line,
          );
      }
    }

    if (!spec.narration) {
      throw new ScriptParseError(`Scene "${spec.id}" is missing a "narration:" line.`, scene.line);
    }
    if (scene.layout === 'title' && !spec.heading) {
      spec.heading = title; // fall back to the video title
    }
    return spec;
  });

  return { title, subject, voice: meta.voice || undefined, scenes };
}

function parsePoint(s: string, line: number): { x: number; y: number } {
  const parts = s.split(',').map((v) => parseFloat(v.trim()));
  if (parts.length !== 2 || !isFinite(parts[0]) || !isFinite(parts[1])) {
    throw new ScriptParseError(`Invalid point "${s}". Expected "x,y".`, line);
  }
  return { x: parts[0], y: parts[1] };
}

/** Phrase → first word index in a narration (case/punctuation-insensitive). */
export function findPhraseWordIndex(narrationWords: string[], phrase: string): number | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const target = norm(phrase).split(/\s+/).filter(Boolean);
  if (target.length === 0) return null;
  const words = narrationWords.map((w) => norm(w));
  for (let i = 0; i <= words.length - target.length; i++) {
    let match = true;
    for (let j = 0; j < target.length; j++) {
      if (words[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return null;
}
