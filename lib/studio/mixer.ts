/**
 * Mixer — renders the complete song (vocals + instrumental) offline.
 *
 * Everything runs in an OfflineAudioContext, so a full 60-90 second song is
 * rendered many times faster than realtime, entirely in the browser, with
 * client-side instrumental rendering; only optional voice syllables are fetched from the configured TTS API.
 */
import type { SongSpec, Timeline } from './types';
import { buildArrangement } from './arranger';
import { playInstrumentEvent } from './instruments';
import { singTimeline } from './singer';
import { singViaTts, apiTtsProvider, remoteTtsProvider } from './tts';
import { makeImpulseResponse } from './dsp';

export interface MixOptions {
  intensity: number;
  ttsUrl?: string;
  onProgress?: (msg: string, percent: number) => void;
}

export interface MixResult {
  buffer: AudioBuffer;
  usedTts: boolean;
  ttsError?: string;
}

export async function renderSong(
  spec: SongSpec,
  timeline: Timeline,
  opts: MixOptions,
): Promise<MixResult> {
  const sampleRate = 44100;
  const tail = 1.6;
  const totalSec = timeline.durationSec + tail;
  const OfflineCtor: typeof OfflineAudioContext =
    (window as unknown as { OfflineAudioContext: typeof OfflineAudioContext }).OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new OfflineCtor(2, Math.ceil(totalSec * sampleRate), sampleRate);

  /* ---- bus architecture ---- */
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const masterComp = ctx.createDynamicsCompressor();
  masterComp.threshold.value = -10;
  masterComp.knee.value = 12;
  masterComp.ratio.value = 3.5;
  masterComp.attack.value = 0.008;
  masterComp.release.value = 0.18;
  master.connect(masterComp);

  // gentle limiter for safety (single path: comp -> limiter -> destination)
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    curve[i] = Math.tanh(x * 1.4) / Math.tanh(1.4);
  }
  shaper.curve = curve;
  masterComp.connect(shaper).connect(ctx.destination);

  /* instrumental bus */
  const instBus = ctx.createGain();
  instBus.gain.value = 0.48 + 0.18 * opts.intensity;
  const instComp = ctx.createDynamicsCompressor();
  instComp.threshold.value = -16;
  instComp.ratio.value = 4;
  instComp.attack.value = 0.006;
  instComp.release.value = 0.15;
  instBus.connect(instComp).connect(master);

  /* vocal bus with EQ, delay and reverb sends */
  const vocalBus = ctx.createGain();
  vocalBus.gain.value = 1.4;
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 100;
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking'; presence.frequency.value = 3000;
  presence.Q.value = 1; presence.gain.value = 2.5;
  const vComp = ctx.createDynamicsCompressor();
  vComp.threshold.value = -18;
  vComp.ratio.value = 3;
  vComp.attack.value = 0.005;
  vComp.release.value = 0.12;
  vocalBus.connect(hpf).connect(presence).connect(vComp).connect(master);

  const delaySend = ctx.createGain();
  const delay = ctx.createDelay(1);
  delay.delayTime.value = (60 / spec.tempoBpm) * 0.75;
  const fb = ctx.createGain(); fb.gain.value = 0.22;
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = 'lowpass'; delayFilter.frequency.value = 3000;
  delaySend.connect(delay).connect(delayFilter).connect(fb).connect(delay);
  delayFilter.connect(master);

  const reverbSend = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulseResponse(ctx, 1.7, 3);
  reverbSend.connect(convolver).connect(master);

  const vocalOut = ctx.createGain();
  vocalOut.connect(vocalBus);
  const vocalDelayTap = ctx.createGain(); vocalDelayTap.gain.value = 0.16;
  const vocalVerbTap = ctx.createGain(); vocalVerbTap.gain.value = 0.18;
  vocalOut.connect(vocalDelayTap).connect(delaySend);
  vocalOut.connect(vocalVerbTap).connect(reverbSend);

  /* ---- instrumental arrangement ---- */
  const events = buildArrangement(spec, timeline, opts.intensity);
  for (const ev of events) {
    playInstrumentEvent(ctx, instBus, ev);
  }

  /* ---- vocals ---- */
  let usedTts = false;
  let ttsError: string | undefined;
  if (spec.vocal.mode === 'tts') {
    try {
      const provider = opts.ttsUrl ? remoteTtsProvider(opts.ttsUrl) : apiTtsProvider();
      usedTts = await singViaTts(ctx, vocalOut, timeline, provider, opts.onProgress);
      if (!usedTts) ttsError = 'TTS engine returned incomplete syllable audio; using the built-in synth fallback';
    } catch (e) {
      ttsError = e instanceof Error ? e.message : 'TTS engine failed';
      opts.onProgress?.(`TTS unavailable (${ttsError}). Falling back to the built-in synth singer.`, 55);
    }
  }
  if (!usedTts) {
    singTimeline(ctx, vocalOut, timeline);
  }

  /* ---- section-aware master dynamics: duck slightly under vocals ---- */
  opts.onProgress?.('Mixing and rendering audio…', 70);
  const buffer = await ctx.startRendering();
  return { buffer, usedTts, ttsError };
}
