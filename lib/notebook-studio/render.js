import sharp from 'sharp';
import { textToSvg, variationPlugin } from 'tegaki/core';
import atma from 'tegaki/fonts/atma';

/*
 * Notebook Studio renderer.
 *
 * Handwriting is drawn with tegaki (stroke-based handwriting SVG) and composited
 * onto ruled paper with sharp. Key rules this file depends on:
 *
 *  - tegaki's size option is `fontSize` (px). `size` is silently ignored and
 *    everything is drawn at 100px.
 *  - Every text run is drawn with `crop: false` so its SVG box is the font's
 *    layout box, which makes the baseline position a pure function of the font
 *    metrics. That is what lets text sit exactly on the ruled lines.
 *  - tegaki draws nothing for characters the font has no strokes for, and uses a
 *    half-em gap for them. We therefore normalise symbols, draw superscripts,
 *    subscripts and arrows ourselves, and measure/wrap with the font's real
 *    advance widths.
 */

const WIDTH = 1200;
const HEIGHT = 1600;
const FONT = atma;
const UPM = FONT.unitsPerEm;
const ASC = FONT.ascender;
const DESC = FONT.descender;
const GLYPHS = FONT.glyphData;

const INK = '#1b3596'; // blue ballpoint, as in a real exercise book
const HEADING_INK = '#1b3596';
const NOTE_INK = '#b3262d';
const ANSWER_INK = '#17634a';

const SPACE_EM = 0.27; // handwriting word gap (tegaki's own fallback would be 0.5em)
const SCRIPT_SCALE = 0.66; // superscript / subscript size
const BODY_PLUGINS = [variationPlugin({ amount: 0.07 })];
const HEAD_PLUGINS = [variationPlugin({ amount: 0.05 })];

const LEFT = 70;
const CONTENT_RIGHT = 1150;
const GRID_TOP = 104; // y of the first ruled line; every header/body baseline snaps to the grid
const FOOTER_RULE_Y = 1512;
const LAST_BASELINE_Y = 1490;

// Largest handwriting that fits wins, so short notes are big and readable on a phone
// and longer notes step down. The ruled-paper pitch follows the chosen size.
const LAYOUTS = {
  xl: { body: 44, head: 46, sub: 44, title: 50, pitch: 60, lift: 11 },
  large: { body: 40, head: 42, sub: 40, title: 46, pitch: 55, lift: 10 },
  normal: { body: 36, head: 38, sub: 36, title: 42, pitch: 50, lift: 9 },
  compact: { body: 32, head: 34, sub: 32, title: 38, pitch: 44, lift: 8 },
};

/* ------------------------------------------------------------------ text */

function cleanText(value = '') {
  return String(value)
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // real HTML tags only: keep "a < b and c > d"
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, '$1')
    .replace(/(?<![\w*])\*(\S(?:.*?\S)?)\*(?![\w*])/g, '$1') // markdown emphasis only: keep "5 * 3"
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYMBOL_MAP = {
  '−': '-', '–': '-', '—': '-', '‐': '-', '‑': '-',
  '×': 'x', '✕': 'x', '÷': '/', '⁄': '/',
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '…': '...', '•': '-', '·': '.', '∙': '.',
  '½': '1/2', '¼': '1/4', '¾': '3/4',
  '≈': '~', '≤': '<=', '≥': '>=', '≠': '!=',
  '√': 'sqrt', 'π': 'pi', 'Δ': 'Delta', 'θ': 'theta',
  '±': '+/-', 'µ': 'u', 'μ': 'u', 'Ω': 'Omega', 'λ': 'lambda',
  'α': 'alpha', 'β': 'beta', 'γ': 'gamma',
  '°': '^o',
};

const SUP_CHARS = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
const SUB_CHARS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-' };

function normalizeSymbols(text) {
  return text
    .replace(/[⁰¹²³⁴-⁻]+/g, (m) => `^{${[...m].map((c) => SUP_CHARS[c] ?? '').join('')}}`)
    .replace(/[₀-₋]+/g, (m) => `_{${[...m].map((c) => SUB_CHARS[c] ?? '').join('')}}`)
    .replace(/[↔⇌⇄]/g, ' <-> ')
    .replace(/\s*(?:→|⟶|➔|⇒|->|=>)\s*/g, ' -> ')
    .replace(/[−–—‐‑×✕÷⁄‘’“”…•·∙½¼¾≈≤≥≠√πΔθ±µμΩλαβγ°]/g, (c) => SYMBOL_MAP[c] ?? c);
}

