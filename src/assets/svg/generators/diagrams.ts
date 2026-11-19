// SVG generators — Educational diagrams (labelled, information-bearing).
// 512x512 canvas, sticker style (see kit.ts).
import { P, L, C, E, R, defs, lg, rg, shine, shadow, doc, T, arrow, INK } from "../kit";

function waterCycleGen(): string {
  return doc(512, 512, "The water cycle", defs(
    lg("wcs", [["#bfe6ff", 0], ["#8ed1f5", 1]]),
    lg("wcm", [["#8fce6a", 0], ["#5a9a3e", 1]]),
  ) +
    // sky
    R(0, 0, 512, 320, 0, "url(#wcs)") +
    // sun
    C(430, 70, 34, "#FFCC00", { sw: 6, stroke: "#d8a400" }) +
    L("M 430 20 L 430 8 M 480 70 L 492 70 M 466 34 L 474 26 M 466 106 L 474 114 M 394 34 L 386 26", "#ffb703", 7) +
    // mountain
    P("M 60 320 L 200 150 L 300 320 Z", "url(#wcm)", 8) +
    P("M 200 150 L 240 200 L 224 208 L 200 186 L 180 210 L 164 200 Z", "#ffffff", 5, { stroke: "#c2d0e8" }) +
    P("M 260 320 L 350 200 L 460 320 Z", "#7abf5a", 8) +
    // sea
    R(0, 318, 512, 130, 0, "#3a86ff") +
    L("M 20 340 q 20 -8 40 0 q 20 8 40 0 M 120 366 q 20 -8 40 0 q 20 8 40 0 M 330 356 q 20 -8 40 0 q 20 8 40 0 M 240 400 q 20 -8 40 0", "#9cc8ff", 6, { opacity: 0.8 }) +
    // evaporation arrows
    arrow("M 120 300 C 100 240 110 180 140 130", "#ffffff", 8, 14) +
    arrow("M 400 300 C 420 240 410 180 384 136", "#ffffff", 8, 14) +
    T(96, 240, 24, "#1e5e94", "evaporation", "start") +
    // cloud
    E(256, 96, 70, 40, "#ffffff", { sw: 6, stroke: "#b8d0e8" }) +
    E(200, 112, 46, 30, "#ffffff", { sw: 6, stroke: "#b8d0e8" }) +
    E(312, 112, 46, 30, "#ffffff", { sw: 6, stroke: "#b8d0e8" }) +
    // rain
    L("M 220 150 L 210 190 M 258 156 L 248 198 M 296 150 L 286 190", "#4d9de0", 7) +
    // condensation label
    T(256, 62, 24, "#3d5a80", "condensation") +
    // precipitation
    T(390, 250, 22, "#ffffff", "rain") +
    T(256, 470, 34, "#ffffff", "THE WATER CYCLE"),
  );
}

function photosynthesisGen(): string {
  return doc(512, 512, "Photosynthesis", defs(lg("phl", [["#a8e063", 0], ["#56ab2f", 1]])) +
    shadow(256, 470, 150, 16) +
    // big leaf
    P("M 256 420 C 140 340 116 220 148 148 C 174 90 228 70 256 76 C 284 70 338 90 364 148 C 396 220 372 340 256 420 Z", "url(#phl)", 9) +
    L("M 256 414 L 256 82", "#2e7a1e", 8) +
    L("M 256 350 C 224 336 200 316 186 292 M 256 350 C 288 336 312 316 326 292 M 256 280 C 228 268 208 252 196 232 M 256 280 C 284 268 304 252 316 232", "#2e7a1e", 5, { opacity: 0.8 }) +
    // sun
    C(56, 60, 26, "#FFCC00", { sw: 5, stroke: "#d8a400" }) +
    L("M 56 20 L 56 10 M 96 60 L 106 60 M 84 32 L 91 25", "#ffb703", 6) +
    arrow("M 88 96 C 140 110 180 130 210 156", "#ffd23e", 8, 13) +
    T(96, 118, 20, "#b8860b", "sunlight", "start") +
    // CO2 in
    arrow("M 60 260 C 120 258 160 254 196 250", "#7a8aa8", 8, 13) +
    T(48, 240, 22, "#3d4454", "CO2", "start") +
    // O2 out
    arrow("M 320 220 C 380 216 430 212 470 208", "#4d9de0", 8, 13) +
    T(430, 190, 22, "#1e5e94", "O2", "start") +
    // water in (roots)
    arrow("M 256 490 C 256 470 256 450 256 432", "#3a86ff", 8, 13) +
    T(300, 486, 22, "#1e5e94", "water", "start") +
    // sugar out
    C(420, 330, 20, "#ffb703", { sw: 5, stroke: "#c9860a" }) +
    arrow("M 372 330 C 392 330 400 330 396 330", "#e8960a", 7, 12) +
    T(424, 374, 20, "#b8860b", "sugar") +
    T(256, 464, 30, "#2e6a1e", "PHOTOSYNTHESIS"),
  );
}

