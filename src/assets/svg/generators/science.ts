// SVG generators — Science: molecules, laboratory objects, space.
// 512x512 canvas, sticker style (see kit.ts).
import { P, L, C, E, R, defs, lg, rg, shine, shadow, doc, T, INK } from "../kit";

// ------------------------------------------------------------- molecules ---

/** shared ball-and-stick renderer */
function molecule(gen: () => string, label: string, labelColor: string): string {
  return doc(512, 512, label, gen() + T(256, 496, 30, labelColor, label));
}

function waterMolecule(): string {
  const bonds = L("M 256 288 L 150 372", "#7a8aa8", 14) + L("M 256 288 L 362 372", "#7a8aa8", 14);
  return molecule(() => defs(
    rg("ox", [["#ff8a8a", 0], ["#e8483f", 0.6], ["#a8202e", 1]], 0.38, 0.3),
    rg("hy", [["#eaf4ff", 0], ["#c2d8f0", 0.7], ["#8fb4d8", 1]], 0.38, 0.3),
  ) + shadow(256, 448, 150, 18) + bonds +
    C(256, 262, 92, "url(#ox)", { sw: 10 }) +
    C(150, 390, 52, "url(#hy)", { sw: 9 }) +
    C(362, 390, 52, "url(#hy)", { sw: 9 }) +
    shine(226, 232, 24, 14, -24, 0.6) + shine(136, 372, 12, 8, -24, 0.6) +
    T(256, 254, 40, "#7c1f2a", "O") + T(150, 396, 26, "#4a5a72", "H") + T(362, 396, 26, "#4a5a72", "H") +
    // lone pairs
    C(206, 210, 5, "#c22e3d", { opacity: 0.6 }) + C(300, 200, 5, "#c22e3d", { opacity: 0.6 }),
  "water molecule", "#8c1f2a");
}

function co2Molecule(): string {
  return molecule(() => defs(
    rg("cb", [["#6a7080", 0], ["#3d4454", 0.6], ["#262c3a", 1]], 0.38, 0.3),
    rg("ox2", [["#ff8a8a", 0], ["#e8483f", 0.6], ["#a8202e", 1]], 0.38, 0.3),
  ) + shadow(256, 448, 170, 18) +
    L("M 130 256 L 216 256", "#7a8aa8", 13) + L("M 296 256 L 382 256", "#7a8aa8", 13) +
    L("M 130 246 L 216 266 M 296 246 L 382 266", "#9aa8c0", 7, { opacity: 0.8 }) + // double bonds
    C(382, 256, 76, "url(#ox2)", { sw: 9 }) + C(130, 256, 76, "url(#ox2)", { sw: 9 }) +
    C(256, 256, 62, "url(#cb)", { sw: 9 }) +
    shine(106, 232, 18, 10, -24, 0.55) + shine(360, 232, 18, 10, -24, 0.55) +
    T(382, 266, 32, "#7c1f2a", "O") + T(130, 266, 32, "#7c1f2a", "O") + T(256, 268, 30, "#e8ecf4", "C"),
  "carbon dioxide", "#a8202e");
}

function oxygenMolecule(): string {
  return molecule(() => defs(
    rg("ox3", [["#ff8a8a", 0], ["#e8483f", 0.6], ["#a8202e", 1]], 0.38, 0.3),
  ) + shadow(256, 430, 140, 18) +
    L("M 186 250 L 326 250", "#7a8aa8", 13) +
    L("M 186 232 L 326 268 M 186 268 L 326 232", "#c2d0e8", 8, { opacity: 0.9 }) + // O=O
    C(160, 250, 80, "url(#ox3)", { sw: 10 }) + C(352, 250, 80, "url(#ox3)", { sw: 10 }) +
    shine(136, 224, 20, 12, -24, 0.55) + shine(330, 224, 20, 12, -24, 0.55) +
    T(160, 262, 36, "#7c1f2a", "O") + T(352, 262, 36, "#7c1f2a", "O"),
  "oxygen molecule", "#8c1f2a");
}

