/* Dry-run: parse all demo scripts + build timelines with synthetic narration. */
import { parseScript, findPhraseWordIndex } from './src/script/parser';
import { buildTimeline } from './src/timeline/builder';
import { proportionalWords } from './src/narration/align';

const scripts = [
  'demos/photosynthesis/script.txt',
  'demos/atomic-structure/script.txt',
  'demos/newtons-first-law/script.txt',
];

for (const path of scripts) {
  console.log(`\n=== ${path} ===`);
  const spec = parseScript(await Bun.file(path).text());
  const narration = spec.scenes.map((s, i) => {
    // ~13 words/sec pacing for dry-run
    const words = s.narration.trim().split(/\s+/).length;
    const duration = Math.max(3, (words / 2.6));
    return { audioFile: `narration/fake-${i}.wav`, duration, words: proportionalWords(s.narration, duration) };
  });
  const { timeline, warnings } = buildTimeline(spec, narration, { fps: 30 });
  console.log(`scenes=${timeline.scenes.length} total=${timeline.totalDuration.toFixed(1)}s`);
  for (const w of warnings) console.log('  WARN:', w);
  for (const s of timeline.scenes) {
    const els = s.elements.map((e) => `${e.spec.type}@${e.start}s(+${e.drawDuration}s)`).join(' ');
    console.log(`  ${s.id}: dur=${s.duration.toFixed(1)}s words=${s.words.length} | ${els}`);
    // verify sync mapping produced sensible times
    const bad = s.elements.filter((e) => e.start > s.duration - 0.3);
    if (bad.length) console.log(`    OVERFLOW: ${bad.map((b) => b.spec.id).join(', ')} (dur ${s.duration})`);
  }
}

// phrase matcher spot checks
const words = 'Here is the law. An object at rest stays at rest, and an object in motion stays in motion, unless acted on by an unbalanced force.'.split(/\s+/);
console.log('\nphrase checks:');
console.log('  "rest" →', findPhraseWordIndex(words, 'rest'));
console.log('  "motion" →', findPhraseWordIndex(words, 'motion'));
console.log('  "unbalanced force" →', findPhraseWordIndex(words, 'unbalanced force'));
console.log('  "missing phrase" →', findPhraseWordIndex(words, 'missing phrase'));
