// lib/visual-intelligence/procedural.js
//
// TIER D — procedural library. Deterministic SVG generators used when no
// suitable asset can be found or adapted (decision: "create"). All outputs
// are SBA Original (CC0), offline, and reproducible from (template + seed).
//
// Honesty rule: generators never fake scientific detail. A "mitochondrion"
// request that falls back to procedural gets a labelled concept card / branded
// backdrop — clearly a designed asset, never a fake anatomical drawing.

import { createHash } from 'node:crypto';

export const PROCEDURAL_TEMPLATES = [
  { id: 'concept-card', label: 'Concept card (title + keywords, brand palette)', kinds: ['svg', 'illustration'] },
  { id: 'gradient-backdrop', label: 'Gradient backdrop (scene background)', kinds: ['svg', 'background'] },
  { id: 'labeled-diagram-card', label: 'Labelled diagram card (ring + callouts, neutral shapes)', kinds: ['svg', 'diagram'] },
  { id: 'icon-badge', label: 'Icon badge (subject initial in a designed frame)', kinds: ['svg', 'icon'] },
  { id: 'particle-texture', label: 'Particle texture (decorative science texture)', kinds: ['svg', 'texture'] },
];

const PALETTES = [
  { bg1: '#0f2f4e', bg2: '#123f66', accent: '#38bdf8', ink: '#e0f2fe' },
  { bg1: '#1e1b4b', bg2: '#312e81', accent: '#a78bfa', ink: '#ede9fe' },
  { bg1: '#052e2b', bg2: '#064e3b', accent: '#34d399', ink: '#d1fae5' },
  { bg1: '#3b0764', bg2: '#701a75', accent: '#e879f9', ink: '#fae8ff' },
  { bg1: '#431407', bg2: '#7c2d12', accent: '#fb923c', ink: '#ffedd5' },
  { bg1: '#0c4a6e', bg2: '#155e75', accent: '#22d3ee', ink: '#cffafe' },
];

function seededHash(input) {
  return createHash('sha256').update(String(input)).digest();
}

function esc(text) {
  return String(text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function pickPalette(seed) {
  return PALETTES[seed[0] % PALETTES.length];
}

function svgWrap(width, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}

function wrapText(text, maxChars, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
      if (lines.length === maxLines - 1) break;
    } else line = (line + ' ' + word).trim();
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:]?$/, '…');
  }
  return lines.slice(0, maxLines);
}

/** Concept card: subject title, keyword chips, brand gradient. */
function conceptCard({ subject, keywords, width, height, seed }) {
  const p = pickPalette(seed);
  const titleLines = wrapText(subject, 22, 3);
  const titleSize = width / 10;
  const chips = (keywords || []).slice(0, 4);
  const chipY = height * 0.62;
  const bodies = [];
  titleLines.forEach((line, i) => {
    bodies.push(`<text x="${width / 2}" y="${height * 0.34 + i * titleSize * 1.12}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="${titleSize}" font-weight="bold" fill="${p.ink}" text-anchor="middle">${esc(line)}</text>`);
  });
  const chipWidth = Math.min(width * 0.28, 60 + esc(chips[0] || '').length * 14);
  chips.forEach((chip, i) => {
    const cx = width / 2 + (i - (chips.length - 1) / 2) * (chipWidth + 16);
    bodies.push(`<rect x="${cx - chipWidth / 2}" y="${chipY}" width="${chipWidth}" height="52" rx="26" fill="${p.accent}" opacity="0.25"/><text x="${cx}" y="${chipY + 34}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="24" fill="${p.accent}" text-anchor="middle">${esc(String(chip).slice(0, 14))}</text>`);
  });
  bodies.push(`<circle cx="${width * 0.12}" cy="${height * 0.82}" r="${height * 0.10}" fill="${p.accent}" opacity="0.35"/><circle cx="${width * 0.88}" cy="${height * 0.18}" r="${height * 0.07}" fill="${p.accent}" opacity="0.25"/>`);
  bodies.push(`<text x="${width / 2}" y="${height - 34}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="20" fill="${p.ink}" opacity="0.7" text-anchor="middle">Shiney Brain Academy</text>`);
  const body = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>${bodies.join('')}`;
  return { svg: svgWrap(width, height, body), palette: p };
}

/** Gradient backdrop: abstract gradient + soft blobs, no text. */
function gradientBackdrop({ width, height, seed }) {
  const p = pickPalette(seed);
  const rnd = (i, m) => ((seed[i % seed.length] / 255) * m) | 0;
  const blobs = Array.from({ length: 5 }, (_, i) => {
    const cx = rnd(i * 3 + 1, width);
    const cy = rnd(i * 3 + 2, height);
    const r = height * (0.10 + (rnd(i * 3 + 3, 18) / 100));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.accent}" opacity="${0.08 + (i % 3) * 0.05}"/>`;
  }).join('');
  const body = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bg1}"/><stop offset="1" stop-color="${p.bg2}"/></linearGradient><radialGradient id="r" cx="0.5" cy="0.4" r="0.9"><stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/><rect width="${width}" height="${height}" fill="url(#r)"/>${blobs}`;
  return { svg: svgWrap(width, height, body), palette: p };
}