function methaneMolecule(): string {
  const bond = (x: number, y: number) => L(`M 256 256 L ${x} ${y}`, "#7a8aa8", 13);
  return molecule(() => defs(
    rg("cb2", [["#6a7080", 0], ["#3d4454", 0.6], ["#262c3a", 1]], 0.38, 0.3),
    rg("hy2", [["#eaf4ff", 0], ["#c2d8f0", 0.7], ["#8fb4d8", 1]], 0.38, 0.3),
  ) + shadow(256, 452, 160, 18) +
    bond(256, 110) + bond(110, 320) + bond(402, 320) + bond(256, 420) +
    C(256, 96, 46, "url(#hy2)", { sw: 8 }) + C(100, 330, 46, "url(#hy2)", { sw: 8 }) +
    C(412, 330, 46, "url(#hy2)", { sw: 8 }) + C(256, 430, 46, "url(#hy2)", { sw: 8 }) +
    C(256, 256, 66, "url(#cb2)", { sw: 9 }) +
    shine(234, 234, 18, 10, -24, 0.55) +
    T(256, 268, 32, "#e8ecf4", "C"),
  "methane molecule", "#3d4454");
}

function atomGen(): string {
  const orbit = (rot: number, col: string) =>
    `<g transform="rotate(${rot} 256 256)">` +
    E(256, 256, 190, 74, "none", { sw: 8, stroke: col, opacity: 0.8 }) +
    C(256 + 190, 256, 20, col, { sw: 5, stroke: "#262c3a", opacity: 0.95 }) +
    `</g>`;
  return doc(512, 512, "Atom", defs(
    rg("ncl", [["#ffd75e", 0], ["#ffb703", 0.6], ["#d0860a", 1]], 0.4, 0.32),
  ) + shadow(256, 470, 110, 14) +
    orbit(0, "#4d9de0") + orbit(60, "#e8483f") + orbit(120, "#57b85c") +
    // nucleus cluster
    C(244, 250, 26, "url(#ncl)", { sw: 6 }) + C(268, 262, 24, "url(#ncl)", { sw: 6 }) +
    C(258, 238, 22, "url(#ncl)", { sw: 6 }) + C(240, 270, 20, "url(#ncl)", { sw: 6 }) +
    shine(236, 240, 10, 6, 0, 0.6) +
    // electrons on orbits
    C(120, 130, 13, "#4d9de0", { sw: 4, stroke: "#1e5e94" }) + C(396, 356, 13, "#e8483f", { sw: 4, stroke: "#8c1f2a" }) + C(150, 386, 13, "#57b85c", { sw: 4, stroke: "#2e6a3a" }) +
    T(256, 500, 30, "#3d4454", "atom"),
  );
}

// ------------------------------------------------------- lab objects ---

function flaskGen(): string {
  return doc(512, 512, "Erlenmeyer flask", defs(
    lg("fkg", [["#d8f0ff", 0], ["#a8d8f0", 1]]),
    lg("fq", [["#b06ff0", 0], ["#7a4dd8", 1]]),
  ) + shadow(256, 462, 120, 18) +
    // glass body
    P("M 204 70 L 204 170 L 118 408 C 110 434 128 452 152 452 L 360 452 C 384 452 402 434 394 408 L 308 170 L 308 70 Z", "url(#fkg)", 9, { opacity: 0.75 }) +
    // liquid
    P("M 158 330 L 118 408 C 110 434 128 452 152 452 L 360 452 C 384 452 402 434 394 408 L 354 330 Z", "url(#fq)", 7, { stroke: "#5c35b0", opacity: 0.95 }) +
    // bubbles
    C(230, 400, 10, "#d6c2ff", { opacity: 0.9 }) + C(280, 380, 7, "#d6c2ff", { opacity: 0.7 }) + C(310, 410, 8, "#d6c2ff", { opacity: 0.8 }) +
    E(210, 332, 60, 8, "#c9a8ff", { opacity: 0.8 }) +
    // rim + neck lines
    R(192, 54, 128, 24, 12, "#c2d8e8", { sw: 8 }) +
    L("M 226 70 L 226 168 M 286 70 L 286 168", "#ffffff", 6, { opacity: 0.5 }) +
    // measurement marks
    L("M 176 360 L 200 360 M 166 390 L 190 390 M 156 420 L 180 420", "#5a7a94", 5, { opacity: 0.8 }) +
    shine(180, 220, 12, 34, -10, 0.6) +
    T(256, 500, 30, "#5c35b0", "flask"),
  );
}

