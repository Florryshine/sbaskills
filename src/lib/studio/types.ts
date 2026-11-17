/**
 * SBA Musical Learning Studio — core data model.
 *
 * The SongSpec is the single contract between the AI lyric brain (server)
 * and the audio + video engines (client). Everything downstream — melody,
 * arrangement, singing, typography, export — is derived from this object,
 * which is what guarantees audio/visual synchronization.
 */

export type GenreId =
  | 'afrobeats' | 'amapiano' | 'pop' | 'hiphop' | 'rnb' | 'gospel'
  | 'dance' | 'reggae' | 'kids' | 'acoustic' | 'motivational' | 'jingle';

export type MoodId = 'upbeat' | 'happy' | 'groovy' | 'calm' | 'epic' | 'dreamy';

export type SectionName =
  | 'intro' | 'verse' | 'prechorus' | 'chorus' | 'bridge' | 'hook' | 'outro';

export type Density = 'silence' | 'low' | 'mid' | 'full' | 'drop';

export type VocalMode = 'synth' | 'tts';
export type VocalStyle = 'bright' | 'warm' | 'choir';
export type AspectId = '9:16' | '1:1' | '16:9';
export type TypographyId = 'bounce' | 'letters' | 'wave' | 'stretch' | 'neon' | 'burst';
export type BackgroundId = 'rays' | 'blobs' | 'grid' | 'confetti' | 'waves' | 'spotlight';

/** A single sung pitch event, attached to one syllable. */
export interface NoteSpec {
  /** Absolute MIDI note. If absent, `degree` is used relative to the key. */
  midi?: number;
  /** Scale degree 1..7 (optionally '1+' / '7b' style chromatic tweaks). */
  degree?: number;
  /** Duration in beats. */
  beats: number;
}

export interface WordNote {
  text: string;
  /** Optional explicit syllables. Otherwise auto-syllabified. */
  syllables?: string[];
  /** One note per syllable (finalizer enforces this). */
  notes: NoteSpec[];
}

export interface LyricLine {
  text: string;
  /** The concrete fact this line teaches — highlighted by the video engine. */
  fact?: string;
  /** Optional explicit start beat override (auto-computed when absent). */
  startBeat?: number;
  words: WordNote[];
}

export interface SectionSpec {
  id: string;
  name: SectionName;
  label?: string;
  bars: number;
  /** One chord symbol per bar, e.g. ['C', 'G', 'Am', 'F']. */
  chords: string[];
  density: Density;
  lines: LyricLine[];
}

export interface SongSpec {
  title: string;
  topic: string;
  genre: GenreId;
  mood: MoodId;
  tempoBpm: number;
  /** Key root, e.g. 'C' | 'F#' | 'Bb' */
  key: string;
  scale: 'major' | 'minor';
  vocal: {
    mode: VocalMode;
    style: VocalStyle;
    vibrato: number; // 0..1
  };
  /** Deterministic seeds so any component can be regenerated independently. */
  seeds: { melody: number; arrangement: number };
  sections: SectionSpec[];
  /** Free-form creative notes from the AI (shown in UI). */
  creativeNotes?: string;
}

/** Provider used to produce the lyrics (reported to the UI). */
export type LyricsProvider = 'gemini' | 'zai' | 'fallback';

export interface LyricsRequest {
  topic: string;
  notes?: string;
  genre?: GenreId | 'auto';
  mood?: MoodId;
  durationSec?: number;
  title?: string;
  regenerateSeed?: number;
}

export interface LyricsResponse {
  spec: SongSpec; // sections/lines without melody notes (added client-side)
  provider: LyricsProvider;
  factCheck?: { checked: boolean; corrections?: string[] };
  warnings?: string[];
}

/* ------------------------------------------------------------------ */
/* Studio settings (the physical controls of the studio)               */
/* ------------------------------------------------------------------ */

export interface StudioSettings {
  genre: GenreId | 'auto';
  mood: MoodId;
  durationSec: 30 | 45 | 60 | 90;
  vocalMode: VocalMode;
  vocalStyle: VocalStyle;
  musicIntensity: number;      // 0..1
  tempoOverride: number | null;
  typography: TypographyId;
  background: BackgroundId;
  aspect: AspectId;
  seedMelody: number;
  seedArrangement: number;
}

export const DEFAULT_SETTINGS: StudioSettings = {
  genre: 'afrobeats',
  mood: 'upbeat',
  durationSec: 60,
  vocalMode: 'synth',
  vocalStyle: 'bright',
  musicIntensity: 0.7,
  tempoOverride: null,
  typography: 'bounce',
  background: 'rays',
  aspect: '9:16',
  seedMelody: 20261117,
  seedArrangement: 44401,
};

/* ------------------------------------------------------------------ */
/* Rendered timeline (computed from SongSpec — used by audio + video)  */
/* ------------------------------------------------------------------ */

export interface WordTiming {
  text: string;
  factWord: boolean;
  startBeat: number;
  endBeat: number;
  startSec: number;
  endSec: number;
  /** Per-syllable pitch events with absolute seconds. */
  syllables: Array<{
    text: string;
    midi: number;
    startSec: number;
    endSec: number;
    vowel: string;
    onset: string;
    coda: string;
  }>;
}

export interface LineTiming {
  text: string;
  fact?: string;
  sectionId: string;
  startBeat: number;
  endBeat: number;
  startSec: number;
  endSec: number;
  words: WordTiming[];
}

export interface SectionTiming {
  id: string;
  name: SectionName;
  label?: string;
  startBeat: number;
  endBeat: number;
  startSec: number;
  endSec: number;
  chords: string[];
  density: Density;
  lines: LineTiming[];
}

export interface Timeline {
  spec: SongSpec;
  bpm: number;
  secPerBeat: number;
  totalBeats: number;
  durationSec: number;
  sections: SectionTiming[];
  /** Absolute time of every quarter-note beat (for beat-reactive visuals). */
  beatTimes: number[];
}

/** One scheduled instrument hit in the arrangement. */
export interface InstrumentEvent {
  inst: string;
  tSec: number;
  durSec: number;
  midi?: number;
  vel: number;
}

export interface EngineProgress {
  stage: string;
  percent: number;
}

export interface RenderResult {
  timeline: Timeline;
  audio: AudioBuffer;
  durationSec: number;
}
