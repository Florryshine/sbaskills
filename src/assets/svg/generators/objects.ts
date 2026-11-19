// SVG generators — classroom objects and backgrounds (800x450 scenes).
import { P, L, C, E, R, defs, lg, rg, shine, shadow, doc, T, INK } from "../kit";

// ------------------------------------------------------------- objects ---

function bookStackGen(): string {
  const book = (y: number, col: string, dark: string, w: number) =>
    P(`M ${256 - w} ${y} C ${256 - w + 14} ${y - 12} ${256 - 6} ${y - 14} ${256} ${y - 6} C ${256 + 6} ${y - 14} ${256 + w - 14} ${y - 12} ${256 + w} ${y} L ${256 + w} ${y + 30} C ${256 + w - 14} ${y + 22} ${256 + 6} ${y + 24} ${256} ${y + 32} C ${256 - 6} ${y + 24} ${256 - w + 14} ${y + 22} ${256 - w} ${y + 30} Z`, col, 7) +
    L(`M ${256} ${y - 6} L ${256} ${y + 32}`, dark, 5) +
    L(`M ${256 - w + 14} ${y + 8} C ${256 - w + 30} ${y + 2} ${256 - 16} ${y + 2} ${256 - 6} ${y + 8} M ${256 + 8} ${y + 8} C ${256 + 18} ${y + 2} ${256 + w - 30} ${y + 2} ${256 + w - 14} ${y + 8}`, "#ffffff", 4, { opacity: 0.7 });
  return doc(512, 512, "Stack of books", defs() +
    shadow(256, 462, 150, 18) +
    book(430, "#e8483f", "#8c1f2a", 150) +
    book(392, "#4d9de0", "#1e4a6e", 132) +
    book(354, "#57b85c", "#2e6a1e", 144) +
    // apple on top
    C(256, 322, 26, "#ff8c42", { sw: 6, stroke: "#b85a1e" }) +
    L("M 256 300 C 258 290 262 284 268 280", "#5e3a1e", 5) +
    P("M 258 288 C 268 278 280 276 286 282 C 280 292 266 294 258 288 Z", "#57b85c", 4) +
    shine(246, 314, 8, 12, -24, 0.7) +
    T(256, 500, 30, "#4a4a68", "books"),
  );
}

function pencilGen(): string {
  return doc(512, 512, "Pencil", defs(lg("pcg", [["#ffb35c", 0], ["#f28a4a", 1]])) +
    shadow(256, 470, 150, 14) +
    `<g transform="rotate(-32 256 256)">` +
    // body
    R(156, 226, 200, 60, 6, "url(#pcg)", { sw: 8 }) +
    L("M 156 256 L 356 256", "#e8a86a", 4, { opacity: 0.7 }) +
    // ferrule
    R(340, 226, 26, 60, 4, "#9aa8b8", { sw: 6 }) +
    R(364, 226, 22, 60, 4, "#8a98a8", { sw: 6 }) +
    // eraser
    R(384, 230, 40, 52, 16, "#ff9db0", { sw: 7, stroke: "#d86a80" }) +
    // tip
    P("M 156 226 L 92 248 L 156 286 Z", "#e8c6a0", 7) +
    P("M 112 240 L 92 248 L 116 258 Z", "#3d4454", 4) +
    shine(200, 238, 40, 8, 0, 0.5) +
    `</g>` +
    T(256, 500, 30, "#b85a1e", "pencil"),
  );
}

