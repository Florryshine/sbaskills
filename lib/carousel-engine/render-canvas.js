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

import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

const BRAND_BLUE = '#1a73e8';
const BRAND_YELLOW = '#FFCC00';
const DARK = '#0f172a';

// Curated backgrounds for the carousel background designer. Only applied to
// the "bold" layout's hook/CTA slides (Instagram, Facebook) — the two
// colored slides that actually carry the carousel's visual identity. Body
// slides stay white/light regardless, and the editorial (LinkedIn) and
// plain (Telegram) layouts are left alone on purpose: LinkedIn's muted
// data-card look and Telegram's no-fluff study-note look are the point of
// those layouts, not something meant to be skinned.
export const GRADIENT_PRESETS = {
  ocean: { angle: 135, stops: [[0, '#0f4c81'], [1, '#1a73e8']] },
  sunrise: { angle: 135, stops: [[0, '#ff6b6b'], [1, '#FFCC00']] },
  violet: { angle: 135, stops: [[0, '#4c1d95'], [1, '#7c3aed']] },
  forest: { angle: 135, stops: [[0, '#064e3b'], [1, '#10b981']] },
  midnight: { angle: 180, stops: [[0, '#0f172a'], [1, '#1e293b']] },
  candy: { angle: 135, stops: [[0, '#ec4899'], [1, '#8b5cf6']] },
};

export const PATTERN_PRESETS = {
  dots: { type: 'dots', spacing: 44, radius: 3 },
  grid: { type: 'grid', spacing: 60 },
  diagonal: { type: 'diagonal', spacing: 40 },
};

function gradientCoords(W, H, angleDeg) {
  const angle = (angleDeg * Math.PI) / 180;
  const cx = W / 2, cy = H / 2;
  const len = Math.abs(W * Math.cos(angle)) + Math.abs(H * Math.sin(angle));
  return [
    cx - (Math.cos(angle) * len) / 2,
    cy - (Math.sin(angle) * len) / 2,
    cx + (Math.cos(angle) * len) / 2,
    cy + (Math.sin(angle) * len) / 2,
  ];
}

