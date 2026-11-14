/* Sanity check: parse + sample every registered illustration. */
import { getIllustration, listIllustrationIds } from './src/illustrations/registry';
import { sampleIllustration } from './src/geometry/path-sample';
import { getTheme, resolveColor } from './src/themes';

const theme = getTheme('general');
const resolver = (c?: string) => resolveColor(theme, c);

const ids = listIllustrationIds();
let errors = 0;
for (const id of ids) {
  const ill = getIllustration(id);
  if (!ill) {
    console.log('MISSING:', id);
    errors++;
    continue;
  }
  try {
    const sampled = sampleIllustration(ill, resolver);
    const nan = sampled.strokes.some((s) => s.points.some((p) => !isFinite(p.x) || !isFinite(p.y)));
    const zero = sampled.strokes.filter((s) => s.length < 1).length;
    const badD = ill.strokes.filter((s) => /NaN|undefined/.test(s.d)).length;
    if (nan || zero > 0 || badD > 0) {
      console.log(`ISSUE ${id}: nan=${nan} zeroLen=${zero} badD=${badD} totalLen=${sampled.totalLength}`);
      errors++;
    } else {
      console.log(`OK ${id}: strokes=${sampled.strokes.length} totalLen=${sampled.totalLength}`);
    }
  } catch (e) {
    console.log(`ERROR ${id}: ${(e as Error).message}`);
    errors++;
  }
}
console.log(`\nTotal: ${ids.length} assets, ${errors} issues`);
