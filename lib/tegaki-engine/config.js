/**
 * Shared Tegaki engine contract and visual style registry.
 */
export const TEGAKI_ENGINE = Object.freeze({
  id: 'tegaki',
  name: 'Tegaki Studio',
  route: '/admin/tegaki-studio',
  compositionTemplate: 'tegaki',
  defaultDurationSeconds: 40,
  supportedAspectRatios: ['9:16', '16:9', '1:1'],
  initialVisualStyle: 'classic-notebook',
});

export const TEGAKI_VISUAL_STYLES = Object.freeze([
  { id: 'classic-notebook', label: 'Classic Notebook', status: 'available', source: 'notebook-renderer' },
  { id: 'premium-notes', label: 'Premium Notes', status: 'available', source: 'notebook-renderer' },
  { id: 'exam-revision', label: 'Exam Revision', status: 'available', source: 'notebook-renderer' },
  { id: 'colourful-classroom', label: 'Colourful Classroom', status: 'available', source: 'tegaki-style-adapter' },
  { id: 'dark-chalkboard', label: 'Dark Chalkboard', status: 'available', source: 'tegaki-style-adapter' },
  { id: 'digital-study-pad', label: 'Digital Study Pad', status: 'available', source: 'tegaki-style-adapter' },
]);

export function createTegakiLessonScene(input = {}) {
  const text = String(input.text || '').trim();
  if (!text) throw new Error('A Tegaki lesson needs narration or handwritten lesson text.');
  const durationSeconds = Math.max(8, Math.min(180, Number(input.durationSeconds) || TEGAKI_ENGINE.defaultDurationSeconds));
  const illustrationCues = Array.isArray(input.illustrationCues) ? input.illustrationCues : [];
  return {
    id: input.id || 'tegaki-main-lesson',
    heading: String(input.heading || 'Your lesson title').trim(),
    text,
    narration: String(input.narration || text).trim(),
    durationSeconds,
    illustrationCues,
  };
}
