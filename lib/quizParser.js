// Shared quiz-question parser. Every function returns { questions, skipped } and never guesses an answer.
const LETTERS = ['a', 'b', 'c', 'd'];
const RE_QUESTION_START = /^(?:q(?:uestion)?\s*(\d+)\s*[).:/-]?|(\d+)\s*[).])\s*(.*)$/i;
const RE_OPTION = /^\(?([A-Da-d])\s*[).:\-]\s*(.+)$/;
const RE_ANSWER = /^(?:correct\s+)?(?:answer|ans)\s*[:=\-]?\s*\(?([A-Da-d])\)?(?![A-Za-z0-9])/i;
const RE_EXPLANATION = /^(?:explanation|solution|rationale|reason)\s*[:\-]?\s*(.*)$/i;
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function finish(draft, questions, skipped) {
  const q = {
    question: clean(draft.questionLines.join(' ')),
    option_a: clean(draft.options.a), option_b: clean(draft.options.b),
    option_c: clean(draft.options.c), option_d: clean(draft.options.d),
    correct_answer: draft.answer || '', explanation: draft.explanationLines.join('\n').trim(), points: 1,
  };
  const missing = [];
  if (!q.question) missing.push('question text');
  LETTERS.forEach(l => { if (!q[`option_${l}`]) missing.push(`option ${l.toUpperCase()}`); });
  if (!q.correct_answer) missing.push('Answer line');
  if (missing.length) skipped.push({ number: draft.number, reason: `Missing ${missing.join(', ')}` });
  else questions.push(q);
}
export function parseQuizTxt(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const questions = [], skipped = [];
  let draft = null, number = 0, lastOption = null, mode = 'question';
  const flush = () => { if (draft) finish(draft, questions, skipped); draft = null; lastOption = null; mode = 'question'; };
  const nextHasOptions = from => {
    for (let j = from + 1, seen = 0; j < lines.length && seen < 6; j++) {
      const t = lines[j].trim(); if (!t) continue; seen++;
      if (RE_OPTION.test(t)) return true;
      if (RE_QUESTION_START.test(t)) return false;
    }
    return false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(), qm = line.match(RE_QUESTION_START);
    const plainNumber = qm && qm[2] ? parseInt(qm[2], 10) : null;
    const looksLikeListItem = mode === 'explanation' && plainNumber !== null && (plainNumber !== number + 1 || !nextHasOptions(i));
    if (line && qm && !looksLikeListItem) {
      flush(); number++; draft = { number, questionLines: [], options: {}, answer: '', explanationLines: [] };
      if (qm[3]) draft.questionLines.push(qm[3].replace(/^\s*\/\s*/, '').replace(/\s*\/\s*$/, ''));
      continue;
    }
    if (!draft) continue;
    if (!line) { if (mode === 'explanation' && draft.explanationLines.length) draft.explanationLines.push(''); continue; }
    const am = line.match(RE_ANSWER);
    if (am) {
      draft.answer = am[1].toLowerCase(); mode = 'explanation'; lastOption = null;
      const rest = line.slice(am[0].length).trim();
      const inlineExplanation = rest.match(RE_EXPLANATION);
      if (inlineExplanation && inlineExplanation[1]) draft.explanationLines.push(inlineExplanation[1]);
      continue;
    }
    const em = line.match(RE_EXPLANATION);
    if (em && (mode === 'explanation' || draft.answer || /^[a-z]+\s*[:\-]/i.test(line))) {
      mode = 'explanation'; lastOption = null; if (em[1]) draft.explanationLines.push(em[1]); continue;
    }
    if (mode !== 'explanation') {
      const om = line.match(RE_OPTION);
      if (om) { const letter = om[1].toLowerCase(); draft.options[letter] = om[2]; lastOption = letter; mode = 'options'; continue; }
      if (mode === 'options' && lastOption) draft.options[lastOption] += ' ' + line;
      else draft.questionLines.push(line);
      continue;
    }
    draft.explanationLines.push(line);
  }
  flush(); return { questions, skipped };
}
export function parseCsvRows(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false; else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = ''; if (row.some(c => c.trim() !== '')) rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell); if (row.some(c => c.trim() !== '')) rows.push(row); return rows;
}
const HEADER_ALIASES = {
  question: ['question', 'questions', 'q'],
  option_a: ['option_a', 'optiona', 'option a', 'a'], option_b: ['option_b', 'optionb', 'option b', 'b'],
  option_c: ['option_c', 'optionc', 'option c', 'c'], option_d: ['option_d', 'optiond', 'option d', 'd'],
  correct_answer: ['correct_answer', 'correctanswer', 'correct answer', 'answer', 'ans'],
  explanation: ['explanation', 'explanations', 'solution', 'rationale', 'reason'], points: ['points', 'point', 'marks'],
};
export function parseQuizObjects(objects) {
  const questions = [], skipped = [];
  objects.forEach((obj, idx) => {
    const normalised = {};
    Object.entries(obj).forEach(([k, v]) => { normalised[String(k).trim().toLowerCase()] = v; });
    const get = field => { for (const alias of HEADER_ALIASES[field]) if (normalised[alias] !== undefined && String(normalised[alias]).trim() !== '') return String(normalised[alias]).trim(); return ''; };
    const answerRaw = get('correct_answer'), answerMatch = answerRaw.match(/^\(?([A-Da-d])\)?(?![A-Za-z0-9])/);
    const q = { question: get('question'), option_a: get('option_a'), option_b: get('option_b'), option_c: get('option_c'), option_d: get('option_d'), correct_answer: answerMatch ? answerMatch[1].toLowerCase() : '', explanation: get('explanation'), points: parseInt(get('points'), 10) || 1 };
    const missing = [];
    if (!q.question) missing.push('question');
    LETTERS.forEach(l => { if (!q[`option_${l}`]) missing.push(`option ${l.toUpperCase()}`); });
    if (!q.correct_answer) missing.push(answerRaw ? `valid answer (got "${answerRaw.slice(0, 20)}")` : 'answer');
    if (missing.length) skipped.push({ number: idx + 1, reason: `Missing ${missing.join(', ')}` }); else questions.push(q);
  });
  return { questions, skipped };
}
export function parseQuizCsv(text) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return { questions: [], skipped: [] };
  const headers = rows[0].map(h => h.trim());
  const objects = rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
  return parseQuizObjects(objects);
}
