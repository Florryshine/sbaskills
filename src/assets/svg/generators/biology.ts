// SVG generators — Biology: human organs, cells, microorganisms.
// All drawn on a 512x512 canvas, sticker style (see kit.ts).
import { P, L, C, E, R, defs, lg, rg, shine, shadow, doc, T, arrow, INK } from "../kit";

// ---------------------------------------------------------------- organs ---

function heartGen(): string {
  const d = defs(
    rg("hg", [["#ff7b6b", 0], ["#e8483f", 0.55], ["#b31f33", 1]], 0.38, 0.3),
    lg("hg2", [["#ff9d8f", 0], ["#e8483f", 1]]),
  );
  return doc(512, 512, "Human heart", d +
    shadow(256, 460, 130, 22) +
    // aorta arch (red) + pulmonary artery (blue)
    P("M 250 150 C 240 84 300 52 350 78 C 392 100 388 150 372 176 L 330 196 C 348 158 336 128 312 126 C 288 124 276 150 282 182 Z", "#e8483f", 9) +
    P("M 344 108 L 344 76 M 374 120 L 388 92 M 306 104 L 296 76", "#e8483f", 18) +
    P("M 190 168 C 168 120 196 88 232 96 C 258 102 268 128 264 158 L 236 196 C 238 170 226 150 208 152 C 192 154 188 172 196 192 Z", "#4d9de0", 9) +
    // heart body
    P("M 256 452 C 150 380 92 300 100 218 C 106 158 152 128 200 142 C 232 152 250 172 256 196 C 262 172 280 152 312 142 C 360 128 406 158 412 218 C 420 300 362 380 256 452 Z", "url(#hg)", 10) +
    // coronary arteries
    L("M 236 208 C 220 260 214 320 224 388", "#ffd9d2", 10, { opacity: 0.9 }) +
    L("M 284 214 C 300 262 306 316 296 372", "#ffb3a8", 9, { opacity: 0.85 }) +
    L("M 256 200 C 250 260 250 330 254 402", "#c22e3d", 7, { opacity: 0.6 }) +
    shine(170, 210, 30, 46, -32, 0.55) +
    T(256, 492, 30, "#7c2733", "heart"),
  );
}

function brainGen(): string {
  const folds = "M 150 210 C 178 190 196 214 226 200 M 286 178 C 312 162 338 184 364 170 M 140 282 C 170 262 200 286 234 268 M 282 262 C 310 244 344 268 376 250 M 196 348 C 226 328 256 352 290 334 M 322 330 C 350 314 378 334 402 320";
  const d = defs(rg("bg1", [["#ffb3c8", 0], ["#f78fb3", 0.6], ["#e06a9a", 1]], 0.4, 0.3));
  return doc(512, 512, "Human brain", d +
    shadow(256, 452, 150, 20) +
    // cerebrum
    P("M 256 96 C 160 96 96 160 96 240 C 96 320 150 372 210 384 C 240 390 272 390 302 384 C 362 372 416 320 416 240 C 416 160 352 96 256 96 Z", "url(#bg1)", 10) +
    // midline
    L("M 256 100 L 256 384", "#d1588a", 8, { opacity: 0.8 }) +
    // folds
    L(folds, "#d1588a", 9, { opacity: 0.85 }) +
    // cerebellum
    P("M 300 366 C 348 360 392 372 396 406 C 398 432 366 446 328 440 C 296 434 280 412 284 390 Z", "#f2a0bd", 8) +
    L("M 306 386 C 330 380 360 386 384 398 M 300 410 C 324 404 352 408 376 418", "#d1588a", 6, { opacity: 0.8 }) +
    // brainstem
    P("M 244 380 C 240 412 234 432 220 452 L 262 452 C 270 428 274 404 274 382 Z", "#e88aae", 8) +
    shine(180, 150, 34, 20, -20, 0.5) +
    T(256, 492, 30, "#a3446b", "brain"),
  );
}

