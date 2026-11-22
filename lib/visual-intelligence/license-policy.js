// lib/visual-intelligence/license-policy.js
//
// HARD eligibility rules for externally sourced visuals. License gating is not
// advisory: a candidate that fails this policy is never eligible for the
// permanent library and never auto-staged for a render, no matter how good
// the visual match is.
//
// Policy defaults for SBA (educational platform, monetised courses):
//   - Commercial use must be allowed (courses are sold).
//   - Attribution is acceptable when we can store the credit string.
//   - ShareAlike is acceptable with attribution + a note (we still record it).
//   - NonCommercial / NoDerivs are rejected by default. NoDerivs would forbid
//     the adaptations the engines make (crop, recolour, composite); NC is
//     rejected because SBA content sits behind paid products.
//   - Unknown licenses are "uncertain": usable temporarily (ephemeral tier B)
//     with license_review=true, but only an admin approval puts them in the
//     permanent library.

export const POLICY_VERSION = 1;

const LICENSE_RULES = {
  'CC0': { id: 'CC0', commercial: true, attribution: 'not-required', derivatives: true, shareAlike: false },
  'PDM': { id: 'PDM', commercial: true, attribution: 'not-required', derivatives: true, shareAlike: false },
  'PD': { id: 'PD', commercial: true, attribution: 'not-required', derivatives: true, shareAlike: false },
  'PUBLIC-DOMAIN': { id: 'PD', commercial: true, attribution: 'not-required', derivatives: true, shareAlike: false },
  'CC-BY': { id: 'CC-BY', commercial: true, attribution: 'required', derivatives: true, shareAlike: false },
  'CC-BY-SA': { id: 'CC-BY-SA', commercial: true, attribution: 'required', derivatives: true, shareAlike: true },
  'CC-BY-NC': { id: 'CC-BY-NC', commercial: false, attribution: 'required', derivatives: true, shareAlike: false },
  'CC-BY-ND': { id: 'CC-BY-ND', commercial: true, attribution: 'required', derivatives: false, shareAlike: false },
  'CC-BY-NC-SA': { id: 'CC-BY-NC-SA', commercial: false, attribution: 'required', derivatives: true, shareAlike: true },
  'CC-BY-NC-ND': { id: 'CC-BY-NC-ND', commercial: false, attribution: 'required', derivatives: false, shareAlike: false },
  'PEXELS': { id: 'PEXELS', commercial: true, attribution: 'optional', derivatives: true, shareAlike: false },
  'PIXABAY': { id: 'PIXABAY', commercial: true, attribution: 'optional', derivatives: true, shareAlike: false },
  'SBA-ORIGINAL': { id: 'SBA-ORIGINAL', commercial: true, attribution: 'not-required', derivatives: true, shareAlike: false },
};

export function classifyLicense(licenseText) {
  const raw = String(licenseText || '').trim();
  const upper = raw.toUpperCase();

  if (!raw || /^(unknown|unspecified|see source|see file page|custom|other)/i.test(upper)) {
    return { status: 'unknown', rule: null, license: raw || 'Unknown', reasons: ['License could not be identified from provider metadata.'] };
  }
  // Wikimedia often returns e.g. "CC BY-SA 4.0", "Public domain", "CC BY 2.5".
  const has = (s) => upper.includes(s);
  if (has('CC0') || /NO\s*KNOWN\s*COPYRIGHT|PUBLIC\s*DOMAIN|^PD$/.test(upper)) return { status: 'allowed', rule: LICENSE_RULES.CC0, license: raw, reasons: [] };
  if (has('BY-NC-ND')) return { status: 'rejected', rule: LICENSE_RULES['CC-BY-NC-ND'], license: raw, reasons: ['NonCommercial and NoDerivs license: forbidden by default policy.'] };
  if (has('BY-NC-SA')) return { status: 'rejected', rule: LICENSE_RULES['CC-BY-NC-SA'], license: raw, reasons: ['NonCommercial + ShareAlike license: forbidden by default policy.'] };
  if (has('BY-NC')) return { status: 'rejected', rule: LICENSE_RULES['CC-BY-NC'], license: raw, reasons: ['NonCommercial license: forbidden by default policy.'] };
  if (has('BY-ND')) return { status: 'rejected', rule: LICENSE_RULES['CC-BY-ND'], license: raw, reasons: ['NoDerivs license: engines must be able to adapt visuals (crop/recolour), so ND is forbidden.'] };
  if (has('BY-SA')) return { status: 'allowed', rule: LICENSE_RULES['CC-BY-SA'], license: raw, reasons: ['ShareAlike applies: attribution must be stored and the license passed through.'] };
  if (has('BY') || has('ATTRIBUTION')) return { status: 'allowed', rule: LICENSE_RULES['CC-BY'], license: raw, reasons: ['Attribution required: credit string must be stored with the asset.'] };
  if (has('PEXELS')) return { status: 'allowed', rule: LICENSE_RULES.PEXELS, license: raw, reasons: [] };
  if (has('PIXABAY')) return { status: 'allowed', rule: LICENSE_RULES.PIXABAY, license: raw, reasons: [] };
  if (has('SBA ORIGINAL')) return { status: 'allowed', rule: LICENSE_RULES['SBA-ORIGINAL'], license: raw, reasons: [] };
  return { status: 'unknown', rule: null, license: raw, reasons: [`License "${raw}" is not in the policy table.`] };
}

/**
 * Hard gate. Returns { eligible, status, rule, license, reasons }.
 * opts.allowNonCommercial  — caller explicitly accepts NC (rare; logged).
 * opts.allowNoDerivs       — caller explicitly accepts ND.
 */
export function evaluateLicense(licenseText, opts = {}) {
  const cls = classifyLicense(licenseText);
  if (cls.status !== 'allowed') return cls;
  const rule = cls.rule;
  const reasons = [...cls.reasons];
  if (!rule.commercial && !opts.allowNonCommercial) {
    return { ...cls, status: 'rejected', reasons: [...reasons, 'Commercial use not permitted by this license.'] };
  }
  if (rule.derivatives === false && !opts.allowNoDerivs) {
    return { ...cls, status: 'rejected', reasons: [...reasons, 'Derivative/adapted use not permitted by this license.'] };
  }
  return cls;
}

/** Attribution string an engine should embed when attributionRequired. */
export function buildAttribution({ creator, source, license, pageUrl }) {
  const credit = creator ? String(creator).trim() : source || 'Unknown creator';
  const lic = license ? ` — ${license}` : '';
  const link = pageUrl ? ` (${pageUrl})` : '';
  return `${credit} / ${source || 'external'}${lic}${link}`.trim();
}
