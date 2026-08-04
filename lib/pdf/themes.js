// lib/pdf/themes.js
// Template selector for branded PDFs. Each theme keeps all of `brand`'s
// non-visual info (name, phone, email, website, about, founder, donation)
// and only overrides the visual bits: colors + page background.
// Existing callers that don't pass a theme keep getting the original
// look untouched (getTheme() defaults to 'brand').

import { brand } from './brand';

export const themes = {
  brand: {
    ...brand,
    key: 'brand',
    label: 'Shiney Brain Brand',
    primary: brand.primary,
    accent: brand.accent,
    muted: brand.muted,
    pageBackground: '#ffffff',
    textColor: '#1a1a1a',
    headerTextColor: '#ffffff',
  },
  modern: {
    ...brand,
    key: 'modern',
    label: 'Modern',
    primary: '#0f172a',
    accent: '#38bdf8',
    muted: '#64748b',
    pageBackground: '#ffffff',
    textColor: '#0f172a',
    headerTextColor: '#ffffff',
  },
  workbook: {
    ...brand,
    key: 'workbook',
    label: 'Student Workbook',
    primary: '#166534',
    accent: '#facc15',
    muted: '#4b5563',
    pageBackground: '#fffdf5',
    textColor: '#1a1a1a',
    headerTextColor: '#ffffff',
  },
  premium: {
    ...brand,
    key: 'premium',
    label: 'Premium Ebook',
    primary: '#111827',
    accent: '#c9a227',
    muted: '#6b7280',
    pageBackground: '#fbfaf7',
    textColor: '#111827',
    headerTextColor: '#f5f0e1',
  },
  minimal: {
    ...brand,
    key: 'minimal',
    label: 'Minimal',
    primary: '#1f2937',
    accent: '#9ca3af',
    muted: '#9ca3af',
    pageBackground: '#ffffff',
    textColor: '#1f2937',
    headerTextColor: '#ffffff',
  },
  dark: {
    ...brand,
    key: 'dark',
    label: 'Dark Mode',
    primary: '#0b0f19',
    accent: '#f59e0b',
    muted: '#9ca3af',
    pageBackground: '#111827',
    textColor: '#f3f4f6',
    headerTextColor: '#f3f4f6',
  },
};

export const themeList = Object.values(themes).map(t => ({ key: t.key, label: t.label }));

export function getTheme(key) {
  return themes[key] || themes.brand;
}