function beakerGen(): string {
  return doc(512, 512, "Beaker", defs(
    lg("bkg", [["#d8f0ff", 0], ["#a8d8f0", 1]]),
    lg("bq", [["#57b85c", 0], ["#2e8b3a", 1]]),
  ) + shadow(256, 466, 120, 16) +
    P("M 148 96 L 148 420 C 148 440 162 452 180 452 L 332 452 C 350 452 364 440 364 420 L 364 96", "url(#bkg)", 9, { opacity: 0.75 }) +
    P("M 136 80 L 380 80", "#9ab8cc", 10) + // spout line
    // liquid
    P("M 148 300 L 148 420 C 148 440 162 452 180 452 L 332 452 C 350 452 364 440 364 420 L 364 300 Z", "url(#bq)", 7, { stroke: "#1e6a2a", opacity: 0.95 }) +
    E(256, 300, 108, 10, "#8ed898", { opacity: 0.9 }) +
    C(220, 360, 9, "#c2ecc8", { opacity: 0.8 }) + C(290, 390, 7, "#c2ecc8", { opacity: 0.7 }) +
    // marks
    L("M 168 200 L 200 200 M 168 260 L 210 260 M 168 320 L 200 320 M 168 380 L 210 380", "#5a7a94", 5, { opacity: 0.85 }) +
    shine(176, 150, 10, 60, -6, 0.5) +
    T(256, 500, 30, "#2e8b3a", "beaker"),
  );
}

function testTubeGen(): string {
  return doc(512, 512, "Test tubes", defs(lg("ttq1", [["#ff8a8a", 0], ["#e8483f", 1]]), lg("ttq2", [["#7cc4ff", 0], ["#3a86ff", 1]]), lg("ttq3", [["#b8e986", 0], ["#57b85c", 1]])) +
    shadow(256, 466, 140, 16) +
    // rack
    R(96, 330, 320, 34, 10, "#c98a4a", { sw: 8 }) + R(96, 420, 320, 30, 10, "#a86a2e", { sw: 8 }) +
    // three tubes
    `<g>` +
    R(120, 110, 44, 240, 22, "#d8f0ff", { sw: 8, opacity: 0.7 }) + R(122, 260, 40, 80, 18, "url(#ttq1)", { opacity: 0.95 }) +
    R(234, 90, 44, 260, 22, "#d8f0ff", { sw: 8, opacity: 0.7 }) + R(236, 240, 40, 100, 18, "url(#ttq2)", { opacity: 0.95 }) +
    R(348, 130, 44, 220, 22, "#d8f0ff", { sw: 8, opacity: 0.7 }) + R(350, 280, 40, 60, 18, "url(#ttq3)", { opacity: 0.95 }) +
    `</g>` +
    L("M 132 130 L 132 240 M 356 150 L 356 250", "#ffffff", 5, { opacity: 0.5 }) +
    // bubbles
    C(142, 280, 5, "#ffc2c2", { opacity: 0.8 }) + C(256, 260, 5, "#c2e2ff", { opacity: 0.8 }) + C(370, 300, 5, "#d2f0c2", { opacity: 0.8 }) +
    T(256, 500, 30, "#5a7a94", "test tubes"),
  );
}

