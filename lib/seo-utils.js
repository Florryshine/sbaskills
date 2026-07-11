// lib/seo-utils.js

/**
 * Sanitize a string for use in URLs / filenames.
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')          // remove all non-alphanumeric except spaces
    .trim()
    .replace(/\s+/g, '-');              // replace spaces with hyphens
}

/**
 * Generate a full file name for a study note PDF.
 * Example: "chemistry-discovery-of-atomic-structure-models-revision-notes-shiney-brain-academy.pdf"
 */
export function generatePdfFileName(title, suffix = 'shiney-brain-academy') {
  const slug = slugify(title);
  // Add a short timestamp to avoid collisions if two notes have same title
  const ts = Date.now().toString().slice(-6);
  return `${slug}-${suffix}-${ts}.pdf`;
}