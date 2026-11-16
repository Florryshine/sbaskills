// Renders a set of sample notebook pages with the real renderer and checks edge cases.
//
//   node scripts/test-notebook-render.mjs [outputDir]
//
// Output defaults to ./tmp/notebook-samples. No Supabase or LLM access is needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(process.argv[2] || path.join(here, '..', 'tmp', 'notebook-samples'));
fs.mkdirSync(outDir, { recursive: true });

const { renderNotebookImage } = await import(pathToFileURL(path.join(here, '..', 'lib', 'notebook-studio', 'render.js')).href);

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => { warnings.push(args.join(' ')); };

const samples = {
  '01-lesson-biology': {
    title: 'Photosynthesis', subject: 'Biology', category: 'Lesson Notes', template: 'classic',
    sections: [
      { type: 'heading', text: 'What is Photosynthesis?' },
      { type: 'definition', text: 'Photosynthesis is the process by which green plants make glucose from carbon dioxide and water using light energy.' },
      { type: 'formula', text: '6CO2 + 6H2O → C6H12O6 + 6O2' },
      { type: 'subheading', text: 'Key Points' },
      { type: 'bullet', text: 'Occurs in chloroplasts containing chlorophyll.' },
      { type: 'bullet', text: 'Light reaction produces ATP and oxygen.' },
      { type: 'example', text: 'Example: A potted plant kept in the dark cannot make starch.' },
      { type: 'note', text: 'Exam trap: oxygen released comes from water, not carbon dioxide.' },
    ],
  },
  '02-question-physics': {
    title: 'Uniform Acceleration', subject: 'Physics', category: 'Question of the Day', template: 'premium',
    sections: [
      { type: 'question', text: 'A car accelerates uniformly from rest to 20 m/s in 5 s. What is its acceleration?' },
      { type: 'bullet', text: 'A) 2 m/s²' },
      { type: 'bullet', text: 'B) 4 m/s²' },
      { type: 'bullet', text: 'C) 5 m/s^2' },
      { type: 'bullet', text: 'D) 10 m/s^2' },
      { type: 'answer', text: 'Answer: B) 4 m/s^2' },
      { type: 'paragraph', text: 'Using a = (v − u)/t = (20 − 0)/5 = 4 m/s^2.' },
    ],
  },
  '03-revision-chemistry': {
    title: 'Acids, Bases and Salts', subject: 'Chemistry', category: 'Quick Revision', template: 'revision',
    sections: [
      { type: 'heading', text: 'Must-know facts' },
      { type: 'numbered', text: 'Acids turn blue litmus red; bases turn red litmus blue.' },
      { type: 'numbered', text: 'pH below 7 is acidic, 7 is neutral and above 7 is basic.' },
      { type: 'numbered', text: 'Neutralisation: acid + base → salt + water.' },
      { type: 'formula', text: 'HCl + NaOH → NaCl + H2O' },
      { type: 'formula', text: 'H2SO4 + Ca(OH)2 → CaSO4 + 2H2O' },
      { type: 'note', text: 'Common trap: a strong acid is not the same as a concentrated acid.' },
    ],
  },
  '04-math-symbols': {
    title: 'Inequalities and Indices', subject: 'Mathematics', category: 'Lesson Notes', template: 'classic',
    sections: [
      { type: 'heading', text: 'Reading symbols correctly' },
      { type: 'paragraph', text: 'If a < b and c > d then the order is kept. Also 5 * 3 * 2 = 30 and 10^-3 = 0.001.' },
      { type: 'paragraph', text: 'Distance: 1/2 × base × height, speed ≈ 3 × 10^8 m/s, angle = 90°, x ≤ 4, y ≥ −2.' },
      { type: 'formula', text: 'E = mc^2   and   v = u + at' },
    ],
  },
  '05-exam-tips-long': {
    title: 'Beating the JAMB Clock', subject: 'English Language', category: 'Exam Tips', template: 'classic',
    sections: [
      { type: 'heading', text: 'Manage your time' },
      { type: 'paragraph', text: 'Spend no more than one minute on any single question. If you are stuck, skip it, mark it lightly and return after you finish the rest of the paper.' },
      { type: 'subheading', text: 'Read before you choose' },
      { type: 'bullet', text: 'Read the whole passage once quickly, then read each question slowly before looking at the options.' },
      { type: 'bullet', text: 'Eliminate two clearly wrong options first; this doubles your chance when guessing.' },
      { type: 'bullet', text: 'Watch for words such as EXCEPT, NOT and LEAST because they reverse the question.' },
      { type: 'subheading', text: 'Stay calm' },
      { type: 'paragraph', text: 'Breathe slowly for ten seconds whenever panic starts. A calm candidate reads more accurately and makes fewer careless errors.' },
      { type: 'note', text: 'Never change an answer unless you can state a clear reason.' },
    ],
  },
};

const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name} ${detail}`.trim()); };

for (const [name, input] of Object.entries(samples)) {
  warnings.length = 0;
  const started = Date.now();
  try {
    const png = await renderNotebookImage(input);
    fs.writeFileSync(path.join(outDir, `${name}.png`), png);
    originalWarn(`ok    ${name}  ${(png.length / 1024).toFixed(0)} KB  ${Date.now() - started} ms${warnings.length ? `  warnings: ${warnings.join(' | ')}` : ''}`);
    check(`${name}: no dropped characters`, warnings.length === 0, warnings.join(' | '));
  } catch (error) {
    originalWarn(`FAIL  ${name}: ${error.message}`);
    failures.push(`${name}: ${error.message}`);
  }
}

// Unsupported characters must be reported, never silently produce a corrupted page.
warnings.length = 0;
await renderNotebookImage({ title: 'Symbols', subject: 'Physics', sections: [{ type: 'paragraph', text: 'Hello ☃ world' }, { type: 'paragraph', text: 'Second line' }, { type: 'paragraph', text: 'Third line' }] });
check('unsupported character is reported', warnings.some((w) => w.includes('☃')));

// Legacy records with only a text body must still render.
try {
  const png = await renderNotebookImage({ title: 'Legacy', subject: 'Biology', content: 'Cells\n- Cell wall\n- Membrane\n1) First\nPlain paragraph' });
  check('legacy content renders', png.length > 10000);
} catch (error) {
  failures.push(`legacy content: ${error.message}`);
}

// Content that cannot fit must fail loudly instead of truncating.
let overflowed = false;
try {
  await renderNotebookImage({
    title: 'Too long', subject: 'Biology',
    sections: Array.from({ length: 18 }, (_, i) => ({ type: 'paragraph', text: `Paragraph ${i + 1} ${'word '.repeat(60)}` })),
  });
} catch (error) {
  overflowed = /too long/i.test(error.message);
}
check('overflow is rejected with a clear error', overflowed);

console.warn = originalWarn;
if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nAll checks passed. Images written to ${outDir}`);