function microscopeGen(): string {
  return doc(512, 512, "Microscope", defs(lg("mcg", [["#8a9aae", 0], ["#5a6a80", 1]]), lg("mcg2", [["#ffb35c", 0], ["#e8873e", 1]])) +
    shadow(256, 476, 140, 16) +
    // base
    P("M 130 470 C 130 448 160 434 200 430 L 340 430 C 380 434 402 450 402 470 Z", "url(#mcg)", 9) +
    // arm
    P("M 300 430 C 356 400 380 330 372 250 C 368 214 352 190 330 180 L 296 210 C 316 232 326 264 324 300 C 322 348 300 384 262 402 Z", "url(#mcg)", 9) +
    // stage
    R(140, 300, 190, 26, 8, "url(#mcg2)", { sw: 8 }) +
    R(190, 292, 80, 10, 4, "#c9d6e8", { sw: 5 }) + // slide
    // tube
    `<g transform="rotate(-18 240 190)">` +
    R(214, 96, 52, 130, 16, "url(#mcg)", { sw: 8 }) +
    R(206, 78, 68, 26, 10, "#3d4454", { sw: 6 }) +
    R(222, 224, 36, 26, 8, "#3d4454", { sw: 6 }) +
    `</g>` +
    // eyepiece
    R(196, 60, 54, 24, 9, "#262c3a", { sw: 6 }) +
    // focus knob
    C(320, 330, 26, "#ffd23e", { sw: 7, stroke: "#c9a400" }) + C(320, 330, 10, "#c9a400") +
    // light
    C(200, 350, 14, "#fff4c2", { sw: 5, stroke: "#c9a400" }) +
    L("M 200 366 L 200 396", "#5a6a80", 8) +
    T(256, 504, 30, "#3d4454", "microscope"),
  );
}

function magnetGen(): string {
  return doc(512, 512, "Magnet", defs(lg("mgn", [["#e8483f", 0], ["#c22e3d", 1]]), lg("mgn2", [["#4d9de0", 0], ["#2e6a9a", 1]])) +
    shadow(256, 470, 140, 16) +
    // horseshoe
    P("M 150 96 L 254 96 L 254 260 C 254 296 282 310 310 310 C 338 310 366 296 366 260 L 366 96 L 470 96 L 470 260 C 470 356 400 430 310 430 C 220 430 150 356 150 260 Z", "#c2d0e8", 0) +
    P("M 150 96 L 254 96 L 254 262 C 254 298 282 312 310 312 C 338 312 366 298 366 262 L 366 96 L 470 96 L 470 262 C 470 358 400 432 310 432 C 220 432 150 358 150 262 Z", "#b8c4d8", 9, { opacity: 0.55 }) +
    P("M 150 96 L 254 96 L 254 150 L 150 150 Z", "url(#mgn)", 8, { stroke: "#8c1f2a" }) +
    P("M 366 96 L 470 96 L 470 150 L 366 150 Z", "url(#mgn2)", 8, { stroke: "#1e4a6e" }) +
    L("M 254 180 C 220 200 200 230 200 268 M 366 180 C 400 200 420 230 420 268", "#8a98ac", 7, { opacity: 0.6 }) +
    // field lines
    L("M 118 60 C 92 130 92 210 118 280 M 502 60 C 528 130 528 210 502 280", "#9aa8c0", 6, { dash: "14 12", opacity: 0.8 }) +
    T(202, 130, 40, "#7c1f2a", "N") + T(418, 130, 40, "#1e4a6e", "S") +
    T(256, 500, 30, "#3d4454", "magnet"),
  );
}

function thermometerGen(): string {
  return doc(512, 512, "Thermometer", defs(lg("thq", [["#ff8a8a", 0], ["#e8483f", 1]])) +
    shadow(256, 480, 90, 14) +
    R(216, 60, 80, 300, 40, "#eaf2f8", { sw: 9 }) +
    C(256, 400, 62, "#eaf2f8", { sw: 9 }) +
    // mercury
    C(256, 400, 40, "url(#thq)") +
    R(244, 200, 24, 210, 12, "url(#thq)") +
    // scale
    L("M 276 100 L 296 100 M 276 140 L 296 140 M 276 180 L 296 180 M 276 220 L 296 220 M 276 260 L 296 260 M 276 300 L 296 300", "#5a7a94", 5) +
    shine(234, 130, 8, 40, 0, 0.7) +
    shine(240, 386, 12, 8, 0, 0.6) +
    // hot/cold icons
    C(120, 120, 16, "#7cc4ff", { sw: 5 }) + L("M 120 96 L 120 86 M 120 154 L 120 144 M 96 120 L 86 120 M 154 120 L 144 120 M 104 104 L 97 97 M 136 104 L 143 97 M 104 136 L 97 143 M 136 136 L 143 143", "#7cc4ff", 5) +
    C(412, 120, 16, "#ff8a5c", { sw: 5 }) + L("M 412 96 L 412 86 M 412 154 L 412 144 M 388 120 L 378 120 M 446 120 L 436 120 M 396 104 L 389 97 M 428 104 L 435 97 M 396 136 L 389 143 M 428 136 L 435 143", "#ff8a5c", 5) +
    T(256, 508, 30, "#a84a5c", "thermometer"),
  );
}

