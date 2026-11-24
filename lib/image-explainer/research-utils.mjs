export function cleanResearchText(value, max = 240) {
  return typeof value === 'string'
    ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}

export function abstractFromInvertedIndex(index) {
  if (!index || typeof index !== 'object') return '';
  const words = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions || []) {
      if (Number.isInteger(position) && position >= 0 && position < 10000) words[position] = word;
    }
  }
  return cleanResearchText(words.filter(Boolean).join(' '), 1800);
}

export function buildResearchQueries(analysis, instruction = '') {
  const subject = cleanResearchText(analysis?.subject, 140);
  const components = (analysis?.components || [])
    .map((item) => cleanResearchText(item.name, 80))
    .filter(Boolean)
    .slice(0, 5);
  const candidates = [
    subject,
    ...components.map((name) => subject ? `${subject} ${name}` : name),
    cleanResearchText(instruction, 120),
  ].filter(Boolean);
  const seen = new Set();
  return candidates.filter((query) => {
    const key = query.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}
