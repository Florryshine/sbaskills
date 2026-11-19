// Character presets — the default SBA cast. Server-side registry + lookup.
import type { CharacterDNA } from "../types";

export const CHARACTER_PRESETS: Record<string, { name: string; dna: CharacterDNA }> = {
  tobi: { name: "Tobi", dna: { skin: "#8a5a3b", hairStyle: "short-curls", hairColor: "#171114", outfit: "hoodie", topColor: "#1a73e8", bottomColor: "#2c3a4d", shoeColor: "#f5f5f0", accentColor: "#FFCC00", height: 1.0, headScale: 1.0, bodyWidth: 1.0, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  ada: { name: "Ada", dna: { skin: "#7c4a2d", hairStyle: "afro-puff", hairColor: "#241a12", outfit: "pinafore", topColor: "#e85d75", bottomColor: "#3b2f8f", shoeColor: "#ffffff", accentColor: "#ffd166", height: 0.97, headScale: 1.06, bodyWidth: 0.95, glasses: false, earrings: true, freckles: false, blush: true, voice: "tongtong" } },
  chidi: { name: "Chidi", dna: { skin: "#6b3f22", hairStyle: "buzz", hairColor: "#120d0a", outfit: "lab-coat", topColor: "#fafafa", bottomColor: "#33475b", shoeColor: "#333333", accentColor: "#39b58a", height: 1.05, headScale: 0.96, bodyWidth: 1.05, glasses: true, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  zainab: { name: "Zainab", dna: { skin: "#a0714f", hairStyle: "headwrap", hairColor: "#2b2118", wrapColor: "#c25e8e", outfit: "skirt-blouse", topColor: "#8ecf6f", bottomColor: "#4d9de0", shoeColor: "#f2e9dc", accentColor: "#ffffff", height: 1.0, headScale: 1.0, bodyWidth: 0.95, glasses: false, earrings: true, freckles: false, blush: true, voice: "tongtong" } },
  emeka: { name: "Emeka", dna: { skin: "#5e3419", hairStyle: "fade", hairColor: "#0f0b08", outfit: "sports", topColor: "#f4a300", bottomColor: "#274060", shoeColor: "#ffffff", accentColor: "#e85d75", height: 1.08, headScale: 0.94, bodyWidth: 1.12, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  ngozi: { name: "Ngozi", dna: { skin: "#91613e", hairStyle: "braids", hairColor: "#1d1512", outfit: "dress", topColor: "#7a4dd8", bottomColor: "#7a4dd8", shoeColor: "#ffe3ec", accentColor: "#ffd166", height: 0.99, headScale: 1.03, bodyWidth: 0.97, glasses: false, earrings: true, freckles: true, blush: true, voice: "tongtong" } },
  musa: { name: "Musa", dna: { skin: "#8d5a3a", hairStyle: "short-curls", hairColor: "#161210", outfit: "shirt-trousers", topColor: "#4fb3a9", bottomColor: "#5b4636", shoeColor: "#3a2f28", accentColor: "#ffffff", height: 1.02, headScale: 0.98, bodyWidth: 1.0, glasses: false, earrings: false, freckles: false, blush: false, voice: "tongtong" } },
  kemi: { name: "Kemi", dna: { skin: "#b07a52", hairStyle: "buns", hairColor: "#231a13", outfit: "tshirt", topColor: "#ff8c42", bottomColor: "#2f6690", shoeColor: "#ffffff", accentColor: "#3a86ff", height: 0.95, headScale: 1.1, bodyWidth: 0.92, glasses: true, earrings: false, freckles: true, blush: true, voice: "tongtong" } },
};

export function resolveDNA(presetKey?: string, dna?: CharacterDNA): CharacterDNA {
  const base = (presetKey && CHARACTER_PRESETS[presetKey]?.dna) || CHARACTER_PRESETS.tobi.dna;
  return { ...base, ...(dna || {}) };
}

export function presetName(presetKey?: string): string {
  return (presetKey && CHARACTER_PRESETS[presetKey]?.name) || "Character";
}