function lungsGen(): string {
  const d = defs(
    lg("lg1", [["#ff9d9d", 0], ["#f2697c", 0.6], ["#d64f68", 1]]),
  );
  return doc(512, 512, "Lungs", d +
    shadow(256, 466, 150, 20) +
    // trachea + bronchi
    P("M 236 66 C 236 100 232 128 224 156 L 262 176 C 272 142 276 104 276 66 Z", "#c9d6e8", 9) +
    R(228, 52, 56, 26, 13, "#c9d6e8", { sw: 9 }) +
    L("M 232 160 C 200 176 178 196 168 224 M 262 180 C 296 192 318 214 328 244", "#aebdd4", 12) +
    // left lung
    P("M 216 176 C 170 190 120 250 112 330 C 106 396 130 442 176 446 C 214 448 238 420 240 372 C 242 312 238 232 216 176 Z", "url(#lg1)", 10) +
    // right lung
    P("M 296 182 C 344 194 394 254 402 334 C 408 398 384 442 338 446 C 300 448 276 420 274 372 C 272 314 276 238 296 182 Z", "url(#lg1)", 10) +
    // bronchial tree inside lungs
    L("M 176 240 C 162 286 154 340 156 400 M 336 248 C 350 292 358 344 356 402", "#ffd1da", 8, { opacity: 0.9 }) +
    L("M 176 240 C 192 272 198 306 198 340 M 336 248 C 320 280 314 312 314 346", "#ffd1da", 6, { opacity: 0.8 }) +
    // breathing sparkle
    C(430, 130, 10, "#8ed1ff", { opacity: 0.9 }) + C(452, 100, 7, "#8ed1ff", { opacity: 0.7 }) + C(446, 156, 5, "#8ed1ff", { opacity: 0.6 }) +
    shine(160, 260, 20, 40, -18, 0.35) +
    T(256, 496, 30, "#a33a52", "lungs"),
  );
}

function eyeGen(): string {
  const d = defs(
    rg("eg", [["#ffffff", 0], ["#f2f0ff", 0.7], ["#ddd6f3", 1]], 0.4, 0.35),
    rg("iris", [["#7cc4ff", 0], ["#3a86ff", 0.6], ["#1e5e94", 1]], 0.42, 0.38),
  );
  return doc(512, 512, "Human eye", d +
    shadow(256, 452, 140, 18) +
    // eyelid shapes behind
    P("M 92 256 C 130 150 382 150 420 256 C 382 362 130 362 92 256 Z", "#ffd9c2", 10) +
    // eyeball
    C(256, 256, 118, "url(#eg)", { sw: 10 }) +
    // iris + pupil
    C(256, 256, 56, "url(#iris)", { sw: 7, stroke: "#1e5e94" }) +
    C(256, 256, 24, "#1d1436") +
    C(240, 240, 9, "#ffffff", { opacity: 0.9 }) +
    C(272, 270, 4, "#ffffff", { opacity: 0.5 }) +
    // iris rays
    L("M 256 202 L 256 214 M 210 226 L 220 234 M 302 226 L 292 234 M 202 268 L 214 266 M 310 268 L 298 266", "#7cc4ff", 5, { opacity: 0.8 }) +
    // lashes
    L("M 150 168 L 132 140 M 256 146 L 256 114 M 362 168 L 380 140 M 196 152 L 184 124 M 316 152 L 328 124", INK, 9) +
    shine(150, 220, 22, 34, -30, 0.5) +
    T(256, 492, 30, "#4a5a8c", "eye"),
  );
}

function earGen(): string {
  const d = defs(lg("eag", [["#ffd9b0", 0], ["#f5b878", 0.65], ["#e09a5a", 1]]));
  return doc(512, 512, "Human ear", d +
    shadow(256, 462, 110, 18) +
    // outer ear
    P("M 180 120 C 240 70 340 84 380 160 C 420 240 400 330 340 380 C 300 414 268 436 252 462 C 240 480 214 480 204 460 C 192 436 208 408 236 380 C 190 372 150 330 146 268 C 142 206 148 156 180 120 Z", "url(#eag)", 10) +
    // inner curves
    L("M 216 176 C 258 148 316 160 338 208 C 356 248 344 300 310 330", "#c77f42", 10, { opacity: 0.85 }) +
    L("M 250 210 C 278 196 308 208 318 238", "#c77f42", 8, { opacity: 0.8 }) +
    E(258, 268, 16, 22, "#b96a33", { rot: -18, opacity: 0.85 }) +
    // sound waves
    L("M 420 180 C 452 220 452 292 420 332", "#4d9de0", 9, { opacity: 0.8 }) +
    L("M 452 150 C 496 204 496 308 452 362", "#4d9de0", 9, { opacity: 0.55 }) +
    shine(230, 140, 26, 14, -18, 0.5) +
    T(256, 500, 30, "#9a6a3a", "ear"),
  );
}

