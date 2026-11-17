/**
 * Client-side pipeline orchestrator — the studio's "Generate Song" step.
 * Applies user settings to the AI spec, finalizes the melody, builds the
 * timeline and renders the complete mix (vocals + instrumental).
 */
import type { RenderResult, SongSpec, StudioSettings } from './types';
import { finalizeMelody, validateSpec } from './melody';
import { buildTimeline } from './arranger';
import { renderSong } from './mixer';
import { getGenre } from './genres';
import { MOOD_TEMPO, clamp } from './theory';

export interface GenerateOptions {
  settings: StudioSettings;
  ttsUrl?: string;
  onProgress?: (msg: string, percent: number) => void;
}

export interface GenerateResult extends RenderResult {
  warnings: string[];
}

export function applySettings(spec: SongSpec, settings: StudioSettings): SongSpec {
  const s: SongSpec = JSON.parse(JSON.stringify(spec));
  if (settings.genre !== 'auto') s.genre = settings.genre;
  s.mood = settings.mood;
  s.vocal.mode = settings.vocalMode;
  s.vocal.style = settings.vocalStyle;
  s.seeds.melody = settings.seedMelody;
  s.seeds.arrangement = settings.seedArrangement;
  if (settings.tempoOverride) {
    const [lo, hi] = getGenre(s.genre).bpmRange;
    s.tempoBpm = clamp(Math.round(settings.tempoOverride), lo - 10, hi + 10);
  } else {
    const [lo, hi] = getGenre(s.genre).bpmRange;
    const [mlo, mhi] = MOOD_TEMPO[s.mood];
    s.tempoBpm = clamp(Math.round((Math.max(lo, mlo) + Math.min(hi, mhi)) / 2), 60, 140);
  }
  s.vocal.vibrato = s.mood === 'calm' || s.mood === 'dreamy' ? 0.5 : 0.35;
  return s;
}

export async function generateSong(
  rawSpec: SongSpec,
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const { settings, onProgress } = opts;
  onProgress?.('Finalizing melody and rhythm…', 8);
  const spec = applySettings(rawSpec, settings);
  const finalized = finalizeMelody(spec);
  const warnings = validateSpec(finalized);

  onProgress?.('Building the arrangement…', 20);
  const timeline = buildTimeline(finalized);

  const { buffer, usedTts, ttsError } = await renderSong(finalized, timeline, {
    intensity: settings.musicIntensity,
    ttsUrl: opts.ttsUrl,
    onProgress: (msg, pct) => onProgress?.(msg, 20 + pct * 0.75),
  });
  if (ttsError) warnings.push(`TTS mode problem: ${ttsError}. The built-in synth singer was used.`);
  void usedTts;

  onProgress?.('Song ready.', 100);
  return { timeline, audio: buffer, durationSec: timeline.durationSec, warnings };
}