const ELEMENTS = new Set('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Ag Cd In Sn Sb Te I Xe Cs Ba La W Pt Au Hg Pb Bi U'.split(' '));

// "6CO2" -> 6 CO (sub 2).  Only words made entirely of real element symbols qualify,
// so ordinary words and labels such as "Q2" or "Paper2" are never touched.
function chemRuns(word) {
  const m = word.match(/^(\d*)((?:[A-Z][a-z]?\d*|\([A-Za-z0-9]+\)\d*)+)([.,;:!?)]*)$/);
  if (!m) return null;
  const body = m[2];
  const symbols = body.replace(/\([A-Za-z0-9]+\)/g, (g) => g.slice(1, -1)).match(/[A-Z][a-z]?/g) || [];
  if (!symbols.length || !symbols.every((s) => ELEMENTS.has(s))) return null;
  if (!/(?:[A-Za-z)])(?:[2-9]|1\d)/.test(body)) return null;

  const runs = [];
  if (m[1]) runs.push({ text: m[1], mode: 'n' });
  let buffer = '';
  let digits = '';
  const flush = () => {
    if (buffer) runs.push({ text: buffer, mode: 'n' });
    if (digits) runs.push({ text: digits, mode: 'sub' });
    buffer = '';
    digits = '';
  };
  let prev = '';
  for (const ch of body) {
    if (/\d/.test(ch) && /[A-Za-z)]/.test(prev || (digits ? 'x' : ''))) {
      digits += ch;
    } else if (/\d/.test(ch) && digits) {
      digits += ch;
    } else {
      if (digits) flush();
      buffer += ch;
    }
    prev = ch;
  }
  flush();
  if (m[3]) runs.push({ text: m[3], mode: 'n' });
  return runs;
}

const SCRIPT_RE_SOURCE = '\\^(\\{[^}]*\\}|[+-]?\\d+|[+-]|[A-Za-z])|_(\\{[^}]*\\}|\\d+)';

function splitScripts(word) {
  const re = new RegExp(SCRIPT_RE_SOURCE, 'g');
  const runs = [];
  let last = 0;
  let match;
  while ((match = re.exec(word))) {
    if (match.index > last) runs.push({ text: word.slice(last, match.index), mode: 'n' });
    const isSup = match[0][0] === '^';
    let body = match[1] ?? match[2];
    if (body.startsWith('{')) body = body.slice(1, -1);
    if (body) runs.push({ text: body, mode: isSup ? 'sup' : 'sub' });
    last = match.index + match[0].length;
  }
  if (last < word.length) runs.push({ text: word.slice(last), mode: 'n' });
  return runs;
}

// Drop characters the handwriting font cannot draw (tegaki would leave a blank gap).
function drawable(text, dropped) {
  let out = '';
  for (const ch of Array.from(text)) {
    if (GLYPHS[ch]) out += ch;
    else if (/\s/.test(ch)) continue;
    else dropped.add(ch);
  }
  return out;
}

function wordRuns(word, dropped) {
  if (word === '->') return [{ arrow: 'right' }];
  if (word === '<->') return [{ arrow: 'both' }];
  const runs = chemRuns(word) || splitScripts(word);
  return runs
    .map((run) => ({ ...run, text: drawable(run.text, dropped) }))
    .filter((run) => run.text);
}

function textToWords(text, dropped) {
  return normalizeSymbols(cleanText(text))
    .split(' ')
    .filter(Boolean)
    .map((word) => wordRuns(word, dropped))
    .filter((runs) => runs.length);
}

/* --------------------------------------------------------------- metrics */

function advanceEm(ch) {
  const glyph = GLYPHS[ch];
  return glyph?.w != null ? glyph.w / UPM : 0.5;
}

function textWidth(text, size) {
  let em = 0;
  for (const ch of Array.from(text)) em += advanceEm(ch);
  return em * size;
}

function arrowWidth(size) {
  return size * 1.25;
}

function runWidth(run, size) {
  if (run.arrow) return arrowWidth(size);
  return textWidth(run.text, run.mode === 'n' ? size : size * SCRIPT_SCALE);
}

function wordWidth(runs, size) {
  return runs.reduce((sum, run) => sum + runWidth(run, size), 0);
}

function lineWidth(words, size) {
  if (!words.length) return 0;
  return words.reduce((sum, word) => sum + wordWidth(word, size), 0) + (words.length - 1) * SPACE_EM * size;
}

