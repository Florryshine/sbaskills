// Motion design system: fonts + theme resolution for the Motion Graphics
// Engine. Fonts are bundled in public/fonts (OFL licensed) and registered
// with delayRender semantics so no frame renders before typefaces are ready.

import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

let registered = false;

export function registerMotionFonts() {
  if (registered) return;
  registered = true;
  const defs = [
    ['Anton', 'Anton-Regular.ttf', '400'],
    ['Archivo Black', 'ArchivoBlack-Regular.ttf', '400'],
    ['Bebas Neue', 'BebasNeue-Regular.ttf', '400'],
    ['Rajdhani', 'Rajdhani-Bold.ttf', '700'],
    ['Space Mono', 'SpaceMono-Regular.ttf', '400'],
    ['Space Mono', 'SpaceMono-Bold.ttf', '700'],
    ['DM Serif Display', 'DMSerifDisplay-Regular.ttf', '400'],
    ['Poppins', 'Poppins-SemiBold.ttf', '600'],
    ['Poppins', 'Poppins-Bold.ttf', '700'],
    ['Inter', 'Inter-Bold.ttf', '700'],
    ['Caveat', 'Caveat-Bold.ttf', '700'],
    ['Permanent Marker', 'PermanentMarker-Regular.ttf', '400'],
  ];
  for (const [family, file, weight] of defs) {
    loadFont({ family, url: staticFile(`fonts/${file}`), weight, format: 'truetype' });
  }
}

// Fallback stacks ensure the composition still renders if a font is missing.
const STACKS = {
  'Anton': "Anton, 'Archivo Black', Impact, sans-serif",
  'Archivo Black': "'Archivo Black', Anton, sans-serif",
  'Bebas Neue': "'Bebas Neue', Anton, sans-serif",
  'Rajdhani': "Rajdhani, 'Space Mono', sans-serif",
  'Space Mono': "'Space Mono', monospace",
  'DM Serif Display': "'DM Serif Display', Georgia, serif",
  'Poppins': "Poppins, Inter, system-ui, sans-serif",
  'Inter': "Inter, Poppins, system-ui, sans-serif",
  'Caveat': "Caveat, 'Comic Sans MS', cursive",
  'Permanent Marker': "'Permanent Marker', Caveat, cursive",
};

export function fontStack(family) {
  return STACKS[family] || "Poppins, Inter, system-ui, sans-serif";
}

const CASE_TRANSFORMS = { upper: 'uppercase', lower: 'lowercase', none: 'none' };

export function displayType(direction) {
  const t = direction.typography || {};
  return {
    family: fontStack(t.display || 'Poppins'),
    bodyFamily: fontStack(t.body || 'Poppins'),
    transform: CASE_TRANSFORMS[t.displayCase || 'none'] || 'none',
    tracking: (t.tracking || 0) * 0.01,
    numericFamily: t.numericMono ? fontStack('Space Mono') : fontStack(t.display || 'Poppins'),
  };
}

// Dimension presets. Remotion resolves width/height through calculateMetadata,
// so layouts always design against a 1080-wide artboard scaled to fit.
export const DIMENSIONS = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
  '1:1': { width: 1080, height: 1080 },
};

export function themeOf(direction) {
  const p = direction.palette || {};
  return {
    palette: p,
    ...p,
    type: displayType(direction),
    intensity: direction.intensity || 'balanced',
    light: direction.light || {},
    motion: direction.motion || {},
  };
}

// Scale-safe font sizes relative to artboard width (1080 units).
export function typeScale(kind, theme, layoutHint) {
  const base = {
    hero: 148,
    title: 96,
    headline: 78,
    kicker: 40,
    body: 46,
    caption: 34,
    counter: 190,
    label: 44,
  };
  const value = base[kind] || 48;
  // Display fonts with large caps (Anton/Archivo) need slightly less size.
  const familyBias = /Anton|Archivo|Bebas/.test(theme.type.family) ? 0.88 : 1;
  return value * familyBias;
}
