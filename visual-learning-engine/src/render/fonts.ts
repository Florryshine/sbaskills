// src/render/fonts.ts — font registration (Anton headlines, Inter body).
// Both fonts are OFL-licensed and bundled in assets/fonts (copied into the
// render public dir by the CLI/prep step).

import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

let registered = false;

export function registerVLFonts(): void {
  if (registered) return;
  registered = true;
  loadFont({
    family: 'VL Headline',
    url: staticFile('fonts/Anton-Regular.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'VL Body',
    url: staticFile('fonts/Inter-Variable.ttf'),
    weight: '400',
  });
  loadFont({
    family: 'VL Body',
    url: staticFile('fonts/Inter-Variable.ttf'),
    weight: '700',
  });
}

export const FONT_HEADLINE = "VL Headline, 'Anton', Impact, sans-serif";
export const FONT_BODY = "VL Body, 'Inter', system-ui, sans-serif";
