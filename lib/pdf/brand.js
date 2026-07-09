// lib/pdf/brand.js
// Single source of truth for SBA branding across every PDF document.
// Change colors, contact info, or copy here — every document picks it up.

const brand = {
  name: 'Shiney Brain Academy',
  website: 'shineybrainacademy.vercel.app',
  phone: '08138082009 / 09053626267',
  colors: {
    primary: '#0A1F44',   // navy
    secondary: '#D4AF37', // gold
    text: '#1a1a1a',
    muted: '#666666',
  },
  about: [
    'Shiney Brain Academy helps Nigerian students prepare for JAMB, WAEC, NECO, and Post-UTME with quizzes, boss battles, flashcards, and exam-focused study notes.',
    'Visit shineybrainacademy.vercel.app or call 08138082009 / 09053626267 to join our next bootcamp.',
  ],
};

export default brand;
