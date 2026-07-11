// past_questions stores answers as a single letter ('a'|'b'|'c'|'d') in
// correct_answer, matched against option_a/b/c/d — same convention as the
// CSV-uploaded question bank. The AI generators (quiz + boss-battle) return
// correct_answer as the full text of the right option instead, so it has to
// be mapped to a letter before it's usable by app/boss/page.js,
// app/challenge/page.js, or any future CBT feature reading this table.
export function resolveCorrectLetter(options, correctAnswer) {
  const letters = ['a', 'b', 'c', 'd'];
  const opts = options || [];
  const idx = opts.findIndex(
    (o) => (o || '').trim().toLowerCase() === (correctAnswer || '').trim().toLowerCase()
  );
  if (idx !== -1) return letters[idx];
  const asLetter = (correctAnswer || '').trim().toLowerCase();
  if (letters.includes(asLetter)) return asLetter;
  return null;
}
