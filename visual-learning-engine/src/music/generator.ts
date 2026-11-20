// src/music/generator.ts — procedural ambient background music (free, offline).
//
// Generates a calm, warm underscore for educational videos: slow chord pads,
// a sparse music-box melody, and a soft low drone — seeded per episode so the
// same job always produces the same track. Pure TypeScript → 16-bit stereo
// WAV; no external service, no ffmpeg dependency, no license concerns.
//
// Sound design (kept deliberately minimal and -20 dBFS-ish so narration sits
// on top after the ducking envelope):
//   pads     — detuned triangle+sine voices, slow attack, chord tones
//   melody   — sparse sine "kalimba" notes with exponential decay
//   drone    — one low sine an octave below the chord root

export interface GeneratedMusic {
  file: string;
  duration: number;
  sampleRate: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOTE_BASE = 261.626; // C4

function noteFreq(semitoneFromC4: number): number {
  return NOTE_BASE * Math.pow(2, semitoneFromC4 / 12);
}

/** Chord progressions as scale-degree triads (root position, pleasant loops). */
const PROGRESSIONS: number[][][] = [
  [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], // I vi IV V
  [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], // I IV vi V
  [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]], // vi IV I V
];

function synthPad(freq: number, seconds: number, sampleRate: number, gain: number, rand: () => number): Float32Array {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  const attack = Math.floor(0.9 * sampleRate);
  const release = Math.floor(Math.min(1.4, seconds * 0.35) * sampleRate);
  const detune = 1 + (rand() - 0.5) * 0.004;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attack) env = i / attack;
    if (i > n - release) env = Math.max(0, (n - i) / release);
    const v =
      0.55 * Math.sin(2 * Math.PI * freq * t) +
      0.35 * Math.sin(2 * Math.PI * freq * detune * t + 0.7) +
      0.10 * Math.sin(2 * Math.PI * freq * 2 * t);
    out[i] = v * env * gain;
  }
  return out;
}

function synthPluck(freq: number, seconds: number, sampleRate: number, gain: number): Float32Array {
  const n = Math.floor(seconds * sampleRate);
  const out = new Float32Array(n);
  const decay = 1.8;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-decay * t);
    const attack = Math.min(1, i / (0.004 * sampleRate));
    out[i] = (0.75 * Math.sin(2 * Math.PI * freq * t) + 0.2 * Math.sin(2 * Math.PI * freq * 2 * t)) * env * attack * gain;
  }
  return out;
}

export function generateMusicWav(opts: { seconds: number; seed: number; sampleRate?: number }): { left: Float32Array; right: Float32Array; sampleRate: number } {
  const sampleRate = opts.sampleRate ?? 44100;
  const seconds = Math.max(8, Math.ceil(opts.seconds));
  const rand = mulberry32(opts.seed);
  const total = Math.floor(seconds * sampleRate);
  const left = new Float32Array(total);
  const right = new Float32Array(total);

  const progression = PROGRESSIONS[Math.floor(rand() * PROGRESSIONS.length)];
  const barSeconds = 4.0; // one chord per bar at ~60bpm 4/4 feel
  const transpose = -3; // sit a little lower (A below C)

  let t = 0;
  let barIdx = 0;
  while (t < seconds) {
    const chord = progression[barIdx % progression.length];
    const dur = Math.min(barSeconds, seconds - t);

    // Pad chord (slightly offset stereo per voice)
    chord.forEach((semi, vi) => {
      const freq = noteFreq(semi + transpose);
      const gain = vi === 0 ? 0.11 : 0.075;
      const pan = vi % 2 === 0 ? -0.25 : 0.25;
      const voice = synthPad(freq, dur, sampleRate, gain, rand);
      const startSample = Math.floor(t * sampleRate);
      for (let i = 0; i < voice.length && startSample + i < total; i++) {
        const v = voice[i];
        left[startSample + i] += v * (1 - Math.max(0, pan));
        right[startSample + i] += v * (1 - Math.max(0, -pan));
      }
    });

    // Sparse plucked melody: 1-2 notes per bar, chord tones up top
    const plucks = rand() < 0.65 ? 2 : 1;
    for (let p = 0; p < plucks; p++) {
      const semi = chord[Math.floor(rand() * chord.length)] + transpose + 12;
      const at = t + rand() * (barSeconds * 0.7);
      const startSample = Math.floor(at * sampleRate);
      const voice = synthPluck(noteFreq(semi), 2.2, sampleRate, 0.10);
      const pan = (rand() - 0.5) * 0.8;
      for (let i = 0; i < voice.length && startSample + i < total; i++) {
        const v = voice[i];
        left[startSample + i] += v * (1 - Math.max(0, pan));
        right[startSample + i] += v * (1 - Math.max(0, -pan));
      }
    }

    // Low drone on the root
    const droneFreq = noteFreq(chord[0] + transpose - 12);
    const startSample = Math.floor(t * sampleRate);
    const drone = synthPad(droneFreq, dur, sampleRate, 0.05, rand);
    for (let i = 0; i < drone.length && startSample + i < total; i++) {
      const v = drone[i];
      left[startSample + i] += v * 0.9;
      right[startSample + i] += v * 0.9;
    }

    t += barSeconds;
    barIdx += 1;
  }

  // Master: fade in/out and gentle normalize to ~-16 dBFS peak-ish
  const fade = Math.floor(1.5 * sampleRate);
  let peak = 1e-6;
  for (let i = 0; i < total; i++) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  }
  const norm = Math.min(1, 0.32 / peak); // keep it quiet — it's a bed, not a lead
  for (let i = 0; i < total; i++) {
    let f = 1;
    if (i < fade) f = i / fade;
    if (i > total - fade) f = Math.min(f, Math.max(0, (total - i) / fade));
    left[i] *= norm * f;
    right[i] *= norm * f;
  }
  return { left, right, sampleRate };
}

export function writeStereoWav(left: Float32Array, right: Float32Array, sampleRate: number): Buffer {
  const frames = left.length;
  const bytesPerSample = 2;
  const blockAlign = 2 * bytesPerSample;
  const dataSize = frames * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let off = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(l * 32767), off);
    buffer.writeInt16LE(Math.round(r * 32767), off + 2);
    off += 4;
  }
  return buffer;
}

/** Full music generation for an episode → WAV file on disk. */
export async function generateMusicFile(outPath: string, seconds: number, seed: number): Promise<GeneratedMusic> {
  const { left, right, sampleRate } = generateMusicWav({ seconds: seconds + 1.5, seed });
  const wav = writeStereoWav(left, right, sampleRate);
  const { writeFile } = await import('node:fs/promises');
  const { dirname } = await import('node:path');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, wav);
  return { file: outPath, duration: left.length / sampleRate, sampleRate };
}