function stomachGen(): string {
  const d = defs(lg("stg", [["#ff9d7e", 0], ["#f2705c", 0.6], ["#d14a44", 1]], 115));
  return doc(512, 512, "Stomach", d +
    shadow(256, 462, 120, 18) +
    // oesophagus
    P("M 262 64 C 250 110 244 148 246 182 L 292 190 C 290 152 294 112 300 68 Z", "#f2a98c", 9) +
    R(252, 50, 58, 26, 13, "#f2a98c", { sw: 9 }) +
    // stomach body (J shape)
    P("M 250 186 C 190 180 140 220 134 288 C 128 360 172 420 240 434 C 300 446 356 420 372 372 C 386 330 366 300 330 296 C 352 280 360 254 348 230 C 332 198 292 190 250 186 Z", "url(#stg)", 10) +
    // rugae folds
    L("M 190 260 C 210 276 216 300 208 326 M 236 250 C 254 272 258 302 248 336 M 282 262 C 296 282 298 308 290 330", "#c94a3e", 7, { opacity: 0.75 }) +
    // bubbles (digestion)
    C(316, 350, 12, "#ffd9c2", { opacity: 0.85 }) + C(340, 322, 8, "#ffd9c2", { opacity: 0.7 }) + C(300, 320, 6, "#ffd9c2", { opacity: 0.6 }) +
    shine(190, 250, 20, 34, -30, 0.4) +
    T(256, 496, 30, "#a04a3a", "stomach"),
  );
}

function liverGen(): string {
  const d = defs(lg("lvg", [["#b96a5a", 0], ["#8f4a42", 0.6], ["#6e352f", 1]], 115));
  return doc(512, 512, "Liver", d +
    shadow(256, 452, 160, 20) +
    // main lobe
    P("M 96 220 C 120 160 220 130 320 146 C 402 160 446 208 440 268 C 434 328 380 356 300 350 C 300 350 260 346 232 336 C 200 324 180 330 160 344 C 130 364 98 350 90 312 C 84 282 88 248 96 220 Z", "url(#lvg)", 10) +
    // right lobe behind
    P("M 300 350 C 350 372 390 396 380 424 C 372 446 330 448 292 432 C 260 418 240 392 248 366 Z", "#5e2c27", 9) +
    // gallbladder
    P("M 250 300 C 270 316 288 340 282 364 C 278 382 258 386 244 374 C 228 360 228 328 236 306 Z", "#7fbf5a", 8) +
    L("M 262 372 L 268 396", "#4e7a34", 8) +
    // surface sheen
    L("M 150 210 C 210 184 300 180 366 202", "#c98274", 9, { opacity: 0.7 }) +
    shine(160, 240, 24, 40, -24, 0.28) +
    T(256, 492, 30, "#5e2c27", "liver"),
  );
}

function kidneyGen(): string {
  const d = defs(lg("kdg", [["#c96a5e", 0], ["#a84a48", 0.6], ["#843236", 1]], 115));
  const one = (dx: number, flip: number) =>
    `<g transform="translate(${dx} 0) scale(${flip} 1)">` +
    P("M 256 140 C 196 140 150 190 150 258 C 150 330 200 384 262 384 C 292 384 306 364 300 340 C 296 322 282 314 282 296 C 282 278 298 272 312 274 C 336 278 352 262 350 230 C 346 176 310 140 256 140 Z", "url(#kdg)", 9) +
    P("M 262 180 C 236 196 222 226 224 262 C 226 292 240 316 262 330", "#7c2733", 7, { opacity: 0.8 }) +
    L("M 300 180 C 322 196 336 222 338 250", "#7c2733", 6, { opacity: 0.7 }) +
    L("M 344 250 C 368 254 388 268 398 292", "#e8b04a", 12) + // ureter
    `</g>`;
  return doc(512, 512, "Kidneys", d +
    shadow(256, 452, 150, 18) + one(0, 1) + one(90, -1) +
    T(256, 496, 30, "#7c2733", "kidneys"),
  );
}

