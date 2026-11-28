import assert from 'node:assert/strict';
import { renderTegakiStyleImage, TEGAKI_RENDER_STYLES } from '../lib/tegaki-engine/render.js';

const sections = [
  { type: 'heading', text: 'What is a cell?' },
  { type: 'definition', text: 'A cell is the basic structural and functional unit of life.' },
  { type: 'subheading', text: 'Key facts' },
  { type: 'bullet', text: 'The membrane controls movement into and out of the cell.' },
  { type: 'bullet', text: 'The nucleus contains genetic material.' },
  { type: 'formula', text: '6CO2 + 6H2O -> C6H12O6 + 6O2' },
  { type: 'note', text: 'Remember: plant cells have a cellulose cell wall.' },
];

for (const style of TEGAKI_RENDER_STYLES) {
  const png = await renderTegakiStyleImage({
    styleId: style.id,
    title: 'Cell Structure and Functions',
    subject: 'Biology',
    sections,
  });
  assert.ok(png.length > 10_000, `${style.id} should render a substantial PNG`);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${style.id} should be a valid PNG`);
  console.log(`PASS ${style.id}: ${Math.round(png.length / 1024)} KB`);
}

await assert.rejects(
  () => renderTegakiStyleImage({ styleId: 'not-a-real-style', title: 'Test', sections }),
  /six supported Tegaki visual styles/i,
);
console.log('All six Tegaki visual-style fixtures passed.');