function globeGen(): string {
  return doc(512, 512, "Desk globe", defs(
    rg("glb", [["#7cc4ff", 0], ["#3a86ff", 0.6], ["#1e5e94", 1]], 0.38, 0.32),
    lg("gld", [["#8ed15c", 0], ["#4e9a2e", 1]]),
  ) + shadow(256, 478, 120, 14) +
    // stand arc
    P("M 150 130 C 110 190 110 300 150 360 C 170 390 210 410 256 412 L 256 372 C 220 368 194 350 178 322 C 156 282 158 208 180 168 Z", "#ffb703", 8, { stroke: "#c9860a" }) +
    // sphere
    C(256, 250, 140, "url(#glb)", { sw: 9 }) +
    // continents
    P("M 190 180 C 226 160 270 168 286 196 C 298 220 284 240 258 244 C 274 262 272 284 252 296 C 224 312 186 300 172 270 C 158 240 168 200 190 180 Z", "url(#gld)", 5, { stroke: "#2e6a1e" }) +
    P("M 310 160 C 334 154 356 166 362 186 C 368 206 356 222 336 224 C 314 226 298 214 294 196 C 292 178 298 164 310 160 Z", "url(#gld)", 5, { stroke: "#2e6a1e" }) +
    P("M 300 300 C 322 294 344 304 350 322 C 354 338 344 352 324 354 C 304 356 288 346 284 330 C 282 316 288 304 300 300 Z", "url(#gld)", 5, { stroke: "#2e6a1e" }) +
    // meridian
    E(256, 250, 54, 140, "none", { sw: 5, stroke: "#9cc8ff", opacity: 0.7 }) +
    L("M 116 250 L 396 250", "#9cc8ff", 5, { opacity: 0.7 }) +
    shine(206, 190, 26, 16, -24, 0.5) +
    // base
    P("M 210 452 C 220 428 292 428 302 452 C 296 462 216 462 210 452 Z", "#c9860a", 7, { stroke: "#a86a00" }) +
    T(256, 502, 30, "#1e5e94", "globe"),
  );
}

function clockGen(): string {
  return doc(512, 512, "Clock", defs(rg("clg", [["#ff8fb3", 0], ["#f26a98", 0.6], ["#d64a80", 1]], 0.38, 0.32)) +
    shadow(256, 478, 140, 14) +
    C(256, 250, 158, "url(#clg)", { sw: 10 }) +
    C(256, 250, 122, "#fffdf6", { sw: 6, stroke: "#e2d4b8" }) +
    // ticks
    Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180;
      const x1 = 256 + Math.cos(a) * 96, y1 = 250 + Math.sin(a) * 96;
      const x2 = 256 + Math.cos(a) * 110, y2 = 250 + Math.sin(a) * 110;
      return L(`M ${x1} ${y1} L ${x2} ${y2}`, "#5a6a80", 6);
    }).join("") +
    // hands (10:10 friendly)
    L("M 256 250 L 306 210", "#3d4454", 12) +
    L("M 256 250 L 236 176", "#3d4454", 10) +
    L("M 256 250 L 322 262", "#e8483f", 5) +
    C(256, 250, 12, "#3d4454") + C(256, 250, 5, "#ffd23e") +
    shine(196, 170, 24, 14, -24, 0.5) +
    T(256, 506, 30, "#c04a78", "clock"),
  );
}

function abacusGen(): string {
  const beads = (y: number, col: string, n: number, x0: number, gap: number) =>
    Array.from({ length: n }, (_, i) => E(x0 + i * gap, y, 13, 17, col, { sw: 4 })).join("");
  return doc(512, 512, "Abacus", defs() +
    shadow(256, 478, 150, 14) +
    // frame
    R(76, 110, 360, 300, 16, "#c98a4a", { sw: 10 }) +
    R(96, 130, 320, 260, 8, "#ffe9c2", { sw: 4 }) +
    // rods
    L("M 130 130 L 130 390 M 190 130 L 190 390 M 250 130 L 250 390 M 310 130 L 310 390 M 370 130 L 370 390", "#8a5a2e", 6) +
    // beads
    beads(170, "#e8483f", 3, 150, 40) + beads(250, "#4d9de0", 2, 170, 40) + beads(330, "#57b85c", 4, 210, 40) +
    shine(160, 160, 5, 8, 0, 0.5) +
    T(256, 502, 30, "#8a5a2e", "abacus"),
  );
}

// ---------------------------------------------------------- backgrounds ---

type BgGen = () => string;

