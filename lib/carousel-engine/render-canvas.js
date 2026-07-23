// lib/carousel-engine/render-canvas.js
//
// Renders carousel slides as branded PNG images using @napi-rs/canvas +
// sharp — the exact same rendering stack lib/image-engine.js already uses
// successfully for hero images on Vercel. Replaces the old Marp CLI /
// Puppeteer-based renderer (formerly render.js/generate.js, now deleted),
// which spawned a headless Chromium browser — something Vercel's
// serverless functions cannot run.
//
// No external service, no local worker needed — this runs entirely inside
// the same Vercel function that already generates the draft.
//
// PATCHED: was one fixed 1080x1080 "Instagram square" look reused for every
// platform. Now takes a `platform` key and renders a distinct visual style
// per platform (dimensions, palette, layout) — see PLATFORM_STYLES below.
// Slide content (headline/body) still comes from the generator; this file
// only controls how it's drawn.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';

// Per-platform visual identity. `size` sets canvas dimensions (each
// platform's native/expected feed aspect ratio); `palette` and `layout`
// control the look so a LinkedIn carousel doesn't look like a Facebook one.
const PLATFORM_STYLES = {
  instagram: {
    size: { w: 1080, h: 1080 }, // square feed post
    palette: { hook: BRAND_BLUE, cta: BRAND_YELLOW, body: '#ffffff', accent: BRAND_BLUE },
    layout: 'bold', // big headline, generous whitespace, aspirational
  },
  facebook: {
    size: { w: 1080, h: 1350 }, // taller 4:5, reads well in FB feed
    palette: { hook: '#0f172a', cta: BRAND_YELLOW, body: '#ffffff', accent: '#0f172a' },
    layout: 'bold', // same energetic hook-first feel as Instagram, punchier dark hook slide
  },
  linkedin: {
    size: { w: 1080, h: 1080 }, // LinkedIn carousels/documents read as square or portrait; square is safest
    palette: { hook: '#f8fafc', cta: '#f8fafc', body: '#f8fafc', accent: '#1e3a5f' },
    layout: 'editorial', // muted, data-card look — no bright brand yellow, feels like a report
  },
  telegram: {
    size: { w: 1080, h: 1080 },
    palette: { hook: '#ffffff', cta: '#ffffff', body: '#ffffff', accent: BRAND_BLUE },
    layout: 'plain', // near-zero branding, looks like a study note screenshot not an ad
  },
};

function getStyle(platform) {
  return PLATFORM_STYLES[platform] || PLATFORM_STYLES.instagram;
}

