import sharp from 'sharp';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

// ─── Font registration ──────────────────────────────────────────────────
let fontRegistered = false;
try {
  const fontPath = join(process.cwd(), 'public', 'fonts', 'Inter-Bold.ttf');
  if (existsSync(fontPath)) {
    const fontBuffer = readFileSync(fontPath);
    GlobalFonts.registerFromBuffer(fontBuffer, 'Inter');
    fontRegistered = true;
    console.log('✅ Inter Bold font registered successfully');
  } else {
    console.warn('⚠️ Inter-Bold.ttf not found at', fontPath, '– using system fallback');
  }
} catch (err) {
  console.warn('⚠️ Font registration failed:', err.message);
}

// ─── Presets ──────────────────────────────────────────────────────────────
export const IMAGE_PRESETS = {
  hero: { width: 1200, height: 675 },
  og: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
};

// ─── Stock search ─────────────────────────────────────────────────────────
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

async function searchPexels(query) {
  if (!PEXELS_API_KEY) return null;
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=5`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.photos?.length) return null;
  const photo = data.photos[Math.floor(Math.random() * Math.min(data.photos.length, 5))];
  return {
    url: photo.src.large2x || photo.src.large || photo.src.original,
    provider: 'Pexels',
    photographer: photo.photographer,
    sourceUrl: photo.url,
  };
}

async function searchPixabay(query) {
  if (!PIXABAY_API_KEY) return null;
  const url = `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true&per_page=5`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.hits?.length) return null;
  const hit = data.hits[Math.floor(Math.random() * Math.min(data.hits.length, 5))];
  return {
    url: hit.largeImageURL || hit.fullHDURL || hit.webformatURL,
    provider: 'Pixabay',
    photographer: hit.user,
    sourceUrl: hit.pageURL,
  };
}

export async function fetchStockImage(query) {
  let result = await searchPexels(query);
  if (!result) result = await searchPixabay(query);
  if (!result) return null;
  const response = await fetch(result.url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    provider: result.provider,
    photographer: result.photographer,
    sourceUrl: result.sourceUrl,
  };
}

// ─── Canvas thumbnail generator ──────────────────────────────────────────
async function renderWithCanvas(imageBuffer, title, category, preset) {
  const { width: W, height: H } = preset;
  const resized = await sharp(imageBuffer).resize(W, H, { fit: 'cover' }).toBuffer();
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const img = await loadImage(resized);
  ctx.drawImage(img, 0, 0, W, H);

  // Dark gradient overlay
  const gradient = ctx.createLinearGradient(0, H * 0.55, 0, H);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // Brand chip
  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#1a73e8';
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.roundRect(24, 24, 220, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  const fontFamily = fontRegistered ? 'Inter' : 'sans-serif';
  ctx.font = `bold 22px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Shiney Brain Academy', 40, 48);

  // Category badge
  ctx.fillStyle = '#FFCC00';
  ctx.beginPath();
  ctx.roundRect(W - 144, 24, 120, 40, 20);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `bold 16px ${fontFamily}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(category || 'General', W - 132, 44);

  // Title (wrap to 2 lines)
  const maxWidth = W - 80;
  const lineHeight = 58;
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    while (ctx.measureText(lines[1] + '…').width > maxWidth) {
      lines[1] = lines[1].slice(0, -1);
    }
    lines[1] = lines[1] + '…';
  }

  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 15;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 48px ${fontFamily}`;
  const yStart = H - 60;
  for (let i = 0; i < lines.length; i++) {
    const y = yStart - (lines.length - 1 - i) * lineHeight;
    ctx.fillText(lines[i], 40, y);
  }

  // Footer URL
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `16px ${fontFamily}`;
  ctx.textBaseline = 'bottom';
  ctx.fillText('shineybrainacademy.com', 40, H - 16);

  return canvas.toBuffer('image/jpeg', { quality: 85 });
}

// ─── Fallback: Sharp SVG overlay (no canvas) ────────────────────────────
async function renderWithSharpSvg(imageBuffer, title, category, preset) {
  const { width: W, height: H } = preset;
  const resized = await sharp(imageBuffer).resize(W, H, { fit: 'cover' }).toBuffer();

  // Escape title for SVG
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fade" x1="0" y1="0.6" x2="0" y2="1">
          <stop offset="0%" stop-color="black" stop-opacity="0" />
          <stop offset="100%" stop-color="black" stop-opacity="0.75" />
        </linearGradient>
      </defs>
      <rect x="0" y="${H * 0.55}" width="${W}" height="${H * 0.45}" fill="url(#fade)" />
      <rect x="24" y="24" rx="8" width="220" height="48" fill="#1a73e8" />
      <text x="40" y="55" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="white">Shiney Brain Academy</text>
      <rect x="${W - 144}" y="24" rx="20" width="120" height="40" fill="#FFCC00" />
      <text x="${W - 132}" y="51" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#1a1a1a">${category || 'General'}</text>
      <text x="40" y="${H - 60}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800" fill="white" letter-spacing="-1">${safeTitle}</text>
      <text x="40" y="${H - 16}" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="rgba(255,255,255,0.6)">shineybrainacademy.com</text>
    </svg>
  `;

  return await sharp(resized)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ─── Main exported function ──────────────────────────────────────────────
export async function createBrandedThumbnail(imageBuffer, title, category, preset = IMAGE_PRESETS.hero) {
  try {
    // Try Canvas with Inter first
    return await renderWithCanvas(imageBuffer, title, category, preset);
  } catch (canvasErr) {
    console.warn('Canvas rendering failed, falling back to Sharp SVG:', canvasErr.message);
    try {
      // Fallback to Sharp SVG
      return await renderWithSharpSvg(imageBuffer, title, category, preset);
    } catch (svgErr) {
      console.error('Sharp SVG fallback also failed:', svgErr.message);
      // Ultimate fallback: return the raw image (no text)
      return await sharp(imageBuffer).resize(preset.width, preset.height, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    }
  }
}

// ─── Branded fallback (no photo) ─────────────────────────────────────────
export async function createFallbackThumbnail(title, category, preset = IMAGE_PRESETS.hero) {
  const { width: W, height: H } = preset;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#FFCC00';
  ctx.beginPath();
  ctx.arc(W - 100, 100, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = 'rgba(0,0,0,0.2)';
  ctx.shadowBlur = 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  const fontFamily = fontRegistered ? 'Inter' : 'sans-serif';
  ctx.font = `bold 52px ${fontFamily}`;
  const words = title.split(' ');
  let lines = [];
  let currentLine = '';
  const maxWidth = W - 120;
  for (const word of words) {
    const testLine = currentLine + (currentLine ? ' ' : '') + word;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  if (lines.length > 3) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1] + '…';
  }
  const lineHeight = 60;
  const startY = H / 2 - (lines.length - 1) * lineHeight / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W / 2, startY + i * lineHeight);
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#FFCC00';
  ctx.font = `bold 24px ${fontFamily}`;
  ctx.fillText('Shiney Brain Academy', W / 2, H - 60);

  return canvas.toBuffer('image/jpeg', { quality: 85 });
}