function lightbulbGen(): string {
  return doc(512, 512, "Light bulb", defs(rg("lbg", [["#fff9c2", 0], ["#ffd23e", 0.55], ["#e8a80a", 1]], 0.4, 0.35)) +
    shadow(256, 474, 100, 14) +
    // rays
    L("M 256 40 L 256 76 M 130 90 L 154 114 M 382 90 L 358 114 M 84 216 L 122 216 M 428 216 L 390 216", "#ffb703", 9) +
    // bulb
    C(256, 216, 118, "url(#lbg)", { sw: 9 }) +
    // filament
    L("M 226 262 C 226 236 240 224 256 236 C 272 224 286 236 286 262", "#c9860a", 7) +
    L("M 236 262 L 236 286 M 276 262 L 276 286", "#c9860a", 7) +
    // screw base
    P("M 218 322 L 294 322 L 290 348 L 222 348 Z", "#9aa8b8", 7) +
    R(222, 348, 68, 12, 6, "#8a98a8", { sw: 5 }) +
    R(226, 364, 60, 12, 6, "#7a8898", { sw: 5 }) +
    P("M 234 380 L 278 380 L 268 404 L 244 404 Z", "#6a7888", 6) +
    shine(216, 170, 26, 34, -28, 0.65) +
    T(256, 500, 30, "#b8860b", "light bulb"),
  );
}

function planetSaturnGen(): string {
  return doc(512, 512, "Saturn", defs(
    rg("stg", [["#ffe9b0", 0], ["#f2c46a", 0.55], ["#c8963e", 1]], 0.38, 0.32),
  ) +
    // rings behind
    `<g transform="rotate(-18 256 256)">` +
    E(256, 256, 230, 62, "none", { sw: 16, stroke: "#e8c98a", opacity: 0.55 }) +
    E(256, 256, 196, 48, "none", { sw: 10, stroke: "#c8a05e", opacity: 0.8 }) +
    `</g>` +
    C(256, 256, 128, "url(#stg)", { sw: 9 }) +
    // bands
    L("M 150 220 C 220 204 300 204 362 222 M 138 262 C 216 246 300 246 374 264 M 158 304 C 226 290 296 290 356 306", "#d8a85e", 9, { opacity: 0.7 }) +
    shine(210, 210, 26, 16, -24, 0.5) +
    `<g transform="rotate(-18 256 256)">` +
    E(256, 256, 230, 62, "none", { sw: 12, stroke: "#e8c98a", opacity: 0.5 }) +
    `</g>` +
    // moon
    C(440, 130, 22, "#d8dce8", { sw: 5, stroke: "#8a94a8" }) +
    T(256, 508, 30, "#a87a2e", "saturn"),
  );
}

