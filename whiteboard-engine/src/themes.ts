// src/themes.ts — subject-aware visual themes.
// Palette: vivid marker colours on a warm white board — bright enough for
// small screens, still professional. Accent pairs stay distinguishable for
// scientific structures (arteries/veins use dedicated hex colours in the
// anatomy library, e.g. #E03131 / #1971C2).

import type { ResolvedTheme, Subject } from './types';

export const THEMES: Record<Subject, ResolvedTheme> = {
  biology: {
    board: '#FEFEFC',
    boardEdge: '#EDEAE2',
    ink: '#21313B',
    inkSoft: '#5D6E78',
    accent: '#1EA55C', // vivid leaf green
    accent2: '#E8590C', // vivid orange
    highlight: '#FFD43B', // bright marker yellow
  },
  chemistry: {
    board: '#FEFEFC',
    boardEdge: '#ECE8E1',
    ink: '#262433',
    inkSoft: '#635D6E',
    accent: '#E8590C', // vivid orange
    accent2: '#1971C2', // strong blue
    highlight: '#FFD43B',
  },
  physics: {
    board: '#FDFDFE',
    boardEdge: '#E7E7EC',
    ink: '#1C2B35',
    inkSoft: '#586873',
    accent: '#0C8599', // strong cyan-teal
    accent2: '#E03131', // strong red
    highlight: '#FFD43B',
  },
  mathematics: {
    board: '#FEFEFC',
    boardEdge: '#EDEAE2',
    ink: '#262A36',
    inkSoft: '#5E6470',
    accent: '#7048E8', // vivid violet
    accent2: '#0CA678', // emerald
    highlight: '#FFD43B',
  },
  general: {
    board: '#FEFEFC',
    boardEdge: '#EDEAE2',
    ink: '#242F3A',
    inkSoft: '#5C6B75',
    accent: '#2F9E44', // vivid green
    accent2: '#E8590C', // vivid orange
    highlight: '#FFD43B',
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
// Headings use Permanent Marker: a genuine chunky marker hand — bold and
// readable even on phone screens. Caveat remains available for script accents.
export const FONT_FAMILY = {
  heading: "'Permanent Marker', 'Caveat', 'Comic Sans MS', cursive",
  body: "'Patrick Hand', 'Comic Sans MS', cursive",
  label: "'Kalam', 'Comic Sans MS', cursive",
} as const;

/** Approximate average glyph width as a fraction of font-size (build-time layout). */
export const FONT_WIDTH_FACTOR = {
  heading: 0.62, // Permanent Marker is much wider than Caveat
  body: 0.5,
  label: 0.5,
} as const;
