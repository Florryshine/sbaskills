/* Test edge-tts-universal word boundary timestamps in sandbox */
import { EdgeTTS } from 'edge-tts-universal';

const text = 'Photosynthesis is the process by which green plants manufacture their own food. Sunlight provides the energy for this process.';

const tts = new EdgeTTS(text, 'en-NG-EzinneNeural', { rate: '+0%', volume: '+0%', pitch: '+0Hz' });
const result = await tts.synthesize();

const buffer = Buffer.from(await result.audio.arrayBuffer());
const subtitle = result.subtitle || [];

console.log('AUDIO_BYTES:', buffer.length);
console.log('SUBTITLE_ENTRIES:', subtitle.length);
console.log('FIRST_6:', JSON.stringify(subtitle.slice(0, 6)));

const TICKS = 10_000_000;
if (subtitle.length > 0) {
  const last = subtitle[subtitle.length - 1];
  console.log('TOTAL_SPEECH_SEC:', ((last.offset + last.duration) / TICKS).toFixed(2));
  console.log('WORDS_WITH_TIMING:', subtitle.map(w => `${w.text || w.Word || '?'}@${(w.offset / TICKS).toFixed(2)}`).slice(0, 12).join(' | '));
}
await Bun.write('tts-test.mp3', buffer);
console.log('SAVED tts-test.mp3');