function sunGen(): string {
  const ray = (a: number, len: number) => {
    const r1 = 148, r2 = 148 + len, rad = (a * Math.PI) / 180;
    return L(`M ${256 + Math.cos(rad) * r1} ${236 + Math.sin(rad) * r1} L ${256 + Math.cos(rad) * r2} ${236 + Math.sin(rad) * r2}`, "#ffb703", 12);
  };
  return doc(512, 512, "Sun", defs(rg("sng2", [["#fff3b0", 0], ["#FFCC00", 0.55], ["#e8960a", 1]], 0.4, 0.32)) +
    shadow(256, 470, 110, 14) +
    Array.from({ length: 12 }, (_, i) => ray(i * 30, 30 + (i % 2) * 16)).join("") +
    C(256, 236, 120, "url(#sng2)", { sw: 9 }) +
    // happy face
    C(222, 216, 9, "#a86a00") + C(290, 216, 9, "#a86a00") +
    L("M 218 264 C 240 286 272 286 294 264", "#a86a00", 8) +
    E(204, 244, 12, 7, "#ff9d5c", { opacity: 0.7 }) + E(308, 244, 12, 7, "#ff9d5c", { opacity: 0.7 }) +
    shine(216, 180, 24, 14, -24, 0.55) +
    T(256, 500, 30, "#c9860a", "sun"),
  );
}

function moonGen(): string {
  return doc(512, 512, "Moon", defs(rg("mng", [["#fffbe8", 0], ["#eae4d0", 0.6], ["#c2bca8", 1]], 0.38, 0.32)) +
    shadow(256, 480, 100, 14) +
    C(256, 246, 140, "url(#mng)", { sw: 9 }) +
    // craters
    C(210, 200, 24, "#cfc8b0", { sw: 4, stroke: "#a89f88" }) +
    C(300, 280, 30, "#cfc8b0", { sw: 4, stroke: "#a89f88" }) +
    C(220, 320, 16, "#cfc8b0", { sw: 3, stroke: "#a89f88" }) +
    C(310, 190, 12, "#cfc8b0", { sw: 3, stroke: "#a89f88" }) +
    shine(210, 180, 24, 14, -24, 0.6) +
    // stars
    P("M 110 110 L 116 128 L 134 134 L 116 140 L 110 158 L 104 140 L 86 134 L 104 128 Z", "#ffd23e", 4, { stroke: "#d8a400" }) +
    P("M 410 350 L 415 364 L 429 369 L 415 374 L 410 388 L 405 374 L 391 369 L 405 364 Z", "#ffd23e", 3, { stroke: "#d8a400" }) +
    T(256, 508, 30, "#8a8470", "moon"),
  );
}

function earthGen(): string {
  return doc(512, 512, "Earth", defs(
    rg("eth", [["#7cc4ff", 0], ["#3a86ff", 0.6], ["#1e5e94", 1]], 0.38, 0.32),
    lg("lnd", [["#8ed15c", 0], ["#4e9a2e", 1]]),
  ) + shadow(256, 484, 110, 14) +
    C(256, 256, 170, "url(#eth)", { sw: 10 }) +
    // continents
    P("M 150 170 C 190 150 240 156 260 184 C 276 208 262 232 232 238 C 254 252 258 276 240 292 C 216 312 172 306 150 280 C 130 256 128 194 150 170 Z", "url(#lnd)", 6, { stroke: "#2e6a1e" }) +
    P("M 300 120 C 330 112 360 124 372 148 C 382 168 372 188 350 192 C 322 196 300 182 294 160 C 290 142 292 128 300 120 Z", "url(#lnd)", 6, { stroke: "#2e6a1e" }) +
    P("M 320 300 C 352 292 384 304 392 330 C 398 352 384 372 358 376 C 330 380 306 366 300 342 C 296 324 306 306 320 300 Z", "url(#lnd)", 6, { stroke: "#2e6a1e" }) +
    P("M 190 340 C 214 330 240 338 248 358 C 254 376 244 392 222 396 C 200 398 182 388 178 368 C 176 354 180 346 190 340 Z", "url(#lnd)", 6, { stroke: "#2e6a1e" }) +
    // clouds
    E(190, 150, 40, 12, "#ffffff", { opacity: 0.7 }) + E(320, 260, 34, 10, "#ffffff", { opacity: 0.6 }) + E(230, 300, 30, 9, "#ffffff", { opacity: 0.5 }) +
    shine(190, 170, 30, 20, -24, 0.35) +
    T(256, 508, 30, "#1e5e94", "earth"),
  );
}

