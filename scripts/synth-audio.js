// Free synthesized background music loops + SFX for Cartoon Animation Studio.
// Pure Node PCM synthesis -> ffmpeg to mp3. Zero licensing cost, made for SBA.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SR = 44100;
const OUT = path.join(__dirname, "..", "public", "audio");

function ensureOut() { fs.mkdirSync(OUT, { recursive: true }); }

// ---- tiny synth helpers ----
function noteFreq(semitonesFromA4) { return 440 * Math.pow(2, semitonesFromA4 / 12); }
// note name -> semitone offset from A4
const NOTE = { C: -9, Cs: -8, D: -7, Ds: -6, E: -5, F: -4, Fs: -3, G: -2, Gs: -1, A: 0, As: 1, B: 2 };
function freq(name, octave) { return noteFreq(NOTE[name] + (octave - 4) * 12); }

class Track {
  constructor(seconds) { this.n = Math.round(seconds * SR); this.data = new Float32Array(this.n); }
  addTone(startSec, durSec, f, { gain = 0.2, attack = 0.01, decay = 0.12, harmonics = [1, 0.35, 0.12], detune = 0.0008 } = {}) {
    const s0 = Math.round(startSec * SR), n = Math.round(durSec * SR);
    for (let i = 0; i < n; i++) {
      const idx = s0 + i; if (idx >= this.n) break;
      const t = i / SR;
      const env = Math.min(1, t / Math.max(attack, 1e-4)) * Math.exp(-t / decay);
      let v = 0;
      for (let h = 0; h < harmonics.length; h++) v += harmonics[h] * Math.sin(2 * Math.PI * f * (h + 1) * (1 + detune) * t);
      this.data[idx] += gain * env * v;
    }
  }
  addNoise(startSec, durSec, { gain = 0.05, decay = 0.3, lp = 0.5 } = {}) {
    const s0 = Math.round(startSec * SR), n = Math.round(durSec * SR);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const idx = s0 + i; if (idx >= this.n) break;
      const t = i / SR;
      const env = Math.exp(-t / decay);
      const white = Math.random() * 2 - 1;
      last = last + lp * (white - last); // simple low-pass
      this.data[idx] += gain * env * last;
    }
  }
  // soft-clip + normalize + fade in/out
  finish(fadeSec = 0.4) {
    let peak = 0;
    for (let i = 0; i < this.n; i++) peak = Math.max(peak, Math.abs(this.data[i]));
    const g = peak > 0 ? 0.82 / peak : 1;
    const f0 = Math.round(fadeSec * SR), f1 = this.n - f0;
    for (let i = 0; i < this.n; i++) {
      let v = Math.tanh(this.data[i] * g * 1.1);
      if (i < f0) v *= i / f0;
      if (i > f1) v *= Math.max(0, (this.n - i) / f0);
      this.data[i] = v;
    }
  }
  toWav() {
    const buf = Buffer.alloc(44 + this.n * 2);
    buf.write("RIFF", 0); buf.writeUInt32LE(36 + this.n * 2, 4); buf.write("WAVE", 8);
    buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
    buf.write("data", 36); buf.writeUInt32LE(this.n * 2, 40);
    for (let i = 0; i < this.n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(this.data[i] * 32767))), 44 + i * 2);
    return buf;
  }
}

function saveWav(name, track) {
  const wav = path.join(OUT, name + ".wav");
  fs.writeFileSync(wav, track.toWav());
  const mp3 = path.join(OUT, name + ".mp3");
  execSync(`ffmpeg -y -v error -i "${wav}" -codec:a libmp3lame -b:a 128k "${mp3}"`);
  fs.unlinkSync(wav);
  console.log("made", mp3);
}

ensureOut();

// ============ 1. HAPPY LOOP — bright marimba-ish bounce (C-G-Am-F, 105 bpm) ============
{
  const bpm = 105, beat = 60 / bpm, bar = beat * 4, bars = 8;
  const t = new Track(bars * bar + 1);
  const prog = [["C", 3], ["G", 2], ["A", 2], ["F", 2]]; // roots (chords)
  const chordTones = { C: ["C", "E", "G"], G: ["G", "B", "D"], A: ["A", "C", "E"], F: ["F", "A", "C"] };
  for (let b = 0; b < bars; b++) {
    const [root, oct] = prog[b % 4];
    const tones = chordTones[root];
    const t0 = b * bar;
    // bass
    for (let k = 0; k < 4; k++) t.addTone(t0 + k * beat, beat * 0.9, freq(root, oct), { gain: 0.16, decay: 0.25, harmonics: [1, 0.25] });
    // chord plucks (offbeat skank)
    for (let k = 0; k < 4; k++) tones.forEach((nt, j) => t.addTone(t0 + k * beat + beat / 2, 0.28, freq(nt, oct + 2), { gain: 0.055, decay: 0.09, harmonics: [1, 0.4, 0.15] }));
    // melody: pentatonic sparkle
    const mel = [[0, "E", 5], [1, "G", 5], [1.5, "A", 5], [2, "G", 5], [3, "E", 5], [3.5, "D", 5]];
    if (b % 2 === 0) mel.forEach(([k, nt, o]) => t.addTone(t0 + k * beat, 0.34, freq(nt, o), { gain: 0.075, decay: 0.16 }));
    else mel.forEach(([k, nt, o]) => t.addTone(t0 + k * beat, 0.34, freq(nt, o === 5 ? 4 : 5), { gain: 0.06, decay: 0.16 }));
  }
  t.finish();
  saveWav("music-happy", t);
}