function foodChainGen(): string {
  // grass -> grasshopper -> frog -> hawk, left to right with arrows
  const grass = `<g>` +
    L("M 60 430 C 56 400 48 384 36 372 M 76 432 C 76 402 72 384 64 368 M 92 430 C 96 402 104 386 114 374 M 106 432 C 110 410 118 396 128 388", "#4e9a2e", 8) +
    P("M 30 436 L 140 436 L 132 452 L 38 452 Z", "#6a4a2e", 6) + `</g>`;
  const hopper = `<g transform="translate(240 380)">` +
    E(0, 20, 44, 26, "#7abf5a", { sw: 6 }) +
    C(-18, -12, 20, "#7abf5a", { sw: 5 }) + C(-22, -16, 5, "#1d1436") +
    L("M 10 4 C 34 -18 52 -22 66 -14", "#4e8a34", 7) +
    L("M 0 44 L -8 66 M 24 44 L 32 66", "#4e8a34", 7) + `</g>`;
  const frog = `<g transform="translate(400 384)">` +
    E(0, 12, 42, 26, "#57b85c", { sw: 6 }) +
    C(-20, -16, 16, "#57b85c", { sw: 5 }) + C(6, -18, 16, "#57b85c", { sw: 5 }) +
    C(-22, -18, 6, "#1d1436") + C(4, -20, 6, "#1d1436") +
    L("M -14 4 C -4 12 10 12 20 4", "#2e6a3a", 5) +
    L("M 20 34 L 34 58 M -16 34 L -28 56", "#3e8a4a", 7) + `</g>`;
  const hawk = `<g transform="translate(430 190)">` +
    E(0, 0, 40, 28, "#a86a3e", { sw: 6 }) +
    C(-26, -22, 18, "#a86a3e", { sw: 5 }) +
    P("M -44 -22 L -62 -16 L -42 -10 Z", "#ffb703", 4) +
    C(-30, -26, 4, "#1d1436") +
    P("M 6 -6 C 30 -18 48 -14 54 0 C 38 10 18 8 6 -2 Z", "#8a5a2e", 5) +
    L("M -8 28 L -12 46 M 12 28 L 16 44", "#c9860a", 5) + `</g>`;
  return doc(512, 512, "Food chain", defs() +
    R(0, 430, 512, 82, 0, "#b8e986") +
    R(0, 300, 512, 130, 0, "#d8f0c2") +
    grass + hopper + frog + hawk +
    arrow("M 148 400 C 170 398 190 396 206 394", "#3d4454", 8, 13) +
    arrow("M 300 396 C 324 394 346 392 362 390", "#3d4454", 8, 13) +
    arrow("M 420 350 C 428 310 430 268 430 232", "#3d4454", 8, 13) +
    T(256, 492, 32, "#2e6a1e", "FOOD CHAIN") +
    T(60, 466, 17, "#2e5a1e", "grass") + T(240, 466, 17, "#2e5a1e", "grasshopper") + T(400, 462, 17, "#2e5a1e", "frog") + T(452, 150, 17, "#2e5a1e", "hawk"),
  );
}

