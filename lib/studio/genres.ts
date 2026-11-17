/**
 * Genre templates — the rhythmic and harmonic DNA of the instrumental engine.
 *
 * Drum patterns are 16-step strings per bar (one char per 16th note):
 *   x = hit, X = accent, o = open hit, . = rest
 * Swing delays odd 16ths for a human, genre-correct groove.
 */
import type { GenreId, MoodId } from './types';

export type BassStyle = 'sub8' | 'offbeat' | 'walking' | 'logdrum' | 'boombap' | 'reggae' | 'drive' | 'soft';
export type ChordStyle = 'pad' | 'stab' | 'pluck8' | 'skank' | 'swell' | 'strum';
export type LeadStyle = 'arp' | 'counter' | 'bell' | 'none';

export interface GenreDef {
  id: GenreId;
  label: string;
  bpmRange: [number, number];
  swing: number;
  drums: {
    kick: string; snare?: string; hat?: string; hatOpen?: string;
    clap?: string; shaker?: string; rim?: string; tom?: string; perc?: string; tamb?: string;
  };
  bassStyle: BassStyle;
  chordStyle: ChordStyle;
  leadStyle: LeadStyle;
  /** Drums only enter at the first full section (classic build-up). */
  introBuild: boolean;
  fillAtSectionEnd: boolean;
  moods: MoodId[];
}

const G: GenreDef[] = [
  {
    id: 'afrobeats', label: 'Afrobeats', bpmRange: [100, 112], swing: 0.06,
    drums: {
      kick: '..x...x...x.....',
      rim:  '....x.......x...',
      hat:  'x.x.x.x.x.x.x.x.',
      shaker: 'x.x.x.x.x.x.x.x.',
      perc: 'x...x..x..x.x..x',
    },
    bassStyle: 'offbeat', chordStyle: 'pluck8', leadStyle: 'counter',
    introBuild: true, fillAtSectionEnd: true, moods: ['upbeat', 'happy', 'groovy'],
  },
  {
    id: 'amapiano', label: 'Amapiano', bpmRange: [108, 116], swing: 0.08,
    drums: {
      kick: 'x.......x.......',
      snare: '............x...',
      shaker: 'xxxxxxxxxxxxxxxx',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'logdrum', chordStyle: 'stab', leadStyle: 'arp',
    introBuild: true, fillAtSectionEnd: false, moods: ['groovy', 'dreamy', 'upbeat'],
  },
  {
    id: 'pop', label: 'Pop', bpmRange: [100, 120], swing: 0,
    drums: {
      kick: 'x.......x.......',
      clap: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      hatOpen: '..x...x...x...x.',
    },
    bassStyle: 'sub8', chordStyle: 'pluck8', leadStyle: 'bell',
    introBuild: false, fillAtSectionEnd: true, moods: ['upbeat', 'happy'],
  },
  {
    id: 'hiphop', label: 'Hip-hop', bpmRange: [84, 96], swing: 0.12,
    drums: {
      kick: 'x.....x...x.....',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'boombap', chordStyle: 'stab', leadStyle: 'arp',
    introBuild: true, fillAtSectionEnd: false, moods: ['groovy', 'upbeat', 'epic'],
  },
  {
    id: 'rnb', label: 'R&B', bpmRange: [72, 90], swing: 0.1,
    drums: {
      kick: 'x.......x.x.....',
      rim: '....x.......x...',
      hat: 'x..x..x.x..x..x.',
    },
    bassStyle: 'walking', chordStyle: 'pad', leadStyle: 'bell',
    introBuild: false, fillAtSectionEnd: false, moods: ['dreamy', 'calm', 'groovy'],
  },
  {
    id: 'gospel', label: 'Gospel', bpmRange: [76, 96], swing: 0.08,
    drums: {
      kick: 'x.......x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      tamb: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'walking', chordStyle: 'swell', leadStyle: 'counter',
    introBuild: false, fillAtSectionEnd: true, moods: ['epic', 'upbeat', 'happy'],
  },
  {
    id: 'dance', label: 'Dance', bpmRange: [122, 128], swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      hatOpen: '..x...x...x...x.',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'drive', chordStyle: 'stab', leadStyle: 'arp',
    introBuild: true, fillAtSectionEnd: true, moods: ['upbeat', 'epic', 'happy'],
  },
  {
    id: 'reggae', label: 'Reggae', bpmRange: [72, 88], swing: 0.06,
    drums: {
      kick: '........x.......',
      rim: '........x.......',
      hat: '..x...x...x...x.',
    },
    bassStyle: 'reggae', chordStyle: 'skank', leadStyle: 'counter',
    introBuild: false, fillAtSectionEnd: false, moods: ['groovy', 'calm', 'happy'],
  },
  {
    id: 'kids', label: "Children's Educational", bpmRange: [96, 112], swing: 0,
    drums: {
      kick: 'x.......x.......',
      clap: '....x.......x...',
      tamb: 'x.x.x.x.x.x.x.x.',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'soft', chordStyle: 'pluck8', leadStyle: 'bell',
    introBuild: false, fillAtSectionEnd: true, moods: ['happy', 'upbeat'],
  },
  {
    id: 'acoustic', label: 'Calm Acoustic', bpmRange: [68, 88], swing: 0.04,
    drums: {
      kick: 'x...............',
      rim: '....x.......x...',
      shaker: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'soft', chordStyle: 'strum', leadStyle: 'bell',
    introBuild: false, fillAtSectionEnd: false, moods: ['calm', 'dreamy'],
  },
  {
    id: 'motivational', label: 'Epic Motivational', bpmRange: [90, 110], swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      tom: '............xoxo',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'sub8', chordStyle: 'swell', leadStyle: 'counter',
    introBuild: true, fillAtSectionEnd: true, moods: ['epic', 'upbeat'],
  },
  {
    id: 'jingle', label: 'Catchy Jingle', bpmRange: [112, 126], swing: 0,
    drums: {
      kick: 'x...x...x...x...',
      clap: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
    },
    bassStyle: 'drive', chordStyle: 'pluck8', leadStyle: 'bell',
    introBuild: false, fillAtSectionEnd: true, moods: ['happy', 'upbeat'],
  },
];

export function getGenre(id: GenreId): GenreDef {
  return G.find((g) => g.id === id) ?? G[0];
}

export function listGenres(): GenreDef[] {
  return G;
}

/** Parse a 16-step pattern string into [stepIndex, velocity] pairs. */
export function parsePattern(pattern?: string): Array<[number, number]> {
  if (!pattern) return [];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pattern.length && i < 16; i++) {
    const c = pattern[i];
    if (c === 'x') out.push([i, 0.85]);
    else if (c === 'X') out.push([i, 1.0]);
    else if (c === 'o') out.push([i, 0.6]);
  }
  return out;
}
