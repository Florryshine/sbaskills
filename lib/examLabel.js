// lib/examLabel.js
// Personalization, not content duplication: one topic ("Cell" in Biology)
// gets labeled per the student's own exam track instead of forking content
// per exam. Reads profiles.target_exams — already collected at onboarding
// (JAMB/WAEC/NECO/GCE/BECE/University/Other, multi-select) — no new column.
//
// A student can select more than one exam. For a compact label we show
// their first/primary selection; formatContentLabelMulti() below covers
// the rare case you want to show all of them (e.g. "JAMB/WAEC: Cell in Biology").

const KNOWN_EXAMS = ['JAMB', 'WAEC', 'NECO', 'GCE', 'BECE'];

function primaryExam(targetExams) {
  if (!Array.isArray(targetExams) || targetExams.length === 0) return null;
  // Prefer a recognized core exam over "University"/"Other" if both are selected.
  return targetExams.find((e) => KNOWN_EXAMS.includes(e)) || targetExams[0];
}

/**
 * targetExams=['JAMB','WAEC'], topic="Cell", subject="Biology"
 * -> "JAMB: Cell in Biology"
 * Falls back to a generic "SBA:" prefix if onboarding hasn't run yet.
 */
export function formatContentLabel(targetExams, topic, subject) {
  const prefix = primaryExam(targetExams) || 'SBA';
  if (!topic) return `${prefix}${subject ? `: ${subject}` : ''}`;
  return `${prefix}: ${topic}${subject ? ` in ${subject}` : ''}`;
}

/**
 * Shows every exam the student picked, e.g. "JAMB/WAEC: Cell in Biology" —
 * use when it matters that the same content counts for all their exams.
 */
export function formatContentLabelMulti(targetExams, topic, subject) {
  const exams = (targetExams || []).filter((e) => KNOWN_EXAMS.includes(e));
  const prefix = exams.length ? exams.join('/') : 'SBA';
  if (!topic) return `${prefix}${subject ? `: ${subject}` : ''}`;
  return `${prefix}: ${topic}${subject ? ` in ${subject}` : ''}`;
}

/** Compact chip label: "JAMB", "WAEC", etc. */
export function examBadge(targetExams) {
  return primaryExam(targetExams) || 'SBA';
}
