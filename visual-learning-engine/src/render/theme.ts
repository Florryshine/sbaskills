// src/render/theme.ts — palette + layout math for the composition.

import type { Aspect } from '../types';

export interface Layout {
  width: number;
  height: number;
  /** short edge of the frame — all type scales from this */
  unit: number;
  isTall: boolean;
  isSquare: boolean;
  padX: number;
  padY: number;
  headlineSize: number;
  bodySize: number;
  captionSize: number;
}

export function layoutFor(aspect: Aspect): Layout {
  const { width, height } =
    aspect === '9:16' ? { width: 1080, height: 1920 } : aspect === '1:1' ? { width: 1080, height: 1080 } : { width: 1920, height: 1080 };
  const unit = Math.min(width, height);
  return {
    width,
    height,
    unit,
    isTall: aspect === '9:16',
    isSquare: aspect === '1:1',
    padX: unit * 0.075,
    padY: unit * 0.07,
    headlineSize: unit * (aspect === '9:16' ? 0.135 : 0.115),
    bodySize: unit * (aspect === '9:16' ? 0.048 : 0.038),
    captionSize: unit * (aspect === '9:16' ? 0.042 : 0.033),
  };
}

export const THEME = {
  paper: '#FDFBF7',
  paperWarm: '#F7F1E6',
  ink: '#17171C',
  inkSoft: '#4A4A52',
  accent: '#E63946',
  accentGreen: '#2A9D8F',
  accentBlue: '#3A86FF',
  accentAmber: '#FFB703',
  cardWhite: '#FFFFFF',
  shadow: 'rgba(23,23,28,0.10)',
} as const;

export function toneColor(tone?: 'bad' | 'good' | 'neutral'): string {
  if (tone === 'bad') return THEME.accent;
  if (tone === 'good') return THEME.accentGreen;
  return THEME.accentBlue;
}