function toothGen(): string {
  const d = defs(lg("ttg", [["#ffffff", 0], ["#fdf6ec", 0.55], ["#f0e2cc", 1]]));
  return doc(512, 512, "Tooth", d +
    shadow(256, 458, 110, 18) +
    P("M 148 150 C 160 108 208 92 256 96 C 304 92 352 108 364 150 C 376 194 368 234 354 274 C 342 310 338 356 330 398 C 324 430 288 434 278 402 C 270 374 268 344 256 344 C 244 344 242 374 234 402 C 224 434 188 430 182 398 C 174 356 170 310 158 274 C 144 234 136 194 148 150 Z", "url(#ttg)", 10) +
    shine(200, 160, 26, 40, -30, 0.75) +
    shine(290, 150, 12, 20, -30, 0.5) +
    // sparkle
    P("M 372 120 L 380 142 L 402 150 L 380 158 L 372 180 L 364 158 L 342 150 L 364 142 Z", "#ffd23e", 5, { stroke: "#e0a400" }) +
    T(256, 492, 30, "#8a7a5a", "tooth"),
  );
}

function boneJointGen(): string {
  const d = defs(lg("bng", [["#fffdf6", 0], ["#f5ecd8", 0.6], ["#e2d3b4", 1]]));
  const bone = (x: number, y: number, rot: number) =>
    `<g transform="rotate(${rot} ${x} ${y}) translate(${x} ${y})">` +
    // shaft
    P("M -26 -14 L 26 -14 L 26 14 L -26 14 Z", "url(#bng)", 9) +
    // left knob (double bump)
    P("M -26 -14 C -52 -18 -66 -2 -60 14 C -56 26 -42 30 -30 24 L -26 14 Z", "url(#bng)", 9) +
    P("M -26 14 C -52 18 -66 34 -58 50 C -52 62 -36 62 -26 52 Z", "url(#bng)", 9) +
    // right knob
    P("M 26 -16 C 52 -22 66 -6 60 10 C 56 24 42 28 30 22 L 26 12 Z", "url(#bng)", 9) +
    P("M 26 12 C 52 18 66 34 58 50 C 52 62 36 62 26 52 Z", "url(#bng)", 9) +
    shine(-38, 2, 10, 16, -18, 0.6) +
    `</g>`;
  return doc(512, 512, "Bone and joint", d +
    shadow(256, 468, 130, 18) +
    bone(256, 150, 14) +
    bone(256, 380, 194) +
    // joint capsule + cartilage
    E(256, 265, 64, 52, "#f6d8b8", { sw: 9 }) +
    C(256, 265, 26, "#ff8c42", { sw: 7 }) +
    shine(246, 254, 9, 7, 0, 0.6) +
    // ligaments
    L("M 186 180 C 208 216 208 250 190 286 M 326 180 C 304 216 304 250 322 286", "#e8b06a", 9, { opacity: 0.85 }) +
    // motion spark
    P("M 356 236 L 364 258 L 386 266 L 364 274 L 356 296 L 348 274 L 326 266 L 348 258 Z", "#ffd23e", 4, { stroke: "#e0a400" }) +
    T(256, 500, 30, "#8a7a5a", "joint"),
  );
}

// ----------------------------------------------------------------- cells ---

