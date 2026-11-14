// src/illustrations/registry.ts — asset registry + lookup with alias support.

import type { IllustrationSpec, Subject } from '../types';
import { BIOLOGY_ASSETS } from './biology';
import { CHEMISTRY_ASSETS, bohrAtom } from './chemistry';
import { PHYSICS_ASSETS } from './physics';
import { GENERAL_ASSETS } from './general';
import { MATHEMATICS_ASSETS } from './mathematics';

const BY_ID = new Map<string, IllustrationSpec>();

function register(list: IllustrationSpec[]) {
  for (const a of list) BY_ID.set(a.id, a);
}

register(BIOLOGY_ASSETS);
register(CHEMISTRY_ASSETS);
register(PHYSICS_ASSETS);
register(GENERAL_ASSETS);
register(MATHEMATICS_ASSETS);

// Parametrized extras
BY_ID.set('chemistry.bohr-2-8-8', bohrAtom([2, 8, 8], 'chemistry.bohr-2-8-8', 404));
BY_ID.set('chemistry.bohr-2-8', bohrAtom([2, 8], 'chemistry.bohr-2-8', 405));
BY_ID.set('chemistry.bohr-2-8-6', bohrAtom([2, 8, 6], 'chemistry.bohr-2-8-6', 406));

const ALIASES: Record<string, string> = {
  'biology.co2': 'biology.co2-cloud',
  'chemistry.co2': 'chemistry.co2-molecule',
  'chemistry.oxygen': 'chemistry.bohr-oxygen',
  'chemistry.carbon': 'chemistry.bohr-carbon',
  'chemistry.sodium': 'chemistry.bohr-sodium',
  'physics.table': 'physics.block-table',
  'physics.block': 'physics.crate',
  'physics.ball': 'physics.ball-rolling',
  'physics.puck': 'physics.ice-puck',
  'physics.spring': 'physics.spring-block',
  'general.idea': 'general.lightbulb',
  'general.bulb': 'general.lightbulb',
  'general.tick': 'general.check',
  'general.speech': 'general.speech-bubble',
  'math.graph': 'math.graph-line',
  'math.triangle': 'math.right-triangle',
};

/** Look up an illustration by id (alias-tolerant). Returns null when unknown. */
export function getIllustration(id: string): IllustrationSpec | null {
  const resolved = ALIASES[id] ?? id;
  return BY_ID.get(resolved) ?? null;
}

/** All registered ids — used in error messages. */
export function listIllustrationIds(): string[] {
  return Array.from(BY_ID.keys()).sort();
}

/** Suggest the closest registered ids for a keyword (used by the LLM planner prompt). */
export function suggestIllustrations(subject: Subject, keywords: string[]): string[] {
  const scored = Array.from(BY_ID.keys()).map((id) => {
    let score = 0;
    if (id.startsWith(`${subject}.`)) score += 3;
    const lower = id.toLowerCase();
    for (const kw of keywords) {
      const k = kw.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (k.length >= 3 && lower.includes(k)) score += 2;
    }
    return { id, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((s) => s.id);
}
