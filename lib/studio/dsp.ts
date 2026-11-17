/**
 * Audio DSP utilities — pitch shifting, time stretching, F0 detection,
 * WAV encoding and reverb impulse generation. All pure TypeScript, runs
 * identically in the browser; no native dependencies.
 */

/** Resample (varispeed) a buffer: playback speed ratio r multiplies pitch by r. */
export function varispeed(data: Float32Array, r: number): Float32Array {
  const outLen = Math.max(1, Math.floor(data.length / r));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * r;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = data[Math.min(i0, data.length - 1)];
    const b = data[Math.min(i0 + 1, data.length - 1)];
    out[i] = a + (b - a) * frac;
  }
  return out;
}

function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/**
 * Granular time stretch: factor r changes duration (x r) while keeping pitch.
 * Output hop is constant; input hop is compressed/expanded by 1/r.
 */
export function timeStretch(data: Float32Array, r: number, rate: number): Float32Array {
  const L = Math.max(256, Math.round(rate * 0.05));
  const hopOut = Math.floor(L / 2);
  const hopIn = Math.max(1, Math.floor(hopOut / r));
  const outLen = Math.max(L, Math.round(data.length * r));
  const out = new Float32Array(outLen + L);
  const win = hann(L);
  const grain = new Float32Array(L);
  for (let k = 0; ; k++) {
    const inStart = k * hopIn;
    const outStart = k * hopOut;
    if (outStart >= outLen || inStart >= data.length) break;
    for (let i = 0; i < L; i++) {
      const src = Math.min(data.length - 1, inStart + i);
      grain[i] = data[src];
    }
    for (let i = 0; i < L; i++) {
      if (outStart + i < out.length) out[outStart + i] += grain[i] * win[i];
    }
  }
  return out.slice(0, outLen);
}

/** Pitch shift by ratio r preserving duration. */
export function pitchShift(data: Float32Array, r: number, rate: number): Float32Array {
  if (Math.abs(r - 1) < 0.01) return data;
  return timeStretch(varispeed(data, r), r, rate);
}

/**
 * Detect the median F0 of the most voiced frames via autocorrelation.
 * Returns 0 when the buffer is unvoiced/silent.
 */
export function detectF0(data: Float32Array, rate: number): number {
  const minF = 70, maxF = 500;
  const minLag = Math.floor(rate / maxF);
  const maxLag = Math.min(Math.floor(rate / minF), Math.floor(data.length / 2));
  if (maxLag <= minLag) return 0;
  const frameLen = Math.min(2048, data.length);
  const f0s: number[] = [];
  const frames = Math.min(7, Math.max(1, Math.floor((data.length - frameLen) / 512) + 1));
  for (let f = 0; f < frames; f++) {
    const start = Math.floor((data.length - frameLen) * (f / Math.max(1, frames - 1 || 1)));
    let energy = 0;
    for (let i = 0; i < frameLen; i++) energy += data[start + i] * data[start + i];
    if (energy / frameLen < 1e-5) continue;
    let bestLag = 0, bestCorr = 0;
    let norm = 0;
    for (let i = 0; i < frameLen; i++) norm += data[start + i] * data[start + i];
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i + lag < frameLen; i++) corr += data[start + i] * data[start + i + lag];
      corr /= norm || 1;
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    if (bestCorr > 0.3 && bestLag > 0) f0s.push(rate / bestLag);
  }
  if (!f0s.length) return 0;
  f0s.sort((a, b) => a - b);
  return f0s[Math.floor(f0s.length / 2)];
}

export function normalize(data: Float32Array, peak = 0.92): Float32Array {
  let max = 0;
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
  if (max < 1e-6) return data;
  const g = peak / max;
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] * g;
  return out;
}

/** Trim leading/trailing silence below threshold. */
export function trimSilence(data: Float32Array, threshold = 0.01): Float32Array {
  let start = 0, end = data.length - 1;
  while (start < end && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  return data.slice(Math.max(0, start - 64), Math.min(data.length, end + 256));
}

/* ------------------------------------------------------------------ */
/* WAV encoding / decoding                                              */
/* ------------------------------------------------------------------ */

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const bytesPerSample = 2;
  const dataSize = len * numCh * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numCh * bytesPerSample, true);
  view.setUint16(32, numCh * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/** Parse a mono 16-bit PCM WAV (what espeak-ng emits) into Float32 + rate. */
export function decodeMonoWav(bytes: ArrayBuffer): { data: Float32Array; rate: number } {
  const view = new DataView(bytes);
  const str = (off: number, n: number) => {
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(view.getUint8(off + i));
    return s;
  };
  let off = 12;
  let rate = 22050, bits = 16, channels = 1;
  let dataOff = -1, dataLen = 0;
  while (off + 8 <= view.byteLength) {
    const id = str(off, 4);
    const size = view.getUint32(off + 4, true);
    if (id === 'fmt ') {
      channels = view.getUint16(off + 10, true);
      rate = view.getUint32(off + 12, true);
      bits = view.getUint16(off + 22, true);
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = size;
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (dataOff < 0) return { data: new Float32Array(0), rate };
  const n = Math.floor(dataLen / (bits / 8) / channels);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (bits === 16) {
      data[i] = view.getInt16(dataOff + i * 2 * channels, true) / 32768;
    } else {
      data[i] = (view.getUint8(dataOff + i * channels) - 128) / 128;
    }
  }
  return { data, rate };
}

/* ------------------------------------------------------------------ */
/* Reverb                                                               */
/* ------------------------------------------------------------------ */

export function makeImpulseResponse(ctx: BaseAudioContext, seconds = 1.6, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x3fffffff) - 1;
  };
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (rand() * 0.5 + (i < rate * 0.01 ? 0.5 : 0)) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const ab = new ArrayBuffer(bin.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return ab;
}