function animalCellGen(): string {
  const d = defs(
    rg("acg", [["#ffe9f2", 0], ["#ffc9de", 0.6], ["#f2a0c0", 1]], 0.4, 0.35),
    rg("nuc", [["#8a6ff0", 0], ["#6a4dd8", 0.65], ["#5235b0", 1]], 0.42, 0.38),
  );
  const organelles = [
    [352, 190, "#ffb703", 22], [376, 268, "#57b85c", 18], [330, 330, "#4d9de0", 20],
    [190, 330, "#ff8c42", 18], [162, 200, "#e8483f", 15], [268, 140, "#8ed1ff", 14],
  ].map(([x, y, c, r]) =>
    P(`M ${(x as number) - (r as number)} ${y} a ${r} ${(r as number) * 0.62} 0 1 0 ${(r as number) * 2} 0 a ${r} ${(r as number) * 0.62} 0 1 0 ${-(r as number) * 2} 0`, c as string, 5, { stroke: INK, opacity: 0.95 })).join("");
  const crista = [
    [352, 190], [376, 268], [330, 330], [190, 330], [162, 200], [268, 140],
  ].map(([x, y], i) => L(`M ${x - 12} ${y - 6} q 12 ${i % 2 ? 14 : -14} 24 0`, "#ffffff", 3, { opacity: 0.6 })).join("");
  return doc(512, 512, "Animal cell", d +
    shadow(256, 462, 170, 20) +
    // membrane
    E(256, 262, 200, 168, "url(#acg)", { sw: 11 }) +
    // cytoplasm texture
    L("M 120 300 q 30 18 60 6 M 330 366 q 26 -10 44 -30 M 150 190 q 26 -12 50 -4", "#f2a0c0", 6, { opacity: 0.5 }) +
    // nucleus
    C(256, 262, 62, "url(#nuc)", { sw: 8 }) +
    C(242, 248, 16, "#3d2b8f", { opacity: 0.9 }) +
    C(238, 240, 6, "#ffffff", { opacity: 0.7 }) +
    // organelles + ER
    organelles + crista +
    L("M 140 250 C 170 260 180 290 160 310 M 370 320 C 344 330 336 352 350 372", "#e088aa", 7, { opacity: 0.7 }) +
    shine(180, 170, 30, 18, -22, 0.5) +
    T(256, 496, 30, "#a34a72", "animal cell"),
  );
}

function plantCellGen(): string {
  const d = defs(
    rg("pcg", [["#e2f7d9", 0], ["#bfe8ae", 0.6], ["#9ed488", 1]], 0.4, 0.35),
    rg("pnc", [["#8a6ff0", 0], ["#6a4dd8", 0.7], ["#5235b0", 1]], 0.42, 0.38),
  );
  const chloro = (x: number, y: number, rot: number) =>
    `<g transform="rotate(${rot} ${x} ${y})">` +
    P(`M ${x - 26} ${y} a 26 15 0 1 0 52 0 a 26 15 0 1 0 -52 0`, "#57b85c", 5, { stroke: "#2e5b31" }) +
    L(`M ${x - 14} ${y - 4} q 14 ${8} 28 0 M ${x - 12} ${y + 4} q 12 ${6} 24 0`, "#2e8b3a", 4, { opacity: 0.9 }) +
    `</g>`;
  return doc(512, 512, "Plant cell", d +
    shadow(256, 462, 170, 20) +
    // cell wall (outer, rigid)
    E(256, 262, 206, 172, "#6fae54", { sw: 11 }) +
    // membrane
    E(256, 262, 192, 158, "url(#pcg)", { sw: 7, stroke: "#4e8a3a" }) +
    // large vacuole
    P("M 200 180 C 260 156 330 178 342 234 C 352 284 314 330 254 336 C 196 342 158 306 162 258 C 165 222 178 194 200 180 Z", "#cdeffc", 8, { stroke: "#5aa8c9", opacity: 0.95 }) +
    shine(230, 220, 26, 14, -20, 0.55) +
    // nucleus
    C(352, 320, 44, "url(#pnc)", { sw: 7 }) +
    C(344, 312, 10, "#3d2b8f", { opacity: 0.9 }) +
    // chloroplasts
    chloro(160, 210, -18) + chloro(190, 350, 14) + chloro(330, 180, 22) +
    // cell wall texture
    L("M 90 210 L 422 210 M 90 316 L 422 316", "#4e8a3a", 4, { opacity: 0.35 }) +
    T(256, 496, 30, "#3e7a2e", "plant cell"),
  );
}

