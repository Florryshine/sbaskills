#!/usr/bin/env python3
"""Generate one deterministic photosynthesis board and narration for renderer comparison."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
W, H, S = 1080, 1350, 2
INK = (30, 42, 48)
GREEN = (38, 115, 74)
BLUE = (44, 105, 160)
GOLD = (188, 132, 30)
MUTED = (92, 103, 108)


def font(size: int, bold: bool = False):
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu") / name,
        Path("C:/Windows/Fonts") / ("arialbd.ttf" if bold else "arial.ttf"),
    ]
    for path in candidates:
        if path.exists():
            return ImageFont.truetype(str(path), size * S)
    return ImageFont.load_default()


def main() -> None:
    image = Image.new("RGB", (W*S, H*S), "white")
    d = ImageDraw.Draw(image)

    def line(points, fill=INK, width=7):
        d.line([(int(x*S), int(y*S)) for x, y in points], fill=fill, width=width*S, joint="curve")

    def ellipse(box, outline=INK, width=6, fill=None):
        d.ellipse(tuple(int(v*S) for v in box), outline=outline, width=width*S, fill=fill)

    def label(text, center, size=25, fill=INK, bold=True):
        f = font(size, bold)
        box = d.textbbox((0, 0), text, font=f)
        x = int(center[0]*S - (box[2]-box[0])/2)
        y = int(center[1]*S - (box[3]-box[1])/2 - box[1])
        d.text((x, y), text, font=f, fill=fill)

    def arrow(points, color=BLUE, width=7, head=18):
        line(points, color, width)
        x1, y1 = points[-2]
        x2, y2 = points[-1]
        import math
        a = math.atan2(y2-y1, x2-x1)
        p1 = (x2-head*math.cos(a-0.55), y2-head*math.sin(a-0.55))
        p2 = (x2-head*math.cos(a+0.55), y2-head*math.sin(a+0.55))
        d.polygon([(int(x2*S),int(y2*S)),(int(p1[0]*S),int(p1[1]*S)),(int(p2[0]*S),int(p2[1]*S))], fill=color)

    # Header
    label("PHOTOSYNTHESIS", (540, 78), 48, INK)
    line([(270, 125), (810, 125)], GOLD, 4)

    # Sun + light rays
    ellipse((95, 205, 235, 345), GOLD, 8, (255, 245, 210))
    for a in range(0, 360, 45):
        import math
        cx, cy, r1, r2 = 165, 275, 88, 112
        line([(cx+r1*math.cos(math.radians(a)), cy+r1*math.sin(math.radians(a))),
              (cx+r2*math.cos(math.radians(a)), cy+r2*math.sin(math.radians(a)))], GOLD, 6)
    label("SUNLIGHT", (165, 375), 23, GOLD)

    # Plant stem, leaves and roots
    line([(535, 990), (535, 500), (520, 410)], GREEN, 13)
    # left leaf
    d.ellipse((300*S, 470*S, 540*S, 650*S), outline=GREEN, width=9*S, fill=(231, 246, 232))
    line([(330, 610), (500, 510)], GREEN, 5)
    # right leaf
    d.ellipse((525*S, 390*S, 790*S, 585*S), outline=GREEN, width=9*S, fill=(231, 246, 232))
    line([(550, 560), (750, 420)], GREEN, 5)
    # smaller upper leaf
    d.ellipse((430*S, 285*S, 620*S, 435*S), outline=GREEN, width=8*S, fill=(238, 249, 236))
    line([(450, 415), (590, 305)], GREEN, 5)
    # roots
    for pts in [
        [(535, 990), (470, 1080), (430, 1170)],
        [(535, 990), (555, 1100), (535, 1200)],
        [(535, 990), (640, 1080), (690, 1160)],
        [(490, 1045), (405, 1085)],
        [(590, 1045), (680, 1075)],
    ]:
        line(pts, INK, 6)
    line([(250, 995), (830, 995)], MUTED, 4)
    label("GREEN PLANT", (535, 245), 24, GREEN)

    # Inputs
    label("CARBON DIOXIDE", (190, 520), 22, BLUE)
    label("(CO₂)", (190, 555), 22, BLUE)
    arrow([(245, 575), (345, 575), (420, 555)], BLUE, 7)
    label("WATER", (165, 890), 23, BLUE)
    label("(H₂O)", (165, 925), 22, BLUE)
    arrow([(235, 910), (350, 910), (470, 1030)], BLUE, 7)

    # Light energy
    arrow([(245, 320), (330, 360), (440, 445)], GOLD, 8)
    label("LIGHT ENERGY", (330, 285), 20, GOLD)

    # Outputs
    label("GLUCOSE", (875, 510), 25, GREEN)
    label("(SUGAR)", (875, 545), 20, GREEN)
    arrow([(760, 510), (830, 510)], GREEN, 7)
    label("OXYGEN", (880, 700), 25, BLUE)
    label("(O₂)", (880, 735), 22, BLUE)
    arrow([(760, 570), (820, 665)], BLUE, 7)

    # Soil/roots note and equation
    label("ROOTS ABSORB WATER", (535, 1235), 20, MUTED)
    label("CO₂ + H₂O + LIGHT  →  GLUCOSE + O₂", (540, 1300), 24, INK)

    image = image.resize((W, H), Image.Resampling.LANCZOS)
    image.save(ROOT / "photosynthesis.png", optimize=True)

    narration = (
        "Photosynthesis is the process by which green plants make their food. "
        "Chlorophyll in the leaves captures energy from sunlight. "
        "The plant takes in carbon dioxide from the air and absorbs water through its roots. "
        "Using light energy, it converts these raw materials into glucose. "
        "Oxygen is released into the atmosphere. "
        "The glucose provides food and energy for the plant."
    )
    (ROOT / "narration.txt").write_text(narration, encoding="utf-8")
    subprocess.run(
        ["espeak-ng", "-v", "en-us", "-s", "142", "-w", str(ROOT / "narration.wav"), narration],
        check=True,
    )

    scene = {
        "width": W, "height": H, "coordinate_width": W, "fps": 24,
        "audio": "narration.wav", "watermark": "",
        "objects": [
            {"type": "image", "path": "photosynthesis.png", "x": 0, "y": 0,
             "w": W, "h": H, "start": 0, "draw_duration": 0.85}
        ],
    }
    (ROOT / "scene.json").write_text(json.dumps(scene, indent=2), encoding="utf-8")

    regions = {
        "idea": "How a green plant makes glucose using sunlight",
        "regions": [
            {"label":"sunlight","role":"main_concept","object":"sun and light rays","reveal_order":1,
             "box":{"ymin":130,"xmin":45,"ymax":310,"xmax":245},
             "expected_visual":"Sun with rays and a light arrow","annotation":"Chlorophyll captures energy from sunlight","reveal":"fill"},
            {"label":"carbon dioxide","role":"input","object":"carbon dioxide entering leaf","reveal_order":2,
             "box":{"ymin":300,"xmin":20,"ymax":520,"xmax":430},
             "expected_visual":"CO2 label and arrow entering the leaf","annotation":"The plant takes in carbon dioxide from the air","reveal":"fill"},
            {"label":"plant","role":"main_concept","object":"green plant with leaves and roots","reveal_order":3,
             "box":{"ymin":190,"xmin":270,"ymax":900,"xmax":760},
             "expected_visual":"Plant stem, leaves and roots","annotation":"Green plants use light energy to make glucose","reveal":"fill"},
            {"label":"water","role":"input","object":"water entering through roots","reveal_order":4,
             "box":{"ymin":620,"xmin":70,"ymax":940,"xmax":490},
             "expected_visual":"Water label and arrow toward roots","annotation":"Water is absorbed through the roots","reveal":"fill"},
            {"label":"glucose and oxygen","role":"output","object":"glucose and oxygen leaving plant","reveal_order":5,
             "box":{"ymin":300,"xmin":680,"ymax":650,"xmax":990},
             "expected_visual":"Glucose and oxygen labels with arrows","annotation":"The plant produces glucose and releases oxygen","reveal":"fill"}
        ]
    }
    (ROOT / "regions.json").write_text(json.dumps(regions, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