// ============ 2. CALM LOOP — warm pad, gentle (Am-F-C-G, 80 bpm) ============
{
  const bpm = 80, beat = 60 / bpm, bar = beat * 4, bars = 8;
  const t = new Track(bars * bar + 1);
  const prog = [["A", 2], ["F", 2], ["C", 3], ["G", 2]];
  const chordTones = { A: ["A", "C", "E"], F: ["F", "A", "C"], C: ["C", "E", "G"], G: ["G", "B", "D"] };
  for (let b = 0; b < bars; b++) {
    const [root, oct] = prog[b % 4];
    const t0 = b * bar;
    chordTones[root].forEach((nt) => t.addTone(t0, bar * 1.05, freq(nt, oct + 1), { gain: 0.05, attack: 0.4, decay: 2.4, harmonics: [1, 0.2, 0.08] }));
    t.addTone(t0, bar * 0.98, freq(root, oct), { gain: 0.1, attack: 0.05, decay: 1.4, harmonics: [1, 0.3] });
    if (b % 2 === 1) [[0.5, "E", 5], [1.5, "G", 5], [2.5, "C", 5]].forEach(([k, nt, o]) => t.addTone(t0 + k * beat, 0.5, freq(nt, o), { gain: 0.05, decay: 0.4 }));
  }
  t.finish(0.8);
  saveWav("music-calm", t);
}

// ============ 3. CURIOUS LOOP — plucky pizzicato discovery (D-Bm-G-A, 95 bpm) ============
{
  const bpm = 95, beat = 60 / bpm, bar = beat * 4, bars = 8;
  const t = new Track(bars * bar + 1);
  const prog = [["D", 3], ["B", 2], ["G", 2], ["A", 2]];
  const chordTones = { D: ["D", "Fs", "A"], B: ["B", "D", "Fs"], G: ["G", "B", "D"], A: ["A", "Cs", "E"] };
  for (let b = 0; b < bars; b++) {
    const [root, oct] = prog[b % 4];
    const t0 = b * bar, tones = chordTones[root];
    t.addTone(t0, beat * 1.8, freq(root, oct), { gain: 0.14, decay: 0.5, harmonics: [1, 0.3] });
    for (let k = 0; k < 4; k++) {
      const nt = tones[k % 3];
      t.addTone(t0 + k * beat + (k % 2) * beat * 0.5, 0.24, freq(nt, oct + 2), { gain: 0.06, decay: 0.11 });
    }
    const mel = [[0, "F", 5], [0.75, "A", 5], [1.5, "D", 6], [2.5, "B", 5], [3, "A", 5]];
    mel.forEach(([k, nt, o]) => t.addTone(t0 + k * beat, 0.3, freq(nt, o), { gain: 0.06, decay: 0.2 }));
  }
  t.finish();
  saveWav("music-curious", t);
}

// ============ 4. EPIC SHORT — outro sting (rising, 1 bar hits) ============
{
  const beat = 0.5, bars = 4;
  const t = new Track(bars * beat * 4 + 1);
  const roots = ["C", "C", "F", "G"];
  roots.forEach((root, b) => {
    const t0 = b * beat * 4;
    ["C", "E", "G"].forEach((nt, j) => t.addTone(t0, beat * 3.6, freq(nt === "C" ? root : nt, 3 + (j === 0 ? 0 : 1)), { gain: 0.09, attack: 0.03, decay: 1.2 }));
    if (b === 3) ["C", "E", "G", "C"].forEach((nt, j) => t.addTone(t0 + j * beat * 0.5, 0.5, freq(nt, 4 + j * 0.2), { gain: 0.1, decay: 0.5 }));
  });
  t.finish(0.5);
  saveWav("music-outro", t);
}

// ============ SFX ============
{
  // pop
  const t = new Track(0.3);
  t.addTone(0, 0.12, 620, { gain: 0.5, attack: 0.002, decay: 0.045, harmonics: [1, 0.3] });
  t.addTone(0.02, 0.1, 940, { gain: 0.25, attack: 0.002, decay: 0.05 });
  t.finish(0.05); saveWav("sfx-pop", t);
}
{
  // ding (correct!)
  const t = new Track(0.9);
  t.addTone(0, 0.8, 1318.5, { gain: 0.3, attack: 0.002, decay: 0.4 });
  t.addTone(0, 0.7, 1975.5, { gain: 0.12, attack: 0.002, decay: 0.3 });
  t.finish(0.1); saveWav("sfx-ding", t);
}
{
  // whoosh (transition)
  const t = new Track(0.7);
  t.addNoise(0, 0.65, { gain: 0.5, decay: 0.5, lp: 0.25 });
  t.finish(0.08); saveWav("sfx-whoosh", t);
}
{
  // sparkle
  const t = new Track(0.8);
  [1568, 2093, 2637, 3136].forEach((f, i) => t.addTone(i * 0.07, 0.4, f, { gain: 0.14, attack: 0.002, decay: 0.18 }));
  t.finish(0.08); saveWav("sfx-sparkle", t);
}
{
  // boing (jump)
  const t = new Track(0.6);
  for (let i = 0; i < 30; i++) {
    const f = 300 + 260 * Math.exp(-i * 0.16) * Math.cos(i * 0.55);
    t.addTone(i * 0.012, 0.05, Math.abs(f) + 90, { gain: 0.24, attack: 0.002, decay: 0.05 });
  }
  t.finish(0.05); saveWav("sfx-boing", t);
}
console.log("ALL AUDIO DONE");