/** Labelled diagram card: neutral ring + callouts, explicitly non-anatomical. */
function labeledDiagramCard({ subject, keywords, width, height, seed }) {
  const p = pickPalette(seed);
  const cx = width * 0.34, cy = height * 0.5;
  const ringR = Math.min(width, height) * 0.22;
  const callouts = (keywords && keywords.length ? keywords : [subject]).slice(0, 3);
  const nodes = callouts.map((label, i) => {
    const angle = (-Math.PI / 3) + (i * Math.PI) / (callouts.length - 0.5);
    const nx = cx + Math.cos(angle) * ringR * 1.9;
    const ny = cy + Math.sin(angle) * ringR * 1.55;
    return `<line x1="${cx + Math.cos(angle) * ringR}" y1="${cy + Math.sin(angle) * ringR}" x2="${nx}" y2="${ny}" stroke="${p.accent}" stroke-width="3" opacity="0.6"/><circle cx="${nx}" cy="${ny}" r="10" fill="${p.accent}"/><text x="${nx + (Math.cos(angle) >= 0 ? 18 : -18)}" y="${ny - 14}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="${width * 0.022}" fill="${p.ink}" text-anchor="${Math.cos(angle) >= 0 ? 'start' : 'end'}">${esc(String(label).slice(0, 26))}</text>`;
  }).join('');
  const body = `<rect width="${width}" height="${height}" fill="${p.bg1}"/><circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${p.accent}" stroke-width="6" opacity="0.85"/><circle cx="${cx}" cy="${cy}" r="${ringR * 0.55}" fill="${p.accent}" opacity="0.18"/><circle cx="${cx}" cy="${cy}" r="${ringR * 0.16}" fill="${p.accent}"/>${nodes}<text x="${width * 0.72}" y="${height * 0.16}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="${width * 0.035}" font-weight="bold" fill="${p.ink}" text-anchor="middle">${esc(String(subject).slice(0, 30))}</text><text x="${width * 0.72}" y="${height * 0.22}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="${width * 0.02}" fill="${p.ink}" opacity="0.75" text-anchor="middle">Concept diagram — designed placeholder</text>`;
  return { svg: svgWrap(width, height, body), palette: p };
}

/** Icon badge: subject initial inside a designed frame. */
function iconBadge({ subject, width, height, seed }) {
  const p = pickPalette(seed);
  const letter = esc(String(subject || 'A').trim().charAt(0).toUpperCase() || 'A');
  const cx = width / 2, cy = height / 2, r = Math.min(width, height) * 0.36;
  const body = `<rect width="${width}" height="${height}" fill="none"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${p.bg2}" stroke="${p.accent}" stroke-width="${Math.max(4, r * 0.05)}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.82}" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.4" stroke-dasharray="${r * 0.12} ${r * 0.08}"/><text x="${cx}" y="${cy + r * 0.30}" font-family="Verdana, DejaVu Sans, sans-serif" font-size="${r}" font-weight="bold" fill="${p.ink}" text-anchor="middle">${letter}</text>`;
  return { svg: svgWrap(width, height, body), palette: p, transparent: true };
}

/** Particle texture: scattered dots/plus-marks for decorative overlays. */
function particleTexture({ width, height, seed }) {
  const p = pickPalette(seed);
  const rnd = (i, m) => ((seed[(i * 7 + 3) % seed.length] / 255) * m) | 0;
  const items = Array.from({ length: 60 }, (_, i) => {
    const x = rnd(i, width), y = rnd(i + 100, height);
    const s = 2 + (rnd(i + 200, 6));
    const shape = i % 4 === 0
      ? `<rect x="${x - s}" y="${y - s}" width="${s * 2}" height="${s * 2}" fill="${p.accent}" opacity="0.5" transform="rotate(45 ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="${s}" fill="${p.accent}" opacity="${0.2 + (rnd(i + 300, 4) / 10)}"/>`;
    return shape;
  }).join('');
  const body = `<rect width="${width}" height="${height}" fill="${p.bg1}"/>${items}`;
  return { svg: svgWrap(width, height, body), palette: p };
}

const GENERATORS = {
  'concept-card': conceptCard,
  'gradient-backdrop': gradientBackdrop,
  'labeled-diagram-card': labeledDiagramCard,
  'icon-badge': iconBadge,
  'particle-texture': particleTexture,
};

/**
 * Generate a deterministic procedural SVG.
 * Returns { ok, templateId, svg, width, height, seed, sha256 } or { ok:false }.
 */
export function generateProcedural(request) {
  const width = Math.min(Math.max(Number(request.width) || 1280, 320), 1920);
  const height = Math.min(Math.max(Number(request.height) || 720, 240), 1920);
  const seed = seededHash(`${request.templateId || 'auto'}|${request.subject}|${(request.keywords || []).join(',')}|${width}x${height}`);
  let templateId = request.templateId;
  if (!templateId || !GENERATORS[templateId]) {
    // Auto-pick by requested kind.
    const kind = request.kind || 'svg';
    templateId = kind === 'background' || kind === 'texture'
      ? 'gradient-backdrop'
      : kind === 'icon' ? 'icon-badge'
      : kind === 'diagram' ? 'labeled-diagram-card'
      : 'concept-card';
  }
  const gen = GENERATORS[templateId];
  if (!gen) return { ok: false, error: `Unknown procedural template: ${templateId}` };
  const out = gen({ subject: request.subject || 'SBA Visual', keywords: request.keywords || [], width, height, seed });
  const svg = out.svg;
  return {
    ok: true,
    templateId,
    templateLabel: (PROCEDURAL_TEMPLATES.find((t) => t.id === templateId) || {}).label || templateId,
    svg, width, height,
    seedHex: seed.toString('hex').slice(0, 16),
    sha256: createHash('sha256').update(Buffer.from(svg, 'utf8')).digest('hex'),
    license: 'SBA Original (CC0)',
    creator: 'SBA Procedural Library',
  };
}

export function listProceduralTemplates() {
  return PROCEDURAL_TEMPLATES;
}
