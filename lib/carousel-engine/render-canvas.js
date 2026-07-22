// lib/carousel-engine/render-canvas.js
//
// Renders carousel slides as branded PNG images using @napi-rs/canvas +
// sharp — the exact same rendering stack lib/image-engine.js already uses
// successfully for hero images on Vercel. Replaces the old Marp CLI /
// Puppeteer-based renderer (render.js), which spawns a headless Chromium
// browser — something Vercel's serverless functions cannot run (missing
// shared libraries, no room for the Chromium binary, sandboxing
// restrictions). That's why "Marp CLI exited with code 1" happened for
// every single carousel generated so far, including Instagram's, since
// before any of this session's changes.
//
// No external service, no local worker needed — this runs entirely inside
// the same Vercel function that already generates the draft.

import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

const W = 1080;
const H = 1080; // Instagram-square; also fine for Facebook/Telegram/LinkedIn/X feeds

const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';

let fontRegistered = false;
try {
  const fontPath = join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf');
  if (existsSync(fontPath)) {
    GlobalFonts.registerFromBuffer(readFileSync(fontPath), 'Inter');
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

function renderSlide({ headline, body, position, total, isFirst, isLast }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fontFamily = fontRegistered ? 'Inter' : 'sans-serif';

  // Hook slide: brand blue. CTA slide (last): brand yellow. Middle
  // (teaching) slides: clean white — keeps the "read this" content the
  // clearest, and gives the carousel visual rhythm as you swipe through.
  const bg = isLast ? BRAND_YELLOW : isFirst ? BRAND_BLUE : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const textColor = isFirst ? '#ffffff' : DARK;
  const pillBg = isFirst ? 'rgba(255,255,255,0.2)' : isLast ? 'rgba(0,0,0,0.1)' : '#EFF6FF';
  const pillText = isFirst ? '#ffffff' : isLast ? DARK : BRAND_BLUE;

  // Slide counter pill (top-left)
  ctx.fillStyle = pillBg;
  ctx.beginPath();
  ctx.roundRect(64, 64, 110, 44, 22);
  ctx.fill();
  ctx.fillStyle = pillText;
  ctx.font = `bold 20px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${position}/${total}`, 90, 86);

  // Headline
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

  // Body — supporting line, smaller and lighter weight
  y += 24;
  ctx.font = `400 38px ${fontFamily}`;
  ctx.fillStyle = isFirst ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)';
  const bodyLines = wrapText(ctx, body, W - 160).slice(0, 6);
  const bodyLineHeight = 50;
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += bodyLineHeight;
  }

  // Footer brand mark
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = isFirst ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.5)';
  ctx.fillText('Shiney Brain Academy', 80, H - 64);

  return canvas.toBuffer('image/png');
}

/**
 * Renders every slide for a carousel and returns an array of PNG Buffers,
 * in order. No filesystem temp files, no subprocess, no headless browser —
 * safe to call inline inside a Vercel serverless function.
 *
 * @param {Array<{position:number, headline:string, body:string}>} slides
 * @returns {Buffer[]}
 */
export function renderCarouselSlides(slides) {
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
    })
  );
}
