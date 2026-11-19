// Shared Visual Asset Library — SVG generation kit.
// Pure string builders (no React, no DOM, no server deps) so the same
// generators run on the server (asset storage), inside engines and in tests.
// Style: bright "sticker" cartoon — bold rounded ink outlines, soft
// gradients, painted highlights and shadows (no SVG filters: renders
// identically in Chrome, <img> tags and every downstream consumer).

export type Params = Record<string, string | number>;

export const INK = "#3d2f52"; // universal cartoon outline ink
export const INK_SOFT = "#5a4a74";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Deterministic PRNG (mulberry32 over a string seed) — same seed, same art. */
export function seededRand(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Full SVG document. Every generator returns via this — guarantees an
 * <svg> root (Chrome drops bare SVG children of divs) and an a11y label. */
export function doc(w: number, h: number, label: string, body: string, bg?: string): string {
  const bgRect = bg ? `<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${bgRect}${body}</svg>`;
}

export function lg(id: string, stops: Array<[string, number]>, angle = 90): string {
  const r = (angle * Math.PI) / 180;
  const x2 = +Math.cos(r).toFixed(3), y2 = +Math.sin(r).toFixed(3);
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">` +
    stops.map(([c, o]) => `<stop offset="${o}" stop-color="${c}"/>`).join("") + `</linearGradient>`;
}

export function rg(id: string, stops: Array<[string, number]>, cx = 0.35, cy = 0.3, r = 0.95): string {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">` +
    stops.map(([c, o]) => `<stop offset="${o}" stop-color="${c}"/>`).join("") + `</radialGradient>`;
}

export function defs(...parts: string[]): string {
  return parts.length ? `<defs>${parts.join("")}</defs>` : "";
}

// ---- primitive builders (all accept overrides, keep markup terse) ----

export function P(d: string, fill: string, sw = 10, o?: { stroke?: string; opacity?: number; dash?: string }): string {
  return `<path d="${d}" fill="${fill}" stroke="${o?.stroke ?? INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${o?.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o?.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
}

/** open stroked path (no fill) — veins, arrows, motion lines */
export function L(d: string, stroke: string, sw = 8, o?: { opacity?: number; cap?: string; dash?: string }): string {
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${o?.cap ?? "round"}" stroke-linejoin="round"${o?.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o?.dash ? ` stroke-dasharray="${o.dash}"` : ""}/>`;
}

export function C(cx: number, cy: number, r: number, fill: string, o?: { sw?: number; stroke?: string; opacity?: number }): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${o?.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 6}"` : ""}${o?.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}/>`;
}

export function E(cx: number, cy: number, rx: number, ry: number, fill: string, o?: { sw?: number; stroke?: string; opacity?: number; rot?: number }): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${o?.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 6}"` : ""}${o?.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o?.rot ? ` transform="rotate(${o.rot} ${cx} ${cy})"` : ""}/>`;
}

export function R(x: number, y: number, w: number, h: number, rx: number, fill: string, o?: { sw?: number; stroke?: string; opacity?: number; rot?: number }): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${o?.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 6}"` : ""}${o?.opacity !== undefined ? ` opacity="${o.opacity}"` : ""}${o?.rot ? ` transform="rotate(${o.rot} ${x + w / 2} ${y + h / 2})"` : ""}/>`;
}

/** painted ground shadow (portable — no SVG filters needed) */
export function shadow(cx: number, cy: number, rx: number, ry: number, opacity = 0.16): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1d1436" opacity="${opacity}"/>`;
}

/** specular highlight blob */
export function shine(cx: number, cy: number, rx: number, ry: number, rot = -28, opacity = 0.7): string {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#ffffff" opacity="${opacity}" transform="rotate(${rot} ${cx} ${cy})"/>`;
}

/** text label — diagrams only; generic stack renders everywhere */
export function T(x: number, y: number, size: number, fill: string, text: string, anchor = "middle", weight = 800): string {
  return `<text x="${x}" y="${y}" font-family="Nunito, 'Baloo 2', 'DejaVu Sans', sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" stroke="#ffffff" stroke-width="${Math.max(3, size * 0.14)}" paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>`;
}

/** small curved arrow — diagrams */
export function arrow(d: string, stroke: string, sw = 9, head = 16): string {
  const m = d.match(/([\d.\-]+) ([\d.\-]+)\s*$/);
  const [tx, ty] = m ? [+m[1], +m[2]] : [0, 0];
  return L(d, stroke, sw) +
    `<path d="M ${tx - head} ${ty - head * 0.4} L ${tx} ${ty} L ${tx - head * 0.35} ${ty + head}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** minify for stable content hashing (dedup) */
export function minifySvg(svg: string): string {
  return svg.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
}
