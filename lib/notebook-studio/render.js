import sharp from 'sharp';
import { textToSvg, variationPlugin } from 'tegaki/core';
import caveat from 'tegaki/fonts/caveat';
import nanumPenScript from 'tegaki/fonts/nanum-pen-script';

const WIDTH = 1200;
const HEIGHT = 1600;
const INK = '#173f68';
const HEADING_INK = '#124e80';
const BODY_PLUGINS = [variationPlugin({ amount: 0.16 })];
const BRAND_PLUGINS = [variationPlugin({ amount: 0.22 })];
const WIDTH_CACHE = new Map();

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSvgMetrics(svg, text, size) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const values = viewBox?.split(/\s+/).map(Number);
  return {
    width: values?.[2] || Math.max(40, text.length * size * 0.55),
    height: values?.[3] || size * 1.45,
    viewBox: viewBox || `0 0 ${Math.max(40, text.length * size * 0.55)} ${size * 1.45}`,
    inner: svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''),
  };
}

function makeTextSvg(text, size, color, font = nanumPenScript, plugins = BODY_PLUGINS) {
  const safeText = cleanText(text);
  if (!safeText) return null;
  const svg = textToSvg(safeText, font, { mode: 'static', size, color, plugins });
  return getSvgMetrics(svg, safeText, size);
}

function measureText(text, size, font = nanumPenScript, fontKey = 'body') {
  const key = `${fontKey}:${size}:${text}`;
  if (WIDTH_CACHE.has(key)) return WIDTH_CACHE.get(key);
  const metrics = makeTextSvg(text, size, INK, font);
  const width = metrics?.width || 0;
  WIDTH_CACHE.set(key, width);
  return width;
}