function statesOfMatterGen(): string {
  // solid / liquid / gas panels
  const panel = (x: number, col: string, title: string) => R(x, 90, 140, 250, 18, col, { sw: 7, stroke: "rgba(0,0,0,0.15)" }) + T(x + 70, 372, 24, "#3d4454", title);
  const solid = Array.from({ length: 9 }, (_, i) => C(86 + (i % 3) * 34, 160 + Math.floor(i / 3) * 34, 11, "#3a86ff", { sw: 4 })).join("");
  const liquid = Array.from({ length: 9 }, (_, i) => C(96 + (i % 3) * 36 + (i > 5 ? 8 : 0), 170 + Math.floor(i / 3) * 32 + (i % 3) * 2, 11, "#4d9de0", { sw: 4 })).join("");
  const gas = Array.from({ length: 8 }, (_, i) => C(108 + (i % 3) * 52 + (Math.floor(i / 3) % 2) * 18, 160 + Math.floor(i / 3) * 46, 11, "#8a6ff0", { sw: 4 })).join("");
  const wig = (x: number) => L(`M ${x} 120 l 8 -8 l 8 8 l 8 -8`, "#8a6ff0", 4, { opacity: 0.7 });
  return doc(512, 512, "States of matter", defs() +
    panel(30, "#eaf2ff", "SOLID") + panel(186, "#eaf6ff", "LIQUID") + panel(342, "#f0eaff", "GAS") +
    solid + liquid + gas + wig(352) + wig(392) + wig(430) +
    // transitions
    arrow("M 168 210 C 180 210 178 210 184 210", "#e8960a", 7, 12) +
    arrow("M 324 210 C 336 210 334 210 340 210", "#e8960a", 7, 12) +
    arrow("M 184 260 C 172 260 174 260 168 260", "#4d9de0", 7, 12) +
    arrow("M 340 260 C 328 260 330 260 324 260", "#4d9de0", 7, 12) +
    T(256, 62, 34, "#3d4454", "STATES OF MATTER") +
    T(100, 428, 19, "#5a6a80", "melting") + T(262, 428, 19, "#5a6a80", "boiling") +
    T(100, 460, 17, "#7a8aa8", "freezing") + T(262, 460, 17, "#7a8aa8", "condensing"),
  );
}

function butterflyLifeCycleGen(): string {
  const egg = C(70, 320, 20, "#eaf6d8", { sw: 6 });
  const caterpillar = `<g transform="translate(170 330)">` +
    C(-40, 0, 16, "#7abf5a", { sw: 5 }) + C(-12, -4, 17, "#7abf5a", { sw: 5 }) + C(16, -2, 17, "#7abf5a", { sw: 5 }) + C(42, 2, 15, "#7abf5a", { sw: 5 }) +
    C(-52, -16, 5, "#1d1436") + L("M -44 -14 C -40 -30 -28 -34 -20 -28", "#4e8a34", 4) + `</g>`;
  const chrysalis = P("M 300 280 C 316 276 330 290 330 316 C 330 346 318 370 306 376 C 294 370 282 346 282 316 C 282 290 288 282 300 280 Z", "#8a6ff0", 6) + L("M 306 262 L 306 280", "#5235b0", 6);
  const butterfly = `<g transform="translate(420 320)">` +
    P("M -6 0 C -40 -34 -74 -44 -84 -18 C -92 4 -60 20 -12 22 Z", "#7cc4ff", 5) +
    P("M 6 0 C 40 -34 74 -44 84 -18 C 92 4 60 20 12 22 Z", "#7cc4ff", 5) +
    P("M -6 8 C -34 34 -56 48 -64 32 C -70 18 -44 6 -8 12 Z", "#7cc4ff", 5) +
    P("M 6 8 C 34 34 56 48 64 32 C 70 18 44 6 8 12 Z", "#7cc4ff", 5) +
    E(0, 10, 6, 22, "#6a4dd8", { sw: 4 }) +
    L("M -2 -12 C -8 -24 -14 -30 -20 -32 M 2 -12 C 8 -24 14 -30 20 -32", "#5235b0", 4) + `</g>`;
  return doc(512, 512, "Butterfly life cycle", defs() +
    R(0, 400, 512, 112, 0, "#b8e986") +
    // branch for chrysalis
    L("M 260 220 C 290 230 306 250 308 268", "#8a5a2e", 8) +
    egg + caterpillar + chrysalis + butterfly +
    arrow("M 100 300 C 120 280 138 266 152 258", "#3d4454", 6, 11) +
    arrow("M 226 300 C 250 288 268 280 284 276", "#3d4454", 6, 11) +
    arrow("M 348 300 C 368 296 384 298 396 302", "#3d4454", 6, 11) +
    arrow("M 430 370 C 400 392 340 404 250 406 C 180 407 120 396 84 372", "#3d4454", 6, 11) +
    T(256, 60, 32, "#3d4454", "BUTTERFLY LIFE CYCLE") +
    T(70, 380, 17, "#3d5a80", "eggs") + T(170, 386, 17, "#3d5a80", "larva") + T(306, 404, 17, "#3d5a80", "pupa") + T(420, 392, 17, "#3d5a80", "adult"),
  );
}

