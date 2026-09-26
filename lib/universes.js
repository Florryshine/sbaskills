export const COURSE_UNIVERSES = [
  { key: 'JAMB', label: 'JAMB' },
  { key: 'WAEC_NECO', label: 'WAEC & NECO' },
  { key: 'POST_UTME', label: 'POST-UTME' },
  { key: 'UNIVERSITY', label: 'UNIVERSITY' },
  { key: 'AI_SKILLS', label: 'AI & SKILLS' },
  { key: 'GENERAL', label: 'General / Unassigned' },
];

export const STUDENT_UNIVERSES = COURSE_UNIVERSES.filter((universe) => universe.key !== 'GENERAL');

export function getUniverse(key) {
  return STUDENT_UNIVERSES.find((universe) => universe.key === key) || null;
}

export function getUniverseLabel(key) {
  return COURSE_UNIVERSES.find((universe) => universe.key === key)?.label || 'General / Unassigned';
}
