#!/usr/bin/env python3
"""Create the shared photosynthesis board, narration WAV, and renderer plans."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
W, H, S = 720, 1280, 2
INK = (28, 38, 39)
GREEN = (38, 126, 78)
BLUE = (42, 111, 168)
YELLOW = (220, 160, 42)
PURPLE = (130, 92, 154)

NARRATION = (
    "Photosynthesis is the process by which green plants make their own food. "
    "First, chlorophyll in the leaf absorbs energy from sunlight. "
    "The roots absorb water from the soil, and carbon dioxide enters the leaf through tiny openings. "
    "Using light energy, the plant converts water and carbon dioxide into glucose. "
    "Oxygen is released into the air as a by-product. "
    "The glucose stores chemical energy that the plant can use for growth."
)


def font(size: int, bold: bool = False):
    candidates = (
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]
        if bold else
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"]
    )
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size * S)
    return ImageFont.load_default()


def main() -> None:
    if shutil.which("espeak") is None:
        raise SystemExit("espeak is required for this demo. Install it or supply narration.wav manually.")
    out = HERE / "comparison"
    out.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (W*S, H*S), "white")
    d = ImageDraw.Draw(image)

    def xy(v): return int(v*S)
    def line(points, fill=INK, width=5):
        d.line([(xy(x), xy(y)) for x, y in points], fill=fill, width=xy(width), joint="curve")
    def ellipse(box, outline=INK, width=5, fill=None):
        d.ellipse(tuple(xy(v) for v in box), outline=outline, width=xy(width), fill=fill)
    def text(value, x, y, size, color=INK, bold=False, anchor=None):
        d.text((xy(x), xy(y)), value, font=font(size, bold), fill=color, anchor=anchor)
    def arrow(points, color=INK, width=5):
        line(points, color, width)
        (x1,y1),(x2,y2)=points[-2],points[-1]
        import math
        a=math.atan2(y2-y1,x2-x1)
        length=17
        left=(x2-length*math.cos(a-.55),y2-length*math.sin(a-.55))
        right=(x2-length*math.cos(a+.55),y2-length*math.sin(a+.55))
        d.polygon([(xy(x2),xy(y2)),(xy(left[0]),xy(left[1])),(xy(right[0]),xy(right[1]))],fill=color)

    # Title and subtitle
    text("PHOTOSYNTHESIS", 360, 45, 34, INK, True, "mt")
    line([(70,105),(650,105)], INK, 3)
    text("HOW GREEN PLANTS MAKE FOOD", 360, 122, 15, GREEN, True, "mt")

    # Sun + rays
    ellipse((75,205,205,335), YELLOW, 7, (255,249,225))
    for a,b in [
        ((140,185),(140,160)),((140,355),(140,380)),((55,270),(30,270)),
        ((225,270),(250,270)),((80,210),(60,190)),((200,330),(220,350)),
        ((200,210),(220,190)),((80,330),(60,350))
    ]: line([a,b],YELLOW,7)
    text("SUNLIGHT",140,395,17,YELLOW,True,"mt")
    arrow([(220,285),(325,365)],YELLOW,6)

    # Main plant: stem, leaves, roots
    line([(365,520),(365,900)],GREEN,11)
    # left and right leaf outline with vein
    line([(365,650),(305,575),(245,545),(205,565),(215,620),(280,665),(365,690)],GREEN,8)
    line([(365,650),(305,575),(245,545)],GREEN,5)
    line([(365,710),(425,625),(485,590),(530,610),(520,660),(455,710),(365,745)],GREEN,8)
    line([(365,710),(425,625),(485,590)],GREEN,5)
    # small chloroplast circles
    for x,y in [(270,600),(295,620),(450,650),(480,635)]:
        ellipse((x-8,y-5,x+8,y+5),GREEN,3,(220,244,225))
    # roots
    for pts in [
        [(365,900),(330,955),(300,1010)],
        [(365,900),(400,960),(430,1020)],
        [(365,930),(360,990),(355,1050)],
        [(350,930),(315,970),(275,985)],
        [(380,930),(420,975),(465,990)]
    ]: line(pts,GREEN,6)
    text("LEAF",365,770,20,GREEN,True,"mt")
    text("ROOTS",365,1065,17,GREEN,True,"mt")

    # Water entering roots
    for x,y in [(90,860),(125,925),(160,990)]:
        ellipse((x-15,y-18,x+15,y+18),BLUE,4,(225,241,252))
        text("H₂O",x,y,9,BLUE,True,"mm")
    arrow([(180,930),(270,950),(315,975)],BLUE,6)
    text("WATER",125,1035,15,BLUE,True,"mt")
    text("from soil",125,1058,12,BLUE,False,"mt")

    # Carbon dioxide enters leaf
    for x,y in [(575,470),(625,525),(590,580)]:
        ellipse((x-24,y-24,x+24,y+24),PURPLE,4,(246,238,250))
        text("CO₂",x,y,11,PURPLE,True,"mm")
    arrow([(555,600),(505,640),(470,660)],PURPLE,6)
    text("CARBON DIOXIDE",565,665,13,PURPLE,True,"mt")
    text("from air",565,685,12,PURPLE,False,"mt")

    # Outputs
    arrow([(365,1110),(365,1150)],GREEN,6)
    ellipse((240,1150,490,1220),GREEN,5,(237,249,239))
    text("GLUCOSE + OXYGEN",365,1185,17,GREEN,True,"mm")
    text("Food for the plant",365,1235,13,INK,False,"mt")

    # Tiny chlorophyll note
    ellipse((500,215,660,295),GREEN,4,(239,248,239))
    text("CHLOROPHYLL",580,246,13,GREEN,True,"mm")
    text("in leaf cells",580,267,11,INK,False,"mm")

    image = image.resize((W,H), Image.Resampling.LANCZOS)
    board = out / "photosynthesis-board.png"
    image.save(board, optimize=True)
    comparison_board = out / "photosynthesis-board-360.png"
    image.resize((360, 640), Image.Resampling.LANCZOS).save(comparison_board, optimize=True)

    audio = out / "photosynthesis-narration.wav"
    subprocess.run(
        ["espeak", "-v", "en-gb", "-s", "145", "-w", str(audio), NARRATION],
        check=True,
    )
    audio_probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio)],
        check=True, capture_output=True, text=True,
    )
    audio_duration = float(audio_probe.stdout.strip())

    # Region boxes use normalized 0..1000 coordinates as required by the package.
    regions = {
        "idea": "Photosynthesis: how green plants make food",
        "regions": [
            {"label":"sunlight","role":"main_concept","object":"sun and sunlight rays","reveal_order":1,
             "box":{"ymin":115,"xmin":35,"ymax":330,"xmax":350},
             "expected_visual":"Sun with rays and a sunlight arrow","annotation":"Chlorophyll in the leaf absorbs energy from sunlight.","reveal":"fill"},
            {"label":"plant","role":"main_concept","object":"green plant with leaves and roots","reveal_order":2,
             "box":{"ymin":330,"xmin":250,"ymax":850,"xmax":760},
             "expected_visual":"Stem, leaves, roots and chlorophyll","annotation":"Photosynthesis is how green plants make their own food.","reveal":"fill"},
            {"label":"water","role":"supporting_detail","object":"water droplets entering roots","reveal_order":3,
             "box":{"ymin":650,"xmin":60,"ymax":850,"xmax":430},
             "expected_visual":"Water droplets and arrow into roots","annotation":"The roots absorb water from the soil.","reveal":"fill"},
            {"label":"carbon dioxide","role":"supporting_detail","object":"carbon dioxide bubbles entering the leaf","reveal_order":4,
             "box":{"ymin":350,"xmin":650,"ymax":560,"xmax":970},
             "expected_visual":"CO2 bubbles and arrow into leaf","annotation":"Carbon dioxide enters the leaf through tiny openings.","reveal":"fill"},
            {"label":"products","role":"main_concept","object":"glucose and oxygen output label","reveal_order":5,
             "box":{"ymin":870,"xmin":300,"ymax":990,"xmax":700},
             "expected_visual":"Glucose and oxygen produced by photosynthesis","annotation":"The plant converts water and carbon dioxide into glucose and releases oxygen.","reveal":"fill"}
        ]
    }
    (out / "photosynthesis-regions.json").write_text(json.dumps(regions, indent=2), encoding="utf-8")

    # The lightweight engine uses the exact same completed board image and audio.
    plan = {
        "width": 360, "height": 640, "coordinate_width": 360, "fps": 10,
        "audio": "photosynthesis-narration.wav", "watermark": "",
        "supersample": 1,
        "objects": [{
            "type":"image","path":"photosynthesis-board-360.png","x":0,"y":0,"w":360,"h":640,
            "start":0.0,"draw_duration":audio_duration * 0.75
        }]
    }
    (out / "engine-a-scene.json").write_text(json.dumps(plan, indent=2), encoding="utf-8")
    manifest = {"scenes":[{
        "image":"photosynthesis-board-360.png",
        "audio":"photosynthesis-narration.wav",
        "regions":"photosynthesis-regions.json"
    }]}
    (out / "engine-b-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Created comparison assets in {out}")


if __name__ == "__main__":
    main()