function plantPartsGen(): string {
  return doc(512, 512, "Parts of a plant", defs(lg("ppf", [["#a8e063", 0], ["#56ab2f", 1]])) +
    shadow(256, 478, 130, 14) +
    // soil
    P("M 60 420 C 140 400 380 400 452 420 L 452 470 L 60 470 Z", "#8a5a3b", 8) +
    // flower head
    Array.from({ length: 8 }, (_, i) =>
      `<g transform="rotate(${i * 45} 256 140)">` + P("M 256 140 C 240 108 246 76 256 62 C 266 76 272 108 256 140 Z", "#ff8fb3", 6) + `</g>`).join("") +
    C(256, 140, 26, "#ffd23e", { sw: 6, stroke: "#d8a400" }) +
    // stem
    P("M 250 420 C 250 340 250 240 254 168 L 262 168 C 266 240 266 340 266 420 Z", "url(#ppf)", 7) +
    // leaves
    P("M 252 330 C 210 322 184 296 182 262 C 222 266 248 292 252 330 Z", "url(#ppf)", 7) +
    P("M 264 300 C 306 292 332 266 334 232 C 294 236 268 262 264 300 Z", "url(#ppf)", 7) +
    // roots
    L("M 256 420 C 250 444 236 462 214 474 M 258 420 C 262 446 272 464 290 476 M 256 424 C 256 446 256 462 256 478", "#c9b48a", 8) +
    // labels
    T(348, 128, 22, "#c04a78", "flower", "start") + L("M 300 136 L 336 130", "#c04a78", 4, { opacity: 0.8 }) +
    T(360, 262, 22, "#2e6a1e", "leaf", "start") + L("M 330 262 L 316 262", "#2e6a1e", 4, { opacity: 0.8 }) +
    T(90, 350, 22, "#2e6a1e", "stem", "start") + L("M 130 356 L 240 350", "#2e6a1e", 4, { opacity: 0.8 }) +
    T(348, 452, 22, "#6a4a2e", "roots", "start") + L("M 300 450 L 296 452", "#6a4a2e", 4, { opacity: 0.8 }) +
    T(256, 504, 30, "#2e6a1e", "PARTS OF A PLANT"),
  );
}

export const DIAGRAM_GENERATORS: Record<string, () => string> = {
  "water-cycle": waterCycleGen,
  photosynthesis: photosynthesisGen,
  "food-chain": foodChainGen,
  "states-of-matter": statesOfMatterGen,
  "butterfly-life-cycle": butterflyLifeCycleGen,
  "parts-of-a-plant": plantPartsGen,
};