// With crop:false tegaki's box is padded by 0.2em horizontally and the glyph's
// ascender line sits at `padV`; the baseline is `ascender` below that.
function glyphBox(size) {
  const emHeight = ((ASC - DESC) / UPM) * size;
  const padV = Math.max(0.2 * size, (1.8 * size - emHeight) / 2);
  return { padH: 0.2 * size, baseline: padV + (ASC / UPM) * size };
}

function wrapWords(words, maxWidth, size) {
  const lines = [];
  let line = [];
  for (const word of words) {
    const candidate = [...line, word];
    if (line.length && lineWidth(candidate, size) > maxWidth) {
      lines.push(line);
      line = [word];
    } else {
      line = candidate;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

/* --------------------------------------------------------------- drawing */

const r2 = (n) => Math.round(n * 100) / 100;

function hash(n) {
  let x = (n | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967295;
}

function inkSvg(text, size, color, plugins, seed) {
  const svg = textToSvg(text, FONT, { mode: 'static', fontSize: size, color, crop: false, plugins, seed, segmentSize: 2.5 });
  return svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

function arrowMarkup(kind, x, baseline, size, color) {
  const w = arrowWidth(size);
  const y = baseline - size * 0.27;
  const x0 = x + size * 0.12;
  const x1 = x + w - size * 0.12;
  const head = size * 0.2;
  const sw = r2(Math.max(2.2, size * 0.065));
  let d = `M ${r2(x0)} ${r2(y + 0.6)} Q ${r2((x0 + x1) / 2)} ${r2(y - 1.4)} ${r2(x1)} ${r2(y)}`;
  d += ` M ${r2(x1 - head)} ${r2(y - head * 0.85)} L ${r2(x1)} ${r2(y)} L ${r2(x1 - head)} ${r2(y + head * 0.85)}`;
  if (kind === 'both') d += ` M ${r2(x0 + head)} ${r2(y - head * 0.85)} L ${r2(x0)} ${r2(y + 0.6)} L ${r2(x0 + head)} ${r2(y + head * 0.85)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function drawLine(words, x, baseline, size, color, plugins, seedBase) {
  const parts = [];
  let cx = x;
  words.forEach((word, wi) => {
    word.forEach((run, ri) => {
      if (run.arrow) {
        parts.push(arrowMarkup(run.arrow, cx, baseline, size, color));
      } else {
        const runSize = run.mode === 'n' ? size : size * SCRIPT_SCALE;
        const runBase = baseline + (run.mode === 'sup' ? -0.4 * size : run.mode === 'sub' ? 0.14 * size : 0);
        const box = glyphBox(runSize);
        const seed = seedBase * 131 + wi * 17 + ri * 5;
        // Drawn twice, half a pixel apart, so the pen line has the weight of a real ballpoint.
        const ink = inkSvg(run.text, runSize, color, plugins, seed);
        parts.push(`<g transform="translate(${r2(cx - box.padH)} ${r2(runBase - box.baseline)})">${ink}<g transform="translate(0.7 0.35)">${ink}</g></g>`);
      }
      cx += runWidth(run, size);
    });
    cx += SPACE_EM * size;
  });
  return parts.join('');
}

/* --------------------------------------------------------------- palette */

function templatePalette(template) {
  if (template === 'premium') return {
    paper: '#fcfdff', line: '#7ea8de', margin: '#8db5e6', marker: '#86cdf6', secondary: '#eef6fd',
  };
  if (template === 'revision') return {
    paper: '#fffffc', line: '#7fa6d6', margin: '#8fb2dc', marker: '#7cc7f2', secondary: '#eff6fb',
  };
  return {
    paper: '#fdfdff', line: '#6f9fdc', margin: '#86afe3', marker: '#7fcaf3', secondary: '#eef5fd',
  };
}

/* ---------------------------------------------------------------- blocks */

const ALLOWED_TYPES = new Set(['heading', 'subheading', 'paragraph', 'bullet', 'numbered', 'definition', 'example', 'formula', 'question', 'answer', 'note']);

function normalizeBlocks(sections, content) {
  if (Array.isArray(sections) && sections.length) {
    return sections.slice(0, 18).map((section) => ({
      type: ALLOWED_TYPES.has(section?.type) ? section.type : 'paragraph',
      text: cleanText(section?.text || section?.label || ''),
    })).filter((section) => section.text);
  }

  // Backward compatibility for older content records that only contain a text body.
  return String(content || '').split(/\n+/).map((line) => cleanText(line)).filter(Boolean).map((line) => {
    if (/^\d+[.)]\s/.test(line)) return { type: 'numbered', text: line.replace(/^\d+[.)]\s*/, '') };
    if (/^[•*-]\s*/.test(line)) return { type: 'bullet', text: line.replace(/^[•*-]\s*/, '') };
    if (/^(definition|examples?|key points?|answer|explanation|note):/i.test(line)) return { type: 'subheading', text: line };
    return { type: 'paragraph', text: line };
  });
}

const OPTION_RE = /^[A-Da-d][).:]\s/;

function layoutContent(blocks, cfg, airy, dropped, firstRule) {
  const capacity = Math.floor((LAST_BASELINE_Y + cfg.lift - firstRule) / cfg.pitch) + 1;
  const rows = [];
  let row = 0;
  let numbered = 0;
  let prevWasHeading = true;

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const type = block.type;
    const isHeading = type === 'heading' || type === 'subheading';
    if (airy && type === 'heading' && bi > 0 && !prevWasHeading) row += 1;

    const isOption = type === 'bullet' && OPTION_RE.test(block.text);
    const size = type === 'heading' ? cfg.head : type === 'subheading' ? cfg.sub : cfg.body;
    const x = type === 'bullet' ? (isOption ? 122 : 128)
      : type === 'numbered' ? 114
      : type === 'definition' ? 96
      : type === 'formula' ? 96
      : LEFT;
    const maxWidth = CONTENT_RIGHT - x - (type === 'formula' ? 30 : 0);
    const lines = wrapWords(textToWords(block.text, dropped), maxWidth, size);
    if (!lines.length) continue;
    const label = type === 'numbered' ? `${++numbered}.` : '';
    const startRow = row;

    lines.forEach((words, index) => {
      rows.push({ type, words, row, size, x, isOption, label: index === 0 ? label : '', first: index === 0, last: index === lines.length - 1, blockStart: startRow, blockLines: lines.length });
      row += 1;
    });
    prevWasHeading = isHeading;
  }

  if (row > capacity) return null;
  return rows;
}

/* ----------------------------------------------------------------- paper */

function paperMarkup(palette, pitch) {
  const rules = [];
  for (let y = GRID_TOP; y <= HEIGHT; y += pitch) {
    rules.push(`<line x1="0" y1="${y}" x2="${WIDTH}" y2="${y}" stroke="${palette.line}" stroke-width="1.8" opacity=".85"/>`);
  }
  return `
    <defs>
      <radialGradient id="vignette" cx="50%" cy="48%" r="78%">
        <stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="100%" stop-color="#8fa6bd" stop-opacity=".16"/>
      </radialGradient>
      <filter id="grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.5  0 0 0 0 0.6  0 0 0 0.06 0"/>
      </filter>
      <filter id="marker" x="-5%" y="-30%" width="110%" height="160%">
        <feGaussianBlur stdDeviation="1.4"/>
      </filter>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.paper}"/>
    <rect width="${WIDTH}" height="${HEIGHT}" filter="url(#grain)"/>
    ${rules.join('')}
    <line x1="46" y1="0" x2="46" y2="${HEIGHT}" stroke="${palette.margin}" stroke-width="2.4" opacity=".9"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>`;
}

// A hand-dragged highlighter swipe: soft, slightly uneven ends rather than a perfect box.
function markerPath(x, y, w, h, seed) {
  const j = (n) => (hash(seed * 7 + n) - 0.5) * 6;
  const r = h * 0.4;
  return `M ${r2(x + r + j(1))} ${r2(y + j(2))} L ${r2(x + w - r + j(3))} ${r2(y + j(4))} Q ${r2(x + w + 6)} ${r2(y + h / 2)} ${r2(x + w - r + j(5))} ${r2(y + h + j(6))} L ${r2(x + r + j(7))} ${r2(y + h + j(8))} Q ${r2(x - 6)} ${r2(y + h / 2)} ${r2(x + r + j(1))} ${r2(y + j(2))} Z`;
}

function underline(x, y, w, color, seed, width = 2.2) {
  const j = (n) => (hash(seed * 11 + n) - 0.5) * 2.4;
  return `<path d="M ${r2(x)} ${r2(y + j(1))} Q ${r2(x + w / 2)} ${r2(y + 1.5 + j(2))} ${r2(x + w)} ${r2(y + j(3))}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/* ------------------------------------------------------------- page build */

function buildPage({ blocks, header, dropped }) {
  const attempts = [
    ['xl', true], ['xl', false], ['large', true], ['large', false],
    ['normal', true], ['normal', false], ['compact', true], ['compact', false],
  ];

  for (const [mode, airy] of attempts) {
    const cfg = LAYOUTS[mode];
    const titleWords = textToWords(header, dropped);
    let titleSize = cfg.title;
    let titleLines = wrapWords(titleWords, 1000, titleSize);
    while (titleLines.length > 2 && titleSize > 32) {
      titleSize -= 4;
      titleLines = wrapWords(titleWords, 1000, titleSize);
    }
    // Header rows on the grid: 0 brand, 1 subject line, then the title line(s); body follows.
    const titleRule = GRID_TOP + 2 * cfg.pitch;
    const firstRule = titleRule + titleLines.length * cfg.pitch;
    const rows = layoutContent(blocks, cfg, airy, dropped, firstRule);
    if (rows) return { cfg, rows, titleLines, titleSize, titleRule, firstRule };
  }
  return null;
}

export function buildNotebookSvg({
  title,
  content,
  sections,
  subject,
  topic,
  template = 'classic',
  category,
  exam = 'JAMB',
}) {
  const palette = templatePalette(template);
  const blocks = normalizeBlocks(sections, content);
  if (!blocks.length) throw new Error('Notebook content is empty; nothing to render.');

  const dropped = new Set();
  const header = cleanText(title || topic || category || 'Learning Notes');
  const categoryTitle = cleanText(category || 'Lesson Notes').replace(/_/g, ' ');

  const page = buildPage({ blocks, header, dropped });
  if (!page) {
    throw new Error('Notebook content is too long to fit safely on one page. Shorten the generated content; no text was truncated.');
  }
  if (dropped.size) console.warn(`[notebook-studio] characters not available in the handwriting font were left out: ${[...dropped].join(' ')}`);

  const { cfg, rows, titleLines, titleSize, titleRule, firstRule } = page;
  const deco = [];
  const text = [];
  const markerFill = (path) => `<path d="${path}" fill="${palette.marker}" opacity=".72" filter="url(#marker)"/>`;

  // ---- header: brand, subject line, highlighted title (all on ruled lines)
  const brandWords = textToWords('Shiney Brain Academy', new Set());
  const brandSize = 58;
  const brandW = lineWidth(brandWords, brandSize);
  const brandX = (WIDTH + 46 - brandW) / 2;
  const brandBase = GRID_TOP - cfg.lift;
  text.push(drawLine(brandWords, brandX, brandBase, brandSize, HEADING_INK, HEAD_PLUGINS, 11));
  deco.push(underline(brandX - 10, brandBase + 11, brandW + 20, HEADING_INK, 1, 2.6));
  deco.push(underline(brandX + 20, brandBase + 17, brandW - 30, HEADING_INK, 2, 2));

  const metaWords = textToWords(`Subject: ${cleanText(subject || 'General')}  |  Exam: ${cleanText(exam)}  |  ${categoryTitle}`, dropped);
  const metaSize = cfg.body - 2;
  const metaW = lineWidth(metaWords, metaSize);
  text.push(drawLine(metaWords, Math.max(LEFT, (WIDTH + 46 - metaW) / 2), GRID_TOP + cfg.pitch - cfg.lift, metaSize, INK, BODY_PLUGINS, 12));

  titleLines.forEach((words, index) => {
    const baseline = titleRule + index * cfg.pitch - cfg.lift;
    const w = lineWidth(words, titleSize);
    deco.push(markerFill(markerPath(LEFT - 16, baseline - titleSize * 0.88, w + 36, titleSize * 1.22, 20 + index)));
    text.push(drawLine(words, LEFT, baseline, titleSize, HEADING_INK, HEAD_PLUGINS, 30 + index));
  });

  // ---- body
  const blockRows = new Map();
  rows.forEach((item) => {
    if (!blockRows.has(item.blockStart)) blockRows.set(item.blockStart, []);
    blockRows.get(item.blockStart).push(item);
  });

  rows.forEach((item, index) => {
    const baseline = firstRule + item.row * cfg.pitch - cfg.lift + (hash(index * 3 + 1) - 0.5) * 2;
    const { type, size, words } = item;
    const w = lineWidth(words, size);
    const blockLines = blockRows.get(item.blockStart);
    let x = item.x;
    let color = INK;
    let plugins = BODY_PLUGINS;

    if (type === 'heading') {
      color = HEADING_INK;
      plugins = HEAD_PLUGINS;
      deco.push(markerFill(markerPath(x - 16, baseline - size * 0.88, w + 36, size * 1.22, 60 + index)));
    } else if (type === 'subheading') {
      color = HEADING_INK;
      plugins = HEAD_PLUGINS;
      if (item.last) deco.push(underline(x - 2, baseline + 8, w + 4, HEADING_INK, 90 + index));
    } else if (type === 'numbered') {
      // short labels such as "Definition:" are underlined, as teachers do on the board
      if (item.last && item.first && /:\s*$/.test(blockText(item))) deco.push(underline(x - 2, baseline + 8, w + 4, HEADING_INK, 120 + index, 2));
    } else if (type === 'formula') {
      color = HEADING_INK;
      if (item.first) {
        const top = baseline - size * 0.95;
        const height = blockLines.length * cfg.pitch - 6;
        deco.push(`<rect x="84" y="${r2(top)}" width="${CONTENT_RIGHT - 84 + 6}" height="${r2(height)}" rx="14" fill="${palette.secondary}" opacity=".9" stroke="${palette.margin}" stroke-width="2"/>`);
      }
      x = Math.max(100, (84 + CONTENT_RIGHT + 6 - w) / 2);
    } else if (type === 'example') {
      if (item.first) deco.push(`<rect x="84" y="${r2(baseline - size * 0.9)}" width="${CONTENT_RIGHT - 84 + 6}" height="${blockLines.length * cfg.pitch - 6}" rx="12" fill="${palette.secondary}" opacity=".95"/>`);
      x = 96;
    } else if (type === 'definition') {
      if (item.first) deco.push(`<rect x="76" y="${r2(baseline - size * 0.85)}" width="7" height="${blockLines.length * cfg.pitch - 10}" rx="3.5" fill="${palette.margin}"/>`);
    } else if (type === 'answer') {
      color = ANSWER_INK;
    } else if (type === 'note') {
      color = NOTE_INK;
      x = 96;
      if (item.first) deco.push(`<rect x="76" y="${r2(baseline - size * 0.85)}" width="5" height="${blockLines.length * cfg.pitch - 10}" rx="2.5" fill="${NOTE_INK}" opacity=".55"/>`);
    }

    if (item.first && type === 'bullet' && !item.isOption) {
      deco.push(`<circle cx="100" cy="${r2(baseline - size * 0.28)}" r="5.6" fill="${INK}"/>`);
    }
    if (item.label) {
      text.push(drawLine([[{ text: item.label, mode: 'n' }]], LEFT, baseline, size, HEADING_INK, HEAD_PLUGINS, 200 + index));
    }

    text.push(drawLine(words, x, baseline, size, color, plugins, 300 + index));
  });

  // ---- footer: rule, then brand line with dot separators
  const footerSize = 38;
  const footerParts = ['Shiney Brain Academy - Teaching', 'Learning', 'Excellence.'].map((part) => textToWords(part, dropped));
  const dotGap = 34;
  const partWidths = footerParts.map((words) => lineWidth(words, footerSize));
  const footerW = partWidths.reduce((a, b) => a + b, 0) + dotGap * (footerParts.length - 1);
  let fx = (WIDTH + 46 - footerW) / 2;
  const footerBase = 1568;
  const footer = [];
  footerParts.forEach((words, i) => {
    footer.push(drawLine(words, fx, footerBase, footerSize, HEADING_INK, HEAD_PLUGINS, 900 + i));
    fx += partWidths[i];
    if (i < footerParts.length - 1) {
      footer.push(`<circle cx="${r2(fx + dotGap / 2)}" cy="${footerBase - footerSize * 0.3}" r="5" fill="${HEADING_INK}"/>`);
      fx += dotGap;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${paperMarkup(palette, cfg.pitch)}
    ${deco.join('')}
    ${text.join('')}
    <path d="M 70 ${FOOTER_RULE_Y} Q 600 ${FOOTER_RULE_Y + 3} 1130 ${FOOTER_RULE_Y - 1}" fill="none" stroke="${HEADING_INK}" stroke-width="2.6" stroke-linecap="round"/>
    ${footer.join('')}
  </svg>`;
}

function blockText(item) {
  return item.words.map((word) => word.map((run) => (run.arrow ? '' : run.text)).join('')).join(' ');
}

export async function renderNotebookImage(options) {
  const svg = buildNotebookSvg(options);
  // The paper grain is incompressible noise (~1.3 MB as truecolour PNG); a 256-colour
  // palette keeps it visually identical at roughly a third of the size.
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: true, quality: 90, effort: 6, colours: 256 }).toBuffer();
}
