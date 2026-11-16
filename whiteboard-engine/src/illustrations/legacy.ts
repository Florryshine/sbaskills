// Converts an original SBA-authored SVG illustration into the v3 engine's
// existing traced-stroke + colour-layer representation. No new reveal mode:
// it deliberately uses the exact same traceImage pipeline as external images.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SBAIllustrationArtwork } from '../../../remotion/whiteboard/SBAAssetLibrary';
import { traceImage } from '../imagery/trace';
import type { IllustrationSpec } from '../types';
import { LEGACY_ASSETS, LEGACY_ALIASES, findLegacyAsset } from './legacy-catalog';

const cache = new Map<string, Promise<IllustrationSpec>>();

export function listLegacyIllustrationIds(): string[] {
  return LEGACY_ASSETS.map((asset) => `legacy.${asset.id}`);
}

export function suggestLegacyIllustrations(subject: string, keywords: string[]): string[] {
  const terms = keywords.map((k) => k.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()).filter(Boolean);
  return LEGACY_ASSETS.map((asset) => {
    const haystack = [asset.id.replace(/-/g, ' '), asset.name.toLowerCase(), ...asset.keywords].join(' ');
    let score = asset.category === subject ? 4 : 0;
    for (const term of terms) {
      if (term.length < 3) continue;
      if (haystack.includes(term)) score += 5;
      else if (term.split(' ').some((word) => word.length > 3 && haystack.includes(word))) score += 2;
    }
    return { id: `legacy.${asset.id}`, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map((item) => item.id);
}

export async function getLegacyIllustration(query: string): Promise<IllustrationSpec | null> {
  const raw = query.replace(/^legacy\./i, '').trim().toLowerCase();
  const alias = LEGACY_ALIASES[raw] ?? raw;
  const asset = findLegacyAsset(alias);
  if (!asset) return null;
  const id = `legacy.${asset.id}`;
  let pending = cache.get(id);
  if (!pending) {
    pending = (async () => {
      const svg = renderToStaticMarkup(
        React.createElement(SBAIllustrationArtwork, { type: asset.id, showLabel: true }),
      );
      const traced = await traceImage(Buffer.from(svg), { boxSize: 400, maxDim: 640 });
      return {
        id,
        box: traced.box,
        estLength: traced.totalLength,
        strokes: traced.strokes.map((stroke) => ({ d: stroke.d, width: 4.2, color: 'ink' })),
        colorLayer: traced.colorLayer,
      };
    })();
    cache.set(id, pending);
    pending.catch(() => cache.delete(id));
  }
  return pending;
}
