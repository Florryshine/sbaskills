// Creative direction engine — the orchestrator for the Motion Graphics
// creative pipeline:
//   script (provided, or topic + deterministic/LLM script) ->
//   analysis -> visual direction -> scene plan -> music plan.
// Everything downstream of the script is deterministic and seeded, so the
// same script reproduces its direction exactly and any change of script
// (or regeneration seed) produces a genuinely different visual language.

import { hashSeed, Rng } from './random.js';
import { chooseDirection, classifyDomain } from './directions.js';
import { analyzeScript } from './script-analyzer.js';
import { planScenes, replanScene } from './scene-planner.js';

const MUSIC_KEYS = {
  pulse: { root: 41.2, scale: [0, 3, 5, 7, 10] },       // E1 minor pentatonic
  tech: { root: 36.7, scale: [0, 2, 3, 7, 9] },          // D1 dorian-ish
  cinematic: { root: 32.7, scale: [0, 2, 3, 7, 8] },     // C1 minor add b6
  epic: { root: 43.7, scale: [0, 2, 4, 7, 9] },          // F1 major pentatonic
  chill: { root: 38.9, scale: [0, 3, 5, 7, 10] },        // D#1 minor pentatonic
  dark: { root: 30.9, scale: [0, 1, 3, 7, 8] },          // A0 phrygian
  bright: { root: 43.7, scale: [0, 2, 4, 7, 11] },       // F1 lydian-ish
};

function buildMusicPlan({ direction, scenes, seed, totalDuration, overrideStyle }) {
  const rng = new Rng((seed ^ hashSeed(direction.id)) >>> 0);
  const style = overrideStyle || direction.musicKit;
  const key = MUSIC_KEYS[style] || MUSIC_KEYS.pulse;
  const tempoByStyle = { pulse: 122, tech: 128, cinematic: 84, epic: 96, chill: 92, dark: 100, bright: 116 };
  const baseTempo = tempoByStyle[style] || 112;
  const tempo = Math.round(baseTempo * rng.float(0.94, 1.06));
  const beat = 60 / tempo;
  // Scene boundaries stay EXACT so impact SFX and music hits land precisely
  // on every cut; only the internal bar grid uses the beat.
  const boundaries = [];
  let acc = 0;
  for (const scene of scenes) {
    acc += scene.durationSeconds;
    boundaries.push(Number(acc.toFixed(3)));
  }
  const sectionKits = style === 'cinematic' || style === 'dark' ? ['pad', 'pulse'] : ['pulse', 'pad'];
  return {
    style,
    tempo,
    beatSeconds: Number(beat.toFixed(4)),
    rootHz: key.root,
    scale: key.scale,
    bars: Math.ceil(acc / (beat * 4)),
    sceneBoundaries: boundaries,
    progression: rng.pick([
      [0, 5, 3, 4], [0, 3, 4, 5], [0, 4, 5, 3], [0, 2, 3, 4],
    ]),
    intensityCurve: scenes.map((s, i) => Math.min(1, 0.45 + (i / Math.max(1, scenes.length - 1)) * 0.5 + (s.isOutro ? -0.1 : 0))),
    kits: sectionKits,
    swing: rng.chance(0.35) ? 0.08 : 0,
  };
}

export function buildCreativeDirection({
  scriptText,
  topic,
  seed,
  intensity = 'balanced',
  musicStyle = null,
  narrationDurations = {},
  maxScenes = 12,
}) {
  const text = String(scriptText || '').trim();
  const subject = topic || (text.split(/[.!?]/)[0] || 'this story').slice(0, 80);
  const masterSeed = (seed ?? hashSeed(text || subject)) >>> 0;

  const { direction, classification, mood } = chooseDirection(text || subject, {
    seed: masterSeed, intensity,
  });

  const analysis = analyzeScript(text || subject, { seed: masterSeed ^ 0x51ab, maxScenes });
  if (!analysis.scenes.length) {
    throw new Error('Motion engine: the provided script produced no scenes.');
  }

  const scenes = planScenes({
    scenes: analysis.scenes,
    direction,
    seed: masterSeed ^ 0x2f6d,
    narrationDurations,
  });

  const musicPlan = buildMusicPlan({ direction, scenes, seed: masterSeed, totalDuration: scenes.reduce((a, s) => a + s.durationSeconds, 0), overrideStyle: musicStyle });

  return {
    version: 1,
    seed: masterSeed,
    title: deriveTitle(text, subject),
    direction,
    analysis: {
      domain: classification.domain,
      domainConfidence: classification.confidence,
      mood,
      keywords: analysis.keywords,
      numbers: analysis.numbers,
      sceneCount: analysis.sceneCount,
      totalWords: analysis.totalWords,
      estimatedTotalDuration: Number(scenes.reduce((a, s) => a + s.durationSeconds, 0).toFixed(2)),
    },
    scenes,
    musicPlan,
    warnings: [],
  };
}

function deriveTitle(text, subject) {
  const first = String(text || '').trim().split(/(?<=[.!?])\s/)[0] || subject;
  const clean = first.replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
  const words = clean.split(/\s+/);
  const title = words.slice(0, 9).join(' ');
  return (title.length >= 8 ? title : subject).slice(0, 110);
}

/** Regenerate a single scene's composition (keeps text, refreshes layout). */
export function regenerateSceneDirection(spec, direction, bump) {
  return replanScene(spec, direction, bump);
}