function rocketGen(): string {
  return doc(512, 512, "Rocket", defs(lg("rkg", [["#f4f6f8", 0], ["#d8dee8", 1]]), lg("rkf", [["#fff3b0", 0], ["#ffb703", 0.6], ["#ff6b35", 1]])) +
    shadow(256, 484, 90, 14) +
    // flame
    P("M 216 388 C 222 428 236 452 256 470 C 276 452 290 428 296 388 Z", "url(#rkf)", 6, { stroke: "#e05f1e" }) +
    P("M 232 388 C 236 412 244 428 256 440 C 268 428 276 412 280 388 Z", "#ffd23e", 4, { stroke: "#e0a400" }) +
    // fins
    P("M 186 300 C 150 330 134 372 138 408 L 190 382 Z", "#e8483f", 8, { stroke: "#8c1f2a" }) +
    P("M 326 300 C 362 330 378 372 374 408 L 322 382 Z", "#e8483f", 8, { stroke: "#8c1f2a" }) +
    // body
    P("M 190 300 C 190 200 214 120 256 66 C 298 120 322 200 322 300 C 322 340 300 376 256 388 C 212 376 190 340 190 300 Z", "url(#rkg)", 9) +
    // nose cone
    P("M 214 130 C 226 100 240 78 256 66 C 272 78 286 100 298 130 C 286 122 270 118 256 118 C 242 118 226 122 214 130 Z", "#e8483f", 7, { stroke: "#8c1f2a" }) +
    // window
    C(256, 220, 38, "#7cc4ff", { sw: 9, stroke: "#33556b" }) + C(244, 208, 10, "#ffffff", { opacity: 0.8 }) +
    // stripe
    L("M 196 320 L 316 320", "#e8483f", 8) +
    shine(222, 170, 12, 30, -12, 0.7) +
    // stars
    P("M 100 120 L 106 138 L 124 144 L 106 150 L 100 168 L 94 150 L 76 144 L 94 138 Z", "#ffd23e", 4, { stroke: "#d8a400" }) +
    C(420, 110, 8, "#ffd23e") + C(448, 200, 5, "#ffd23e") + C(90, 330, 6, "#ffd23e") +
    T(256, 506, 30, "#5a6a80", "rocket"),
  );
}

function compassGen(): string {
  return doc(512, 512, "Compass", defs(
    rg("cmp", [["#f4ecdc", 0], ["#e2d4b8", 1]], 0.4, 0.32),
  ) + shadow(256, 478, 120, 14) +
    C(256, 250, 160, "url(#cmp)", { sw: 12, stroke: "#8a5a2e" }) +
    C(256, 250, 128, "#f8f2e4", { sw: 4, stroke: "#c2b490" }) +
    // ticks
    Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x1 = 256 + Math.cos(a) * 112, y1 = 250 + Math.sin(a) * 112;
      const x2 = 256 + Math.cos(a) * 126, y2 = 250 + Math.sin(a) * 126;
      return L(`M ${x1} ${y1} L ${x2} ${y2}`, "#8a7a5a", 5);
    }).join("") +
    // needle
    P("M 256 130 L 286 250 L 256 370 L 226 250 Z", "#e8483f", 6, { stroke: "#8c1f2a" }) +
    P("M 256 130 L 286 250 L 226 250 Z", "#3d4454", 5) +
    C(256, 250, 14, "#ffd23e", { sw: 5, stroke: "#c9a400" }) +
    T(256, 148, 34, "#8c1f2a", "N") +
    T(256, 506, 30, "#6a5a3a", "compass"),
  );
}

export const SCIENCE_GENERATORS: Record<string, () => string> = {
  "water-molecule": waterMolecule,
  "co2-molecule": co2Molecule,
  "oxygen-molecule": oxygenMolecule,
  "methane-molecule": methaneMolecule,
  atom: atomGen,
  flask: flaskGen,
  beaker: beakerGen,
  "test-tubes": testTubeGen,
  microscope: microscopeGen,
  magnet: magnetGen,
  thermometer: thermometerGen,
  "light-bulb": lightbulbGen,
  saturn: planetSaturnGen,
  sun: sunGen,
  moon: moonGen,
  earth: earthGen,
  rocket: rocketGen,
  compass: compassGen,
};