function wrapToWidth(value, maxWidth, size, font = nanumPenScript, fontKey = 'body') {
  const words = cleanText(value).split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureText(candidate, size, font, fontKey) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textMarkup(text, x, baseline, size, color, font = atma, plugins = BODY_PLUGINS, maxWidth = 960) {
  const metrics = makeTextSvg(text, size, color, font, plugins);
  if (!metrics) return '';
  const width = Math.min(maxWidth, Math.max(1, metrics.width));
  const height = Math.max(size * 1.2, metrics.height);
  return `<svg x="${x}" y="${baseline - size}" width="${width}" height="${height}" viewBox="${metrics.viewBox}" overflow="visible">${metrics.inner}</svg>`;
}

function templatePalette(template) {
  if (template === 'premium') return {
    paper: '#fbfdff', line: '#d7e9f5', accent: '#d9effb', margin: '#9fc7e1',
    highlight: '#d9effb', secondary: '#eef7fc',
  };
  if (template === 'revision') return {
    paper: '#fffefb', line: '#d9e5ee', accent: '#c8e7f7', margin: '#aac8dc',
    highlight: '#c8e7f7', secondary: '#f1f8fc',
  };
  return {
    paper: '#fffefa', line: '#d8e8f4', accent: '#c6e7fa', margin: '#b2d2e6',
    highlight: '#c6e7fa', secondary: '#f3f9fd',
  };
}

function normalizeBlocks(sections, content) {
  const allowed = new Set(['heading', 'subheading', 'paragraph', 'bullet', 'numbered', 'definition', 'example', 'formula', 'question', 'answer', 'note']);
  if (Array.isArray(sections) && sections.length) {
    return sections.slice(0, 18).map((section) => ({
      type: allowed.has(section?.type) ? section.type : 'paragraph',
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

function layoutContent(blocks, palette, startY, maxY, compact = false) {
  const markup = [];
  let y = startY;
  const bodySize = compact ? 24 : 27;
  const lineHeight = compact ? 34 : 38;
  const contentX = 126;
  let numberedCount = 0;
  const maxWidth = 940;

  for (const block of blocks) {
    const type = block.type;
    const isHeading = type === 'heading' || type === 'subheading';
    const size = type === 'heading' ? (compact ? 29 : 32)
      : type === 'subheading' ? (compact ? 27 : 29)
      : type === 'formula' ? (compact ? 25 : 28)
      : bodySize;
    const font = isHeading ? caveat : nanumPenScript;
    const fontKey = isHeading ? 'heading' : 'body';
    const lines = wrapToWidth(block.text, maxWidth - (type === 'bullet' || type === 'numbered' ? 34 : 0), size, font, fontKey);
    const numberLabel = type === 'numbered' ? String(++numberedCount) : '';
    const blockTop = y;

    if (type === 'heading' || type === 'subheading') {
      y += type === 'heading' ? 44 : 38;
    } else {
      y += 8;
    }

    for (let index = 0; index < lines.length; index++) {
      const baseline = y + size;
      const line = lines[index];
      if (type === 'heading' && index === 0) {
        const textWidth = Math.min(900, measureText(line, size, caveat, 'heading'));
        markup.push(`<rect x="112" y="${baseline - size - 5}" width="${Math.max(250, textWidth + 32)}" height="${size + 17}" rx="10" fill="${palette.highlight}"/>`);
      } else if (type === 'formula' && index === 0) {
        markup.push(`<rect x="112" y="${baseline - size - 8}" width="970" height="${size + 22}" rx="10" fill="${palette.secondary}" stroke="${palette.line}" stroke-width="1.5"/>`);
      } else if (type === 'example' && index === 0) {
        markup.push(`<rect x="112" y="${baseline - size - 7}" width="970" height="${size + 20}" rx="9" fill="${palette.secondary}"/>`);
      }

      if (type === 'bullet') {
        markup.push(`<circle cx="128" cy="${baseline - size * 0.35}" r="5" fill="${INK}"/>`);
      } else if (type === 'numbered') {
        markup.push(`<circle cx="128" cy="${baseline - size * 0.35}" r="12" fill="${palette.highlight}"/>`);
        markup.push(`<text x="128" y="${baseline - size * 0.35 + 5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${HEADING_INK}">${numberLabel}</text>`);
      } else if (type === 'definition' && index === 0) {
        markup.push(`<rect x="112" y="${baseline - size - 6}" width="7" height="${size + 16}" rx="3" fill="${palette.margin}"/>`);
      }

      const x = type === 'bullet' || type === 'numbered' ? 153 : type === 'definition' ? 135 : contentX;
      const color = type === 'answer' ? '#17634a' : type === 'question' ? '#123f69' : INK;
      markup.push(textMarkup(line, x, baseline, size, color, font, isHeading ? BRAND_PLUGINS : BODY_PLUGINS, maxWidth));
      y += lineHeight;
    }

    y += type === 'heading' ? 7 : type === 'subheading' ? 5 : 9;
    if (y > maxY) return { fits: false, height: y - startY, markup: '' };
    if (y <= blockTop) y = blockTop + lineHeight;
  }

  return { fits: true, height: y - startY, markup: markup.join('') };
}

export async function renderNotebookImage({
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
  const header = cleanText(title || topic || category || 'Learning Notes');
  const categoryLabel = cleanText(category || 'Lesson Notes').replace(/_/g, ' ').toUpperCase();
  const startY = 390;
  const maxY = 1450;

  let layout = layoutContent(blocks, palette, startY, maxY, false);
  if (!layout.fits) layout = layoutContent(blocks, palette, startY, maxY, true);
  if (!layout.fits) {
    throw new Error('Notebook content is too long to fit safely on one page. Shorten the generated content; no text was truncated.');
  }

  const paperLines = Array.from({ length: 28 }, (_, index) => {
    const y = 355 + index * 42;
    return `<line x1="72" y1="${y}" x2="1128" y2="${y}" stroke="${palette.line}" stroke-width="1.7"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${palette.paper}"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" opacity=".10"/>
    ${paperLines}
    <line x1="94" y1="230" x2="94" y2="1510" stroke="${palette.margin}" stroke-width="3"/>
    <rect x="260" y="34" width="680" height="66" rx="16" fill="${palette.accent}" opacity=".9"/>
    ${textMarkup('Shiney Brain Academy', 335, 88, 47, HEADING_INK, caveat, BRAND_PLUGINS, 650)}
    <line x1="330" y1="112" x2="870" y2="112" stroke="${HEADING_INK}" stroke-width="2.5"/>
    ${textMarkup(`Subject: ${subject || 'General'}  |  Class: JAMB  |  Exam: ${exam}`, 105, 185, 25, INK, nanumPenScript, BODY_PLUGINS, 1000)}
    <rect x="100" y="235" width="1000" height="76" rx="16" fill="${palette.accent}"/>
    ${textMarkup(categoryLabel, 145, 290, 34, HEADING_INK, caveat, BRAND_PLUGINS, 900)}
    ${textMarkup(header, 110, 355, 31, INK, nanumPenScript, BODY_PLUGINS, 1000)}
    ${layout.markup}
    <rect x="70" y="1510" width="1060" height="2" fill="${palette.line}"/>
    ${textMarkup('Shiney Brain Academy - Teaching • Learning • Excellence', 175, 1560, 25, HEADING_INK, nanumPenScript, BODY_PLUGINS, 950)}
    <text x="1090" y="1559" font-family="Arial,sans-serif" font-size="15" fill="#7a9ab2" text-anchor="end">SBA</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
