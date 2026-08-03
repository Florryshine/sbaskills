// Shared CA + Exam -> total -> grade logic, so the report-card form, the
// API, and the PDF all agree on the same numbers. A school's grading scale
// is stored in `grading_scales` (seeded with a standard WAEC-style scale in
// the school_v2 migration); DEFAULT_SCALE below is only a client-side
// fallback for before that data has loaded.

export const DEFAULT_SCALE = [
  { min_score: 70, max_score: 100, grade: 'A1', remark: 'Excellent' },
  { min_score: 65, max_score: 69, grade: 'B2', remark: 'Very Good' },
  { min_score: 60, max_score: 64, grade: 'B3', remark: 'Good' },
  { min_score: 55, max_score: 59, grade: 'C4', remark: 'Credit' },
  { min_score: 50, max_score: 54, grade: 'C5', remark: 'Credit' },
  { min_score: 45, max_score: 49, grade: 'C6', remark: 'Credit' },
  { min_score: 40, max_score: 44, grade: 'D7', remark: 'Pass' },
  { min_score: 0, max_score: 39, grade: 'F9', remark: 'Fail' },
];

export function gradeFor(total, scale = DEFAULT_SCALE) {
  const n = Number(total) || 0;
  const row = scale.find(r => n >= r.min_score && n <= r.max_score);
  return row ? { grade: row.grade, remark: row.remark } : { grade: '-', remark: '-' };
}

// Normalizes one subject-score entry to always have ca1/ca2/exam/total/grade.
// Accepts either the new shape ({ca1, ca2, exam}) or the old shape
// ({score}) so existing rows in the DB keep rendering.
export function computeSubjectRow(entry, scale = DEFAULT_SCALE) {
  const ca1 = Number(entry.ca1) || 0;
  const ca2 = Number(entry.ca2) || 0;
  const exam = Number(entry.exam) || 0;
  const hasCaExam = entry.ca1 !== undefined || entry.ca2 !== undefined || entry.exam !== undefined;
  const total = hasCaExam ? ca1 + ca2 + exam : Number(entry.score) || 0;
  const { grade, remark } = gradeFor(total, scale);
  return {
    subject: entry.subject || '',
    ca1, ca2, exam, total,
    grade, remark: entry.remark || remark,
  };
}

// Given a list of students' subject_scores (already computed rows) for one
// class/term, returns { [studentId]: position } based on total-of-all-subjects,
// so "position in class" is computed rather than hand-typed. Ties share the
// same position (standard 1,2,2,4 style ranking).
export function computePositions(studentTotals) {
  // studentTotals: [{ student_id, total }]
  const sorted = [...studentTotals].sort((a, b) => b.total - a.total);
  const positions = {};
  let lastTotal = null;
  let lastPosition = 0;
  sorted.forEach((row, i) => {
    if (row.total !== lastTotal) {
      lastPosition = i + 1;
      lastTotal = row.total;
    }
    positions[row.student_id] = lastPosition;
  });
  return positions;
}

export function overallAverage(subjectRows) {
  if (!subjectRows.length) return 0;
  const sum = subjectRows.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  return Math.round((sum / subjectRows.length) * 10) / 10;
}
