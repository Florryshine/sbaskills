// src/themes.ts — subject-aware visual themes.
// Palette: professional desaturated marker colors on a warm white board.

import type { ResolvedTheme, Subject } from './types';

export const THEMES: Record<Subject, ResolvedTheme> = {
  biology: {
    board: '#FDFDFB',
    boardEdge: '#E8E6E0',
    ink: '#26343C',
    inkSoft: '#5D6E78',
    accent: '#2E7D4F', // leaf green
    accent2: '#C25B34', // terracotta
    highlight: '#F7C948', // marker yellow
  },
  chemistry: {
    board: '#FDFCFA',
    boardEdge: '#E9E5DE',
    ink: '#2A2830',
    inkSoft: '#635D6E',
    accent: '#B4552D', // burnt orange
    accent2: '#3B7A8C', // teal
    highlight: '#F2B33D',
  },
  physics: {
    board: '#FBFBFD',
    boardEdge: '#E6E6E9',
    ink: '#1F2A33',
    inkSoft: '#586873',
    accent: '#20647A', // deep teal
    accent2: '#B0503C', // brick
    highlight: '#E8B84B',
  },
  mathematics: {
    board: '#FDFDFB',
    boardEdge: '#E8E6E0',
    ink: '#282B33',
    inkSoft: '#5E6470',
    accent: '#7A4A9E', // muted violet
    accent2: '#2E7D6B', // viridian
    highlight: '#F2C14E',
  },
  general: {
    board: '#FDFDFB',
    boardEdge: '#E8E6E0',
    ink: '#26303A',
    inkSoft: '#5C6B75',
    accent: '#2E6E5E',
    accent2: '#B3583C',
    highlight: '#F5C34B',
  },
};

export function resolveColor(theme: ResolvedTheme, color?: string | undefined): string {
  if (!color) return theme.ink;
  switch (color) {
    case 'ink':
      return theme.ink;
    case 'inkSoft':
      return theme.inkSoft;
    case 'accent':
      return theme.accent;
    case 'accent2':
      return theme.accent2;
    case 'highlight':
      return theme.highlight;
    default:
      return color;
  }
}

export function getTheme(subject: Subject): ResolvedTheme {
  return THEMES[subject] ?? THEMES.general;
}

// Font stack CSS families — loaded via @font-face in the composition.
export const FONT_FAMILY = {
  heading: "'Caveat', 'Comic Sans MS', cursive",
  body: "'Patrick Hand', 'Comic Sans MS', cursive",
  label: "'Kalam', 'Comic Sans MS', cursive",
} as const;

/** Approximate average glyph width as a fraction of font-size (build-time layout). */
export const FONT_WIDTH_FACTOR = {
  heading: 0.47,
  body: 0.48,
  label: 0.48,
} as const;