function drawPattern(ctx, W, H, preset, color = 'rgba(255,255,255,0.16)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  const spacing = preset.spacing || 44;
  if (preset.type === 'dots') {
    for (let y = spacing / 2; y < H; y += spacing) {
      for (let x = spacing / 2; x < W; x += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, preset.radius || 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (preset.type === 'grid') {
    for (let x = 0; x <= W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  } else if (preset.type === 'diagonal') {
    for (let x = -H; x < W; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCoverImage(ctx, image, W, H) {
  const scale = Math.max(W / image.width, H / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const dx = (W - drawW) / 2;
  const dy = (H - drawH) / 2;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

/**
 * Fills a slide's background using either the layout's normal flat color
 * (`fallbackColor`, when no custom background is set) or the admin's chosen
 * background — solid color, curated gradient, curated pattern, or an
 * uploaded image (drawn cover-fit with a dark scrim so text stays legible).
 *
 * @param {{type:'solid'|'gradient'|'pattern'|'image', value?:string, image?:import('@napi-rs/canvas').Image}} [background]
 * @returns {boolean} whether a custom (non-fallback) background was drawn — callers use this to decide whether to force white text
 */
function fillSlideBackground(ctx, W, H, background, fallbackColor) {
  if (!background) {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, W, H);
    return false;
  }
  if (background.type === 'solid' && background.value) {
    ctx.fillStyle = background.value;
    ctx.fillRect(0, 0, W, H);
    return true;
  }
  if (background.type === 'gradient') {
    const preset = GRADIENT_PRESETS[background.value] || GRADIENT_PRESETS.ocean;
    const [x0, y0, x1, y1] = gradientCoords(W, H, preset.angle);
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    preset.stops.forEach(([offset, color]) => grad.addColorStop(offset, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    return true;
  }
  if (background.type === 'pattern') {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(0, 0, W, H);
    drawPattern(ctx, W, H, PATTERN_PRESETS[background.value] || PATTERN_PRESETS.dots);
    return false; // pattern draws on top of the normal fallback color, so keep normal text color logic
  }
  if (background.type === 'image' && background.image) {
    drawCoverImage(ctx, background.image, W, H);
    const scrim = ctx.createLinearGradient(0, 0, 0, H);
    scrim.addColorStop(0, 'rgba(15,23,42,0.35)');
    scrim.addColorStop(1, 'rgba(15,23,42,0.6)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, 0, W, H);
    return true;
  }
  ctx.fillStyle = fallbackColor;
  ctx.fillRect(0, 0, W, H);
  return false;
}

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
function renderBoldSlide(ctx, { W, H, headline, body, position, total, isFirst, isLast, palette, fontFamily, background }) {
  const bg = isLast ? palette.cta : isFirst ? palette.hook : palette.body;
  const isColoredSlide = isFirst || isLast;
  const customApplied = isColoredSlide ? fillSlideBackground(ctx, W, H, background, bg) : (ctx.fillStyle = bg, ctx.fillRect(0, 0, W, H), false);

  const forceWhite = isColoredSlide && customApplied;
  const onColor = forceWhite || isFirst || (isLast && palette.cta !== '#ffffff' && palette.cta !== BRAND_YELLOW)
    ? '#ffffff'
    : DARK;
  const textColor = forceWhite || isFirst ? '#ffffff' : DARK;
  const pillBg = forceWhite ? 'rgba(255,255,255,0.22)' : isFirst ? 'rgba(255,255,255,0.2)' : isLast ? 'rgba(0,0,0,0.1)' : '#EFF6FF';
  const pillText = forceWhite ? '#ffffff' : isFirst ? '#ffffff' : isLast ? DARK : palette.accent;

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
  ctx.fillStyle = forceWhite || isFirst ? 'rgba(255,255,255,0.9)' : 'rgba(15,23,42,0.75)';
  const bodyLines = wrapText(ctx, body, W - 160).slice(0, 6);
  const bodyLineHeight = 50;
  for (const line of bodyLines) {
    ctx.fillText(line, 80, y);
    y += bodyLineHeight;
  }

  ctx.font = `bold 24px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = forceWhite || isFirst ? 'rgba(255,255,255,0.7)' : 'rgba(15,23,42,0.5)';
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

function renderSlide({ headline, body, position, total, isFirst, isLast, platform, background }) {
  const style = getStyle(platform);
  const { w: W, h: H } = style.size;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const fontFamily = fontRegistered ? 'Inter' : 'sans-serif';

  // Only the "bold" layout (Instagram, Facebook) supports a custom
  // background — see the GRADIENT_PRESETS/PATTERN_PRESETS comment above for
  // why editorial (LinkedIn) and plain (Telegram) are left alone.
  const args = {
    ctx, W, H, headline, body, position, total, isFirst, isLast,
    palette: style.palette, fontFamily,
    background: style.layout === 'bold' ? background : undefined,
  };

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
 * @param {{type:'solid'|'gradient'|'pattern'|'image', value?:string, imageBuffer?:Buffer}} [background]
 *   Optional custom background for the hook/CTA slides (bold layout only —
 *   see renderSlide). `imageBuffer` is decoded here via loadImage, which is
 *   why this function is async even though most calls (no background, or a
 *   preset background) never actually await anything real.
 * @returns {Promise<Buffer[]>}
 */
export async function renderCarouselSlides(slides, platform = 'instagram', background) {
  if (!slides || slides.length === 0) {
    throw new Error('No slides provided to render');
  }

  let resolvedBackground = background;
  if (background?.type === 'image' && background.imageBuffer) {
    const image = await loadImage(background.imageBuffer);
    resolvedBackground = { type: 'image', image };
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
      background: resolvedBackground,
    })
  );
}