function bacteriaGen(): string {
  const d = defs(lg("bct", [["#9ee85f", 0], ["#6fcf4a", 0.55], ["#3e9a30", 1]], 0));
  return doc(512, 512, "Bacterium", d +
    shadow(256, 440, 160, 20) +
    // flagella
    L("M 396 236 C 440 210 462 240 444 268 C 430 290 448 306 470 296", "#3e9a30", 8) +
    L("M 402 282 C 446 268 462 300 442 322", "#3e9a30", 7) +
    // body (capsule)
    P("M 140 214 C 168 160 280 150 352 178 C 408 200 428 246 412 288 C 394 334 300 356 216 344 C 148 334 112 288 122 254 C 128 234 132 228 140 214 Z", "url(#bct)", 10) +
    // internal DNA
    L("M 180 250 C 210 226 240 274 272 250 C 300 230 322 268 348 252", "#2e7a24", 8, { opacity: 0.85, dash: "14 10" }) +
    // ribosomes
    C(200, 300, 9, "#2e7a24", { opacity: 0.7 }) + C(320, 216, 8, "#2e7a24", { opacity: 0.6 }) + C(270, 312, 7, "#2e7a24", { opacity: 0.6 }) +
    // pili
    L("M 150 200 C 128 176 118 158 120 140 M 220 168 C 214 148 216 132 226 118 M 300 164 C 304 146 314 132 330 124", "#3e9a30", 6, { opacity: 0.8 }) +
    shine(200, 210, 34, 16, -12, 0.5) +
    T(256, 420, 30, "#2e7a24", "bacteria"),
  );
}

function redBloodCellGen(): string {
  const d = defs(rg("rbc", [["#ff8a7a", 0], ["#e8483f", 0.55], ["#a8202e", 1]], 0.38, 0.32));
  const cell = (x: number, y: number, s: number, rot: number) =>
    `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">` +
    E(0, 0, 84, 62, "url(#rbc)", { sw: 9 }) +
    E(0, 4, 34, 20, "#a8202e", { opacity: 0.85 }) +
    E(-30, -22, 16, 8, "#ffb3a8", { rot: -20, opacity: 0.8 }) +
    `</g>`;
  return doc(512, 512, "Red blood cells", d +
    shadow(256, 462, 150, 20) +
    cell(180, 210, 1.15, -12) + cell(340, 300, 0.9, 16) + cell(300, 140, 0.55, 8) + cell(150, 370, 0.6, -6) +
    T(256, 496, 28, "#8c1f2a", "red blood cells"),
  );
}

function whiteBloodCellGen(): string {
  const d = defs(rg("wbc", [["#e8f2ff", 0], ["#b8d4f5", 0.55], ["#7ea8d8", 1]], 0.4, 0.32));
  return doc(512, 512, "White blood cell", d +
    shadow(256, 460, 150, 20) +
    // blobby lobed nucleus cell
    P("M 256 108 C 320 96 380 140 396 204 C 410 260 392 320 348 356 C 306 390 236 396 186 368 C 132 338 108 276 122 216 C 138 152 192 120 256 108 Z", "url(#wbc)", 10) +
    // lobed nucleus (purple)
    P("M 216 170 C 254 154 288 176 292 210 C 316 202 342 220 340 250 C 338 276 318 290 296 286 C 300 312 280 334 254 330 C 232 326 220 308 224 288 C 200 294 176 278 174 252 C 172 228 190 208 214 208 C 206 192 206 180 216 170 Z", "#8a6ff0", 8, { stroke: "#5235b0" }) +
    // granules
    C(330, 190, 8, "#7ea8d8", { opacity: 0.8 }) + C(180, 320, 7, "#7ea8d8", { opacity: 0.7 }) + C(352, 320, 6, "#7ea8d8", { opacity: 0.6 }) +
    shine(200, 160, 28, 16, -22, 0.6) +
    // germ being absorbed
    C(430, 150, 20, "#e8483f", { sw: 5 }) + L("M 420 150 L 440 150 M 430 140 L 430 160", "#8c1f2a", 4) +
    T(256, 496, 28, "#4a6a9a", "white blood cell"),
  );
}

