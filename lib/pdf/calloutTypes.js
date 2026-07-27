// lib/pdf/calloutTypes.js
// Metadata for reusable ":::type ... :::" blocks. Add a new one here and
// it's usable immediately in both the markdown parser and the PDF
// renderer — no other code needs to change.

export const calloutTypes = {
  summary:   { icon: '📘', label: 'Summary',           colorRole: 'primary' },
  tip:       { icon: '💡', label: 'Tip',                colorRole: 'accent' },
  warning:   { icon: '⚠️', label: 'Warning',            colorRole: 'warning' },
  memory:    { icon: '🧠', label: 'Memory Trick',       colorRole: 'primary' },
  challenge: { icon: '🎯', label: 'Challenge',          colorRole: 'accent' },
  exercise:  { icon: '📝', label: 'Exercise',           colorRole: 'primary' },
  takeaway:  { icon: '⭐', label: 'Key Takeaway',        colorRole: 'accent' },
  further:   { icon: '📚', label: 'Further Reading',    colorRole: 'muted' },
};

export function getCalloutType(key) {
  return calloutTypes[key] || { icon: '📌', label: key, colorRole: 'primary' };
}