let fontRegistered = false;
try {
  const fontPath = join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf');
  if (existsSync(fontPath)) {
    GlobalFonts.register(readFileSync(fontPath), 'Inter');
    fontRegistered = true;
  }
} catch (err) {
  console.warn('⚠️ Carousel renderer: font registration failed:', err.message);
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * "bold" layout — used by Instagram and Facebook. Big headline, colored
 * hook/CTA slides, generous whitespace. The energetic, scroll-stopping look.
 */
function renderBoldSlide(ctx, { W, H, headline, body, position, total, isFirst, isLast, palette, fontFamily }) {
  const bg = isLast ? palette.cta : isFirst ? palette.hook : palette.body;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const onColor = isFirst || (isLast && palette.cta !== '#ffffff' && palette.cta !== BRAND_YELLOW)
    ? '#ffffff'
    : DARK;
  const textColor = isFirst ? '#ffffff' : DARK;
  const pillBg = isFirst ? 'rgba(255,255,255,0.2)' : isLast ? 'rgba(0,0,0,0.1)' : '#EFF6FF';
  const pillText = isFirst ? '#ffffff' : isLast ? DARK : palette.accent;

  ctx.fillStyle = pillBg;
  ctx.beginPath();
  ctx.roundRect(64, 64, 110, 44, 22);
  ctx.fill();
  ctx.fillStyle = pillText;
  ctx.font = `bold 20px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${position}/${total}`, 90, 86);

  ctx.fillStyle = textColor;
  ctx.font = `bold 68px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const headlineLines = wrapText(ctx, headline, W - 160).slice(0, 4);
  let y = 260;
  const headlineLineHeight = 80;
  for (const line of headlineLines) {
    ctx.fillText(line, 80, y);
    y += headlineLineHeight;
  }

  y += 24;
  ctx.font = `400 38px ${fontFamily}`;
  ctx.fillStyle = isFirst ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)';
  const bodyLines = wrapText(ctx, body, W - 160).slice(0, 6);
  const bodyLineHeight = 50;
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += bodyLineHeight;
  }

  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = isFirst ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.5)';
  ctx.fillText('Shiney Brain Academy', 80, H - 64);
}

/**
 * "editorial" layout — used by LinkedIn. Muted off-white background, a thin
 * top rule instead of a colored hero slide, smaller/denser type — reads like
 * a data card or report insight rather than a consumer social ad.
 */
function renderEditorialSlide(ctx, { W, H, headline, body, position, total, isFirst, isLast, palette, fontFamily }) {
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // Thin accent rule across the top — the only "color" on the slide.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(0, 0, W, 10);

  ctx.fillStyle = palette.accent;
  ctx.font = `bold 20px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${isFirst ? 'INSIGHT' : isLast ? 'DISCUSSION' : `${position} / ${total}`}`, 80, 100);

  ctx.fillStyle = DARK;
  ctx.font = `bold 56px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const headlineLines = wrapText(ctx, headline, W - 160).slice(0, 4);
  let y = 220;
  const headlineLineHeight = 68;
  for (const line of headlineLines) {
    ctx.fillText(line, 80, y);
    y += headlineLineHeight;
  }

  y += 20;
  ctx.font = `400 34px ${fontFamily}`;
  ctx.fillStyle = 'rgba(15,23,42,0.7)';
  const bodyLines = wrapText(ctx, body, W - 160).slice(0, 6);
  const bodyLineHeight = 46;
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += bodyLineHeight;
  }

  ctx.font = `600 22px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(15,23,42,0.5)';
  ctx.fillText('Shiney Brain Academy · Insights', 80, H - 64);
}

/**
 * "plain" layout — used by Telegram. White background throughout (even the
 * hook/CTA slides), minimal branding, looks like a study-note screenshot
 * rather than a marketing carousel — matches the "no fluff, no ads" channel
 * feel described in the Telegram generator prompt.
 */
function renderPlainSlide(ctx, { W, H, headline, body, position, total, fontFamily, palette }) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = palette.accent;
  ctx.font = `bold 22px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${position}/${total}`, 80, 90);

  ctx.fillStyle = DARK;
  ctx.font = `bold 60px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const headlineLines = wrapText(ctx, headline, W - 160).slice(0, 4);
  let y = 220;
  const headlineLineHeight = 72;
  for (const line of headlineLines) {
    ctx.fillText(line, 80, y);
    y += headlineLineHeight;
  }

  y += 20;
  ctx.font = `400 36px ${fontFamily}`;
  ctx.fillStyle = 'rgba(15,23,42,0.75)';
  const bodyLines = wrapText(ctx, body, W - 160).slice(0, 6);
  const bodyLineHeight = 48;
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += bodyLineHeight;
  }

  ctx.font = `500 20px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(15,23,42,0.4)';
  ctx.fillText('Shiney Brain Academy — Study Notes', 80, H - 56);
}

function renderSlide({ headline, body, position, total, isFirst, isLast, platform }) {
  const style = getStyle(platform);
  const { w: W, h: H } = style.size;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fontFamily = fontRegistered ? 'Inter' : 'sans-serif';

  const args = { ctx, W, H, headline, body, position, total, isFirst, isLast, palette: style.palette, fontFamily };

  if (style.layout === 'editorial') {
    renderEditorialSlide(ctx, args);
  } else if (style.layout === 'plain') {
    renderPlainSlide(ctx, args);
  } else {
    renderBoldSlide(ctx, args);
  }

  return canvas.toBuffer('image/png');
}

/**
 * Renders every slide for a carousel and returns an array of PNG Buffers,
 * in order. No filesystem temp files, no subprocess, no headless browser —
 * safe to call inline inside a Vercel serverless function.
 *
 * @param {Array<{position:number, headline:string, body:string}>} slides
 * @param {string} [platform] - one of PLATFORM_STYLES keys; defaults to instagram's look
 * @returns {Buffer[]}
 */
export function renderCarouselSlides(slides, platform = 'instagram') {
  if (!slides || slides.length === 0) {
    throw new Error('No slides provided to render');
  }
  const total = slides.length;
  return slides.map((slide, i) =>
    renderSlide({
      headline: slide.headline,
      body: slide.body,
      position: i + 1,
      total,
      isFirst: i === 0,
      isLast: i === slides.length - 1,
      platform,
    })
  );
}
