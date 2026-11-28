import sharp from 'sharp';
import { buildNotebookSvg } from '../notebook-studio/render.js';

export const TEGAKI_RENDER_STYLES = Object.freeze([
  { id: 'classic-notebook', label: 'Classic Notebook', template: 'classic', description: 'Familiar ruled exercise-book paper with blue-ink handwriting.' },
  { id: 'premium-notes', label: 'Premium Notes', template: 'premium', description: 'Clean white paper, spacious blue rules and refined highlights.' },
  { id: 'exam-revision', label: 'Exam Revision', template: 'revision', description: 'Compact, high-contrast revision notes for quick recall.' },
  { id: 'colourful-classroom', label: 'Colourful Classroom', template: 'classic', description: 'Warm classroom paper with colourful headings and gentle highlights.' },
  { id: 'dark-chalkboard', label: 'Dark Chalkboard', template: 'classic', description: 'Deep green board with bright chalk-style handwriting.' },
  { id: 'digital-study-pad', label: 'Digital Study Pad', template: 'premium', description: 'Cool digital-paper surface with a subtle dotted writing grid.' },
]);

const STYLE_BY_ID = new Map(TEGAKI_RENDER_STYLES.map((style) => [style.id, style]));

function applyStyle(svg, styleId) {
  if (styleId === 'colourful-classroom') {
    return svg
      .replaceAll('#fdfdff', '#fff9e9')
      .replaceAll('#6f9fdc', '#d8c6ed')
      .replaceAll('#86afe3', '#ee9b8c')
      .replaceAll('#7fcaf3', '#f4c95d')
      .replaceAll('#eef5fd', '#fff0d5')
      .replaceAll('#1b3596', '#68449a')
      .replaceAll('#b3262d', '#c45148')
      .replaceAll('#17634a', '#28785a');
  }

  if (styleId === 'dark-chalkboard') {
    return svg
      .replaceAll('#fdfdff', '#18372f')
      .replaceAll('#ffffff', '#18372f')
      .replaceAll('#8fa6bd', '#10251f')
      .replaceAll('#6f9fdc', '#527e70')
      .replaceAll('#86afe3', '#80a997')
      .replaceAll('#7fcaf3', '#e6c979')
      .replaceAll('#eef5fd', '#29483e')
      .replaceAll('#1b3596', '#f7f1dc')
      .replaceAll('#b3262d', '#ffad9d')
      .replaceAll('#17634a', '#b6e3b0')
      .replaceAll('opacity=".85"', 'opacity=".34"');
  }

  if (styleId === 'digital-study-pad') {
    return svg
      .replaceAll('#fcfdff', '#f4f7ff')
      .replaceAll('#fdfdff', '#f4f7ff')
      .replaceAll('#7ea8de', '#d1dcf1')
      .replaceAll('#6f9fdc', '#d1dcf1')
      .replaceAll('#8db5e6', '#9bb5e8')
      .replaceAll('#86afe3', '#9bb5e8')
      .replaceAll('#86cdf6', '#b8c9fa')
      .replaceAll('#7fcaf3', '#b8c9fa')
      .replaceAll('#eef6fd', '#e8eeff')
      .replaceAll('#eef5fd', '#e8eeff')
      .replaceAll('#1b3596', '#263f70')
      .replaceAll('stroke-width="1.8" opacity=".85"', 'stroke-width="1.3" opacity=".58" stroke-dasharray="2 8"');
  }

  return svg;
}

export async function renderTegakiStyleImage({ styleId = 'classic-notebook', ...content }) {
  const style = STYLE_BY_ID.get(styleId);
  if (!style) throw new Error('Choose one of the six supported Tegaki visual styles.');
  const svg = applyStyle(buildNotebookSvg({ ...content, template: style.template }), styleId);
  return sharp(Buffer.from(svg)).png({
    compressionLevel: 9,
    palette: true,
    quality: 90,
    effort: 6,
    colours: 256,
  }).toBuffer();
}