function virusGen(): string {
  const d = defs(rg("vrg", [["#b06ff0", 0], ["#8a3fd8", 0.55], ["#5c1fa8", 1]], 0.4, 0.32));
  const spike = (a: number) => {
    const r1 = 108, r2 = 148, rad = (a * Math.PI) / 180;
    const x1 = 256 + Math.cos(rad) * r1, y1 = 236 + Math.sin(rad) * r1;
    const x2 = 256 + Math.cos(rad) * r2, y2 = 236 + Math.sin(rad) * r2;
    return L(`M ${x1} ${y1} L ${x2} ${y2}`, "#5c1fa8", 9) + C(x2, y2, 14, "#b06ff0", { sw: 5, stroke: "#5c1fa8" });
  };
  return doc(512, 512, "Virus", d +
    shadow(256, 452, 130, 20) +
    [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(spike).join("") +
    C(256, 236, 110, "url(#vrg)", { sw: 10 }) +
    // RNA squiggle
    L("M 200 236 C 220 200 250 272 276 232 C 292 206 316 250 322 230", "#e8c6ff", 8, { opacity: 0.9 }) +
    shine(220, 200, 26, 16, -24, 0.55) +
    T(256, 452, 30, "#5c1fa8", "virus"),
  );
}

function mitochondrionGen(): string {
  const d = defs(rg("mtg", [["#ffb87a", 0], ["#f28a4a", 0.55], ["#d05f28", 1]], 0.4, 0.32));
  const cristae = Array.from({ length: 6 }, (_, i) => {
    const x = 150 + i * 36;
    return L(`M ${x} 190 C ${x - 16} 236 ${x - 16} 288 ${x} 330`, "#a8441a", 9, { opacity: 0.85 });
  }).join("");
  return doc(512, 512, "Mitochondrion", d +
    shadow(256, 428, 170, 20) +
    E(256, 260, 182, 108, "url(#mtg)", { sw: 10 }) +
    E(256, 260, 150, 80, "#ffcf9e", { opacity: 0.5 }) +
    cristae +
    shine(190, 214, 30, 12, -10, 0.5) +
    // ATP sparks
    C(452, 150, 8, "#ffd23e", { sw: 4, stroke: "#e0a400" }) + C(478, 186, 6, "#ffd23e", { sw: 4, stroke: "#e0a400" }) +
    L("M 430 176 L 444 162", "#e0a400", 5, { opacity: 0.7 }) +
    T(256, 420, 30, "#a8441a", "mitochondrion"),
  );
}

function dnaGen(): string {
  const rungs: string[] = [];
  const colors = ["#e8483f", "#4d9de0", "#57b85c", "#ffb703", "#8a6ff0"];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const y = 100 + t * 312;
    const spread = 96 * Math.abs(Math.cos((t * Math.PI * 2.2) + 0.6));
    const c = colors[i % colors.length];
    rungs.push(L(`M ${256 - spread} ${y} L ${256 + spread} ${y}`, c, 14));
    rungs.push(C(256 - spread, y, 15, c, { sw: 5 }));
    rungs.push(C(256 + spread, y, 15, c, { sw: 5 }));
  }
  const strand = (dir: number, col: string) => {
    let dPath = "";
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const y = 84 + t * 344;
      const x = 256 + dir * 96 * Math.cos((t * Math.PI * 2.2) + 0.6);
      dPath += (i === 0 ? "M" : " L") + ` ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return L(dPath, col, 13);
  };
  return doc(512, 512, "DNA double helix", defs() +
    shadow(256, 470, 130, 16) +
    strand(1, "#3a86ff") + strand(-1, "#e8483f") + rungs.join("") +
    T(256, 496, 30, "#4a5a8c", "DNA"),
  );
}

function neuronGen(): string {
  const d = defs(rg("nrg", [["#ffe9a8", 0], ["#ffcf5e", 0.6], ["#e8a83e", 1]], 0.4, 0.35));
  const dend = (a: number, len: number, branch: boolean) => {
    const rad = (a * Math.PI) / 180;
    const x1 = 170 + Math.cos(rad) * 46, y1 = 230 + Math.sin(rad) * 46;
    const x2 = 170 + Math.cos(rad) * (46 + len), y2 = 230 + Math.sin(rad) * (46 + len);
    const mx = 170 + Math.cos(rad + 0.3) * (46 + len * 0.6), my = 230 + Math.sin(rad + 0.3) * (46 + len * 0.6);
    return L(`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`, "#c98a3e", 8) +
      (branch ? L(`M ${x2} ${y2} L ${x2 + 18} ${y2 - 14} M ${x2} ${y2} L ${x2 + 16} ${y2 + 18}`, "#c98a3e", 6) : "");
  };
  return doc(512, 512, "Neuron", d +
    shadow(256, 466, 150, 18) +
    // dendrites
    [150, 110, 70, 30, 350, 390, 430].map((a) => dend(a, 58 + (a % 3) * 14, true)).join("") +
    // cell body
    C(170, 230, 52, "url(#nrg)", { sw: 9 }) +
    C(158, 218, 12, "#8a5a1e", { opacity: 0.8 }) +
    shine(154, 212, 10, 7, 0, 0.7) +
    // axon
    L("M 220 244 C 280 258 300 268 320 274", "#c98a3e", 14) +
    // myelin sheath
    R(310, 254, 52, 40, 18, "#8a6ff0", { sw: 7 }) +
    R(362, 258, 52, 40, 18, "#8a6ff0", { sw: 7 }) +
    // axon terminals
    L("M 414 278 C 444 282 460 292 472 308 M 414 278 C 440 266 462 268 478 276", "#c98a3e", 9) +
    C(474, 310, 10, "#ffb703", { sw: 5 }) + C(480, 274, 10, "#ffb703", { sw: 5 }) +
    T(256, 496, 30, "#8a5a1e", "neuron"),
  );
}

function amoebaGen(): string {
  const d = defs(rg("amb", [["#c6f0ff", 0], ["#8ed1f5", 0.55], ["#4a9ad0", 1]], 0.4, 0.35));
  return doc(512, 512, "Amoeba", d +
    shadow(256, 452, 150, 18) +
    // blobby body with pseudopods
    P("M 256 120 C 320 108 380 150 388 210 C 394 254 368 270 380 306 C 392 344 366 388 318 396 C 280 402 262 380 228 392 C 196 404 156 396 138 362 C 122 330 140 306 122 274 C 104 240 118 186 162 158 C 192 138 224 126 256 120 Z", "url(#amb)", 10) +
    // nucleus
    C(290, 250, 40, "#6a4dd8", { sw: 6 }) + C(280, 240, 10, "#3d2b8f", { opacity: 0.8 }) +
    // vacuoles
    C(180, 300, 22, "#d6f4ff", { sw: 5 }) + C(340, 330, 16, "#d6f4ff", { sw: 4 }) + C(210, 190, 12, "#d6f4ff", { sw: 4 }) +
    shine(200, 170, 28, 16, -22, 0.55) +
    T(256, 490, 30, "#2e6a9a", "amoeba"),
  );
}

export const BIOLOGY_GENERATORS: Record<string, () => string> = {
  heart: heartGen,
  brain: brainGen,
  lungs: lungsGen,
  eye: eyeGen,
  ear: earGen,
  stomach: stomachGen,
  liver: liverGen,
  kidneys: kidneyGen,
  tooth: toothGen,
  "bone-joint": boneJointGen,
  neuron: neuronGen,
  "animal-cell": animalCellGen,
  "plant-cell": plantCellGen,
  bacteria: bacteriaGen,
  "red-blood-cells": redBloodCellGen,
  "white-blood-cell": whiteBloodCellGen,
  virus: virusGen,
  mitochondrion: mitochondrionGen,
  dna: dnaGen,
  amoeba: amoebaGen,
};
