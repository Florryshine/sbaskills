import sharp from 'sharp';
import { textToSvg } from 'tegaki/core';
import caveat from 'tegaki/fonts/caveat';
import { variationPlugin } from 'tegaki/core';

const WIDTH = 1200;
const HEIGHT = 1600;
const INK = '#173f68';
const BLUE = '#b9def4';
const FONT_PLUGINS = [variationPlugin({ amount: 0.55 })];

function escapeXml(value = '') {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[char]));
}

function wrapText(value, max = 56) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function cleanMarkdown(value) {
  return String(value || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^•\s*/gm, '• ')
    .replace(/^[-*]\s+/gm, '• ')
    .replace(/^\d+[.)]\s+/gm, (match) => match)
    .replace(/\|/g, ' • ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function handwritten(text, x, y, size = 30, color = INK, maxWidth = 1040) {
  if (!text) return '';
  const svg = textToSvg(text, caveat, {
    mode: 'static',
    size,
    color,
    plugins: FONT_PLUGINS,
  });
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] || `0 0 ${Math.max(200, text.length * size * 0.55)} ${size * 1.6}`;
  const inner = svg
    .replace(/^\s*<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
  const width = Math.min(maxWidth, Math.max(80, vbWidth || maxWidth));
  const height = Math.max(size * 1.35, vbHeight || size * 1.5);
  return `<svg x="${x}" y="${y - size}" width="${width}" height="${height}" viewBox="${viewBox}" overflow="visible">${inner}</svg>`;
}

function templatePalette(template) {
  if (template === 'premium') return { paper: '#fbfdff', line: '#d7e9f5', accent: '#d9effb', margin: '#9fc7e1' };
  if (template === 'revision') return { paper: '#fffefb', line: '#d9e5ee', accent: '#c8e7f7', margin: '#aac8dc' };
  return { paper: '#fffefa', line: '#d8e8f4', accent: '#c6e7fa', margin: '#b2d2e6' };
}

export async function renderNotebookImage({ title, content, subject, topic, template = 'classic', category, exam = 'JAMB' }) {
  const palette = templatePalette(template);
  const normalized = cleanMarkdown(content);
  const contentLines = normalized.split('\n').flatMap((line) => wrapText(line, 58));
  const visibleLines = contentLines.slice(0, 21);
  const rowGap = 53;
  const contentStart = 390;
  const header = title || topic || category || 'Learning Notes';

  const paperLines = Array.from({ length: 23 }, (_, index) => {
    const y = 365 + index * rowGap;
    return `<line x1="72" y1="${y}" x2="1128" y2="${y}" stroke="${palette.line}" stroke-width="2"/>`;
  }).join('');

  const textMarkup = visibleLines.map((line, index) => {
    const y = contentStart + index * rowGap;
    const size = line.length > 54 ? 25 : 29;
    return handwritten(line, 118, y, size, INK, 1010);
  }).join('');

  const categoryLabel = String(category || 'Lesson Notes').replace(/_/g, ' ').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="1200" height="1600" fill="${palette.paper}"/>
    <rect x="0" y="0" width="1200" height="1600" fill="#ffffff" opacity=".16"/>
    ${paperLines}
    <line x1="94" y1="245" x2="94" y2="1515" stroke="${palette.margin}" stroke-width="3"/>
    <rect x="260" y="42" width="680" height="66" rx="16" fill="${palette.accent}" opacity=".9"/>
    ${handwritten('Shiney Brain Academy', 335, 95, 48, '#124e80', 650)}
    <line x1="330" y1="116" x2="870" y2="116" stroke="#124e80" stroke-width="2.5"/>
    ${handwritten(`Subject: ${subject || 'General'}  |  Class: JAMB  |  Exam: ${exam}`, 105, 185, 27, INK, 1000)}
    <rect x="100" y="245" width="1000" height="78" rx="18" fill="${palette.accent}"/>
    ${handwritten(categoryLabel, 145, 300, 39, '#124e80', 900)}
    ${handwritten(header, 110, 355, 33, INK, 1000)}
    ${textMarkup}
    <rect x="70" y="1515" width="1060" height="2" fill="${palette.line}"/>
    ${handwritten('Shiney Brain Academy - Teaching • Learning • Excellence', 175, 1565, 29, '#124e80', 950)}
    <text x="1090" y="1564" font-family="Arial,sans-serif" font-size="15" fill="#7a9ab2" text-anchor="end">SBA</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