function bgSkyGen(): string {
  return doc(800, 450, "Sunny sky background", defs(
    lg("sky", [["#8ed1ff", 0], ["#cfeaff", 0.7], ["#fff3d6", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#sky)") +
    C(660, 90, 54, "#FFCC00", { sw: 7, stroke: "#e8b400" }) +
    L("M 660 16 L 660 2 M 734 90 L 748 90 M 710 40 L 720 30 M 710 140 L 720 150 M 610 40 L 600 30", "#ffb703", 8) +
    E(150, 90, 60, 28, "#ffffff", { opacity: 0.95 }) + E(200, 100, 46, 22, "#ffffff", { opacity: 0.95 }) + E(110, 104, 42, 20, "#ffffff", { opacity: 0.9 }) +
    E(420, 60, 46, 20, "#ffffff", { opacity: 0.8 }) + E(456, 68, 34, 16, "#ffffff", { opacity: 0.8 }) +
    P("M 0 360 C 140 320 280 340 420 330 C 580 320 700 350 800 330 L 800 450 L 0 450 Z", "#8fce6a", 0) +
    P("M 0 380 C 150 350 300 368 460 356 C 620 346 720 372 800 356 L 800 450 L 0 450 Z", "#7abf5a", 0) +
    L("M 90 400 C 86 378 78 364 68 354 M 106 402 C 106 382 102 368 96 356 M 122 400 C 126 380 132 366 142 356", "#4e9a2e", 7, { opacity: 0.8 }) +
    L("M 640 396 C 636 374 628 360 618 350 M 656 398 C 656 378 652 364 646 352", "#4e9a2e", 7, { opacity: 0.8 }),
  );
}

function bgClassroomGen(): string {
  return doc(800, 450, "Classroom background", defs(
    lg("clw", [["#ffe9c2", 0], ["#ffd9a0", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#clw)") +
    R(0, 350, 800, 100, 0, "#c98a4a") +
    L("M 0 350 L 800 350 L 800 362 L 0 362 Z", "#a86a2e") +
    // blackboard
    R(210, 70, 380, 210, 12, "#2f5d50", { sw: 14, stroke: "#8a5a3b" }) +
    L("M 250 130 C 300 110 350 128 400 116 M 250 180 L 360 172 M 250 226 L 330 220 M 420 170 C 460 160 500 166 546 158", "#eaf6e8", 6, { opacity: 0.75, cap: "round" }) +
    C(560, 240, 10, "#ffd23e", { sw: 3, stroke: "#d8a400" }) +
    // alphabet cards
    R(60, 100, 90, 70, 8, "#ff8fb3", { sw: 5 }) + T(105, 152, 40, "#ffffff", "A") +
    R(650, 100, 90, 70, 8, "#7cc4ff", { sw: 5 }) + T(695, 152, 40, "#ffffff", "B") +
    // clock
    C(400, 34, 26, "#fffdf6", { sw: 6, stroke: "#c2b490" }) +
    L("M 400 34 L 400 18 M 400 34 L 410 38", "#3d4454", 4) +
    // desk edge + pencils
    R(320, 330, 160, 14, 7, "#ffb703", { sw: 4, stroke: "#c9860a", rot: -4 }) +
    // window
    R(40, 60, 110, 150, 10, "#bfe6ff", { sw: 8, stroke: "#8a98b8" }) +
    L("M 95 60 L 95 210 M 40 135 L 150 135", "#8a98b8", 6) +
    C(120, 92, 16, "#FFCC00", { opacity: 0.9 }),
  );
}

function bgSpaceGen(): string {
  const stars = Array.from({ length: 40 }, (_, i) => {
    const x = (i * 197) % 790, y = (i * 113) % 430;
    const r = 1.5 + ((i * 7) % 3);
    return C(x + 5, y + 10, r, "#ffffff", { opacity: 0.5 + ((i % 5) * 0.1) });
  }).join("");
  return doc(800, 450, "Outer space background", defs(
    lg("spx", [["#1a1040", 0], ["#2e1a5e", 0.6], ["#4a2a86", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#spx)") +
    stars +
    // planet with ring
    `<g transform="rotate(-14 620 120)">` + E(620, 120, 66, 20, "none", { sw: 9, stroke: "#e8c98a", opacity: 0.7 }) + `</g>` +
    C(620, 120, 42, "#f2c46a", { sw: 5, stroke: "#c8963e" }) +
    `<g transform="rotate(-14 620 120)">` + E(620, 120, 66, 20, "none", { sw: 5, stroke: "#e8c98a", opacity: 0.9 }) + `</g>` +
    // moon
    C(140, 110, 34, "#eae4d0", { sw: 4, stroke: "#a89f88" }) +
    C(128, 100, 7, "#cfc8b0") + C(150, 122, 5, "#cfc8b0") +
    // shooting star
    L("M 300 60 L 360 90", "#ffffff", 4, { opacity: 0.7 }) + C(364, 92, 5, "#ffffff", { opacity: 0.9 }) +
    // nebula wisps
    E(500, 300, 120, 40, "#8a6ff0", { opacity: 0.25, rot: -12 }) +
    E(240, 340, 90, 30, "#4d9de0", { opacity: 0.22, rot: 10 }) +
    P("M 0 420 C 200 390 500 440 800 400 L 800 450 L 0 450 Z", "#1a1040", 0),
  );
}

function bgUnderwaterGen(): string {
  const bubbles = Array.from({ length: 12 }, (_, i) =>
    C(60 + i * 64 + ((i * 37) % 20), 120 + ((i * 61) % 240), 5 + ((i * 13) % 8), "#bfe6ff", { opacity: 0.35 })).join("");
  return doc(800, 450, "Underwater background", defs(
    lg("uw", [["#2a9dd8", 0], ["#1668a8", 0.6], ["#0c4078", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#uw)") +
    // light rays
    P("M 200 0 L 260 0 L 200 300 Z", "#bfe6ff", 0, { opacity: 0.14 }) +
    P("M 460 0 L 520 0 L 430 320 Z", "#bfe6ff", 0, { opacity: 0.12 }) +
    bubbles +
    // seaweed
    L("M 90 450 C 70 380 110 330 86 260 C 76 224 96 190 88 160", "#3aa85c", 12, { cap: "round" }) +
    L("M 140 450 C 160 390 128 340 152 280 C 162 248 148 220 156 190", "#2e8b4a", 11, { cap: "round" }) +
    L("M 700 450 C 686 390 716 350 694 290 C 684 260 700 230 692 200", "#3aa85c", 12, { cap: "round" }) +
    // sand
    P("M 0 410 C 150 390 300 416 460 402 C 600 390 720 412 800 398 L 800 450 L 0 450 Z", "#e8d8a8", 0) +
    // fish school
    `<g fill="#ffb703">` +
    P("M 560 150 C 580 136 600 136 614 148 C 602 160 582 162 560 150 Z", "#ffb703", 5) + P("M 560 150 L 546 140 L 546 160 Z", "#e8960a", 4) +
    P("M 620 190 C 640 176 660 176 674 188 C 662 200 642 202 620 190 Z", "#ffb703", 5) + P("M 620 190 L 606 180 L 606 200 Z", "#e8960a", 4) +
    P("M 560 230 C 580 216 600 216 614 228 C 602 240 582 242 560 230 Z", "#ffb703", 5) + P("M 560 230 L 546 220 L 546 240 Z", "#e8960a", 4) +
    `</g>` +
    C(594, 146, 3, "#3d2f52") + C(654, 186, 3, "#3d2f52") + C(594, 226, 3, "#3d2f52") +
    // starfish
    P("M 320 424 L 330 404 L 340 424 L 360 424 L 344 438 L 350 458 L 330 446 L 310 458 L 316 438 L 300 424 Z", "#ff8a5c", 5, { stroke: "#d05f1e" }),
  );
}

function bgForestGen(): string {
  return doc(800, 450, "Forest background", defs(
    lg("frest", [["#bfe6c2", 0], ["#8ed1a0", 1]]),
    rg("frt", [["#6fbf6a", 0], ["#3e8a4a", 1]], 0.4, 0.3),
  ) +
    R(0, 0, 800, 450, 0, "url(#frest)") +
    C(680, 80, 44, "#FFCC00", { opacity: 0.9 }) +
    E(160, 100, 60, 24, "#ffffff", { opacity: 0.75 }) + E(204, 110, 40, 18, "#ffffff", { opacity: 0.7 }) +
    // back trees
    P("M 60 360 C 40 280 60 210 90 170 C 120 210 140 280 120 360 Z", "#5aa05a", 0, { opacity: 0.75 }) +
    P("M 660 360 C 640 280 660 210 690 170 C 720 210 740 280 720 360 Z", "#5aa05a", 0, { opacity: 0.75 }) +
    // mid trees
    `<g>` +
    R(180, 260, 36, 110, 8, "#7a4a26") +
    C(198, 210, 74, "url(#frt)", { sw: 8 }) + C(160, 250, 52, "url(#frt)", { sw: 7 }) + C(238, 248, 50, "url(#frt)", { sw: 7 }) +
    R(560, 250, 40, 120, 8, "#6a3e1e") +
    C(580, 196, 82, "url(#frt)", { sw: 8 }) + C(536, 240, 56, "url(#frt)", { sw: 7 }) + C(626, 238, 54, "url(#frt)", { sw: 7 }) +
    `</g>` +
    // ground
    P("M 0 370 C 200 350 500 380 800 360 L 800 450 L 0 450 Z", "#6abf5a", 0) +
    P("M 0 400 C 250 380 550 410 800 390 L 800 450 L 0 450 Z", "#57b85c", 0) +
    // mushrooms + flowers
    P("M 330 428 C 326 410 330 398 338 390 C 346 398 350 410 346 428 Z", "#fff4e0", 4) +
    E(338, 386, 20, 12, "#e8483f", { sw: 4 }) +
    C(460, 430, 8, "#ff8fb3") + C(478, 424, 6, "#ffd23e") + C(440, 420, 5, "#7cc4ff") +
    L("M 460 438 L 460 424 M 440 428 L 440 416", "#3e8a4a", 4),
  );
}

function bgCityGen(): string {
  const windows = (x: number, y: number, w: number, h: number, col: string) => {
    let out = "";
    for (let wy = y + 12; wy < y + h - 14; wy += 26) {
      for (let wx = x + 10; wx < x + w - 16; wx += 22) {
        if ((wx * 7 + wy * 13) % 5 !== 0) out += R(wx, wy, 10, 12, 2, col, { opacity: 0.85 });
      }
    }
    return out;
  };
  return doc(800, 450, "City street background", defs(
    lg("cty", [["#8ed1ff", 0], ["#ffe9c2", 0.8], ["#ffd9a0", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#cty)") +
    C(120, 80, 40, "#FFCC00", { opacity: 0.95 }) +
    E(300, 70, 50, 22, "#ffffff", { opacity: 0.9 }) + E(344, 78, 36, 16, "#ffffff", { opacity: 0.9 }) +
    // back buildings
    R(40, 190, 120, 190, 6, "#b8a8c8", { sw: 6 }) + windows(40, 190, 120, 190, "#8a7aa0") +
    R(190, 150, 140, 230, 6, "#a0b8d0", { sw: 6 }) + windows(190, 150, 140, 230, "#7a98b8") +
    R(360, 200, 110, 180, 6, "#c8b8a8", { sw: 6 }) + windows(360, 200, 110, 180, "#a08878") +
    R(500, 140, 150, 240, 6, "#b8c8a8", { sw: 6 }) + windows(500, 140, 150, 240, "#8aa078") +
    R(680, 210, 100, 170, 6, "#c8a8b8", { sw: 6 }) + windows(680, 210, 100, 170, "#a07888") +
    // road
    R(0, 380, 800, 70, 0, "#5a6a7a") +
    L("M 30 415 L 110 415 M 190 415 L 270 415 M 350 415 L 430 415 M 510 415 L 590 415 M 670 415 L 750 415", "#ffd23e", 8, { opacity: 0.9 }) +
    // street lamp
    L("M 700 380 L 700 280 L 740 280", "#3d4454", 8) + C(748, 284, 10, "#ffd23e", { sw: 4, stroke: "#c9a400" }),
  );
}

function bgLabGen(): string {
  return doc(800, 450, "Laboratory background", defs(
    lg("lab", [["#eaf2f8", 0], ["#d0e2ee", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#lab)") +
    // wall tiles
    L("M 0 90 L 800 90 M 0 180 L 800 180 M 0 270 L 800 270 M 200 0 L 200 270 M 400 0 L 400 270 M 600 0 L 600 270", "#c2d8e8", 5, { opacity: 0.6 }) +
    // shelves with jars
    R(60, 100, 260, 12, 6, "#c98a4a", { sw: 5 }) +
    R(80, 60, 34, 40, 6, "#a8d8f0", { sw: 4 }) + R(130, 52, 30, 48, 6, "#b8e986", { sw: 4 }) + R(180, 64, 36, 36, 6, "#ffd9a0", { sw: 4 }) + R(240, 56, 30, 44, 6, "#ffb3c8", { sw: 4 }) +
    // periodic table poster
    R(560, 40, 180, 120, 8, "#fffdf6", { sw: 5 }) +
    Array.from({ length: 12 }, (_, i) => R(574 + (i % 6) * 26, 56 + Math.floor(i / 6) * 26, 20, 20, 3, ["#ffb3c8", "#b8e986", "#a8d8f0", "#ffd9a0"][i % 4])).join("") +
    // bench
    R(0, 300, 800, 24, 4, "#8a98a8") +
    R(60, 324, 680, 126, 0, "#b8c4d0") +
    R(90, 340, 120, 90, 8, "#9aa8b8", { sw: 5 }) + R(600, 340, 120, 90, 8, "#9aa8b8", { sw: 5 }) +
    // equipment on bench
    P("M 300 250 L 300 280 L 270 330 C 265 342 274 352 286 352 L 334 352 C 346 352 355 342 350 330 L 320 280 L 320 250 Z", "#a8d8f0", 6, { opacity: 0.8 }) +
    P("M 285 310 L 335 310 L 350 330 C 355 342 346 352 334 352 L 286 352 C 274 352 265 342 270 330 Z", "#b06ff0", 5, { stroke: "#7a4dd8" }) +
    R(312, 238, 26, 12, 5, "#8a98a8") +
    R(420, 290, 60, 62, 8, "#d8f0ff", { sw: 6, opacity: 0.85 }) + R(424, 316, 52, 32, 6, "#57b85c", { opacity: 0.9 }) +
    C(450, 250, 16, "#ffd23e", { sw: 4, stroke: "#c9a400" }),
  );
}

function bgFarmGen(): string {
  return doc(800, 450, "Farm background", defs(
    lg("frm", [["#8ed1ff", 0], ["#d8f0c2", 1]]),
    lg("frmg", [["#9ed15c", 0], ["#6fb84e", 1]]),
  ) +
    R(0, 0, 800, 450, 0, "url(#frm)") +
    C(670, 80, 42, "#FFCC00", { sw: 6, stroke: "#e8b400" }) +
    E(150, 80, 54, 24, "#ffffff", { opacity: 0.9 }) + E(194, 90, 38, 18, "#ffffff", { opacity: 0.9 }) +
    // hills
    P("M 0 260 C 160 200 340 210 500 250 C 640 284 740 260 800 250 L 800 450 L 0 450 Z", "url(#frmg)", 0) +
    // barn
    P("M 520 260 L 520 170 L 600 130 L 680 170 L 680 260 Z", "#e8483f", 8, { stroke: "#8c1f2a" }) +
    P("M 505 175 L 600 125 L 695 175", "#8c1f2a", 0) +
    R(570, 190, 60, 70, 6, "#8c1f2a") +
    L("M 570 190 L 630 260 M 630 190 L 570 260", "#e8483f", 5) +
    // fence
    L("M 60 320 L 60 360 M 110 320 L 110 360 M 160 320 L 160 360 M 210 320 L 210 360 M 40 332 L 230 332 M 40 350 L 230 350", "#c98a4a", 8) +
    // field rows
    P("M 0 330 C 200 310 500 330 800 315 L 800 450 L 0 450 Z", "#8ed15c", 0) +
    L("M 80 380 C 280 366 520 380 720 368 M 120 410 C 320 396 480 410 680 398", "#5a9a3e", 6, { opacity: 0.7 }) +
    // crops
    L("M 300 360 C 296 340 290 330 282 322 M 316 362 C 316 344 314 332 310 322 M 332 360 C 336 342 342 332 350 324", "#4e9a2e", 6),
  );
}

export const OBJECT_GENERATORS: Record<string, () => string> = {
  "book-stack": bookStackGen,
  pencil: pencilGen,
  globe: globeGen,
  clock: clockGen,
  abacus: abacusGen,
};

export const BACKGROUND_GENERATORS: Record<string, () => string> = {
  "bg-sky": bgSkyGen,
  "bg-classroom": bgClassroomGen,
  "bg-space": bgSpaceGen,
  "bg-underwater": bgUnderwaterGen,
  "bg-forest": bgForestGen,
  "bg-city": bgCityGen,
  "bg-laboratory": bgLabGen,
  "bg-farm": bgFarmGen,
};
