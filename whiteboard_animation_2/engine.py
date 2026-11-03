#!/usr/bin/env python3
"""Whiteboard Animation 2 — deterministic Python + FFmpeg renderer.

The AI writes a scene JSON plan. This program renders that plan; it never
executes generated Python. Times in the plan are seconds from audio start.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

BG = (250, 249, 244)
INK = (25, 34, 39)
MUTED = (100, 110, 112)
ACCENT = (36, 116, 166)


def font_path(bold: bool = False) -> str:
    candidates = (
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
         "C:/Windows/Fonts/arialbd.ttf"]
        if bold else
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
         "C:/Windows/Fonts/arial.ttf"]
    )
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    return ""


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = font_path(bold)
    try:
        return ImageFont.truetype(path, size) if path else ImageFont.load_default()
    except OSError:
        return ImageFont.load_default()


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def progress_at(obj: dict[str, Any], t: float) -> float:
    start = float(obj.get("start", 0))
    duration = max(0.01, float(obj.get("draw_duration", 0.8)))
    return clamp((t - start) / duration)


def partial_points(points: list[list[float]], amount: float) -> list[tuple[float, float]]:
    if len(points) < 2:
        return [(float(p[0]), float(p[1])) for p in points]
    lengths = [
        math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1])
        for i in range(len(points) - 1)
    ]
    total = sum(lengths)
    if total <= 0:
        return [(float(points[0][0]), float(points[0][1]))]
    remaining = total * amount
    result = [(float(points[0][0]), float(points[0][1]))]
    for i, length in enumerate(lengths):
        a, b = points[i], points[i + 1]
        if remaining >= length:
            result.append((float(b[0]), float(b[1])))
            remaining -= length
        else:
            ratio = remaining / length if length else 0
            result.append((a[0] + (b[0] - a[0]) * ratio,
                           a[1] + (b[1] - a[1]) * ratio))
            break
    return result


def draw_revealed_text(draw: ImageDraw.ImageDraw, obj: dict[str, Any], p: float,
                       scale: float) -> None:
    text = str(obj.get("text", ""))
    x, y = float(obj.get("x", 80)) * scale, float(obj.get("y", 100)) * scale
    size = max(12, int(float(obj.get("size", 42)) * scale))
    font = load_font(size, bool(obj.get("bold", False)))
    fill = tuple(obj.get("color", INK))
    # Reveal glyphs progressively from left to right. This is a legible
    # handwriting-style reveal; actual pen-stroke fonts can be plugged in later.
    bbox = draw.textbbox((x, y), text, font=font)
    width = max(1, bbox[2] - bbox[0])
    reveal = int(width * p)
    if reveal <= 0:
        return
    mask = Image.new("L", (width + 4, max(1, bbox[3] - bbox[1] + 4)), 0)
    md = ImageDraw.Draw(mask)
    md.text((2 - bbox[0] + x, 2 - bbox[1] + y), text, font=font, fill=255)
    crop = mask.crop((0, 0, reveal, mask.height))
    layer = Image.new("RGBA", crop.size, fill + (255,))
    layer.putalpha(crop)
    canvas = draw._image
    canvas.paste(layer, (int(x), int(y)), layer)


def draw_object(image: Image.Image, obj: dict[str, Any], t: float,
                scale: float) -> None:
    start = float(obj.get("start", 0))
    if t < start:
        return
    p = progress_at(obj, t)
    kind = obj.get("type", "line")
    width = max(1, int(float(obj.get("width", 5)) * scale))
    color = tuple(obj.get("color", INK))
    draw = ImageDraw.Draw(image)

    if kind == "text":
        draw_revealed_text(draw, obj, p, scale)
        return

    if kind in ("line", "polyline", "arrow"):
        if kind == "line":
            pts = [[obj["x1"], obj["y1"]], [obj["x2"], obj["y2"]]]
        else:
            pts = obj.get("points", [])
        pts = [[float(x) * scale, float(y) * scale] for x, y in pts]
        shown = partial_points(pts, p)
        if len(shown) >= 2:
            draw.line(shown, fill=color, width=width, joint="curve")
        if kind == "arrow" and p >= 1 and len(pts) >= 2:
            x1, y1 = pts[-2]
            x2, y2 = pts[-1]
            angle = math.atan2(y2 - y1, x2 - x1)
            head = 16 * scale
            left = (x2 - head * math.cos(angle - 0.48),
                    y2 - head * math.sin(angle - 0.48))
            right = (x2 - head * math.cos(angle + 0.48),
                     y2 - head * math.sin(angle + 0.48))
            draw.polygon([(x2, y2), left, right], fill=color)
        return

    if kind == "circle":
        x, y, radius = [float(obj[k]) * scale for k in ("x", "y", "radius")]
        box = (x - radius, y - radius, x + radius, y + radius)
        draw.arc(box, -90, -90 + 360 * p, fill=color, width=width)
        return

    if kind == "rect":
        x, y = float(obj["x"]) * scale, float(obj["y"]) * scale
        w, h = float(obj["w"]) * scale, float(obj["h"]) * scale
        # Four sides are revealed in drawing order, not as an instant shape.
        perimeter = 2 * (w + h)
        remaining = perimeter * p
        corners = [(x, y), (x + w, y), (x + w, y + h),
                    (x, y + h), (x, y)]
        for a, b in zip(corners, corners[1:]):
            length = math.hypot(b[0] - a[0], b[1] - a[1])
            if remaining <= 0:
                break
            ratio = min(1, remaining / max(length, 0.001))
            end = (a[0] + (b[0] - a[0]) * ratio,
                   a[1] + (b[1] - a[1]) * ratio)
            draw.line([a, end], fill=color, width=width)
            remaining -= length
        return

    raise ValueError(f"Unsupported object type: {kind}")


def render(plan_path: Path, output_path: Path) -> None:
    plan = json.loads(plan_path.read_text(encoding="utf-8"))
    base = plan_path.parent
    width = int(plan.get("width", 1080))
    height = int(plan.get("height", 1920))
    fps = int(plan.get("fps", 30))
    duration = float(plan["duration"])
    audio_value = plan.get("audio")
    audio_path = (base / audio_value).resolve() if audio_value else None
    if audio_path and not audio_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    if width < 320 or height < 320 or fps < 1 or duration <= 0:
        raise ValueError("Invalid width, height, fps, or duration in scene plan.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    scale = width / float(plan.get("coordinate_width", 1080))
    objects = plan.get("objects", [])
    frame_count = math.ceil(duration * fps)

    with tempfile.TemporaryDirectory(prefix="sba-whiteboard-") as tmp:
        frame_dir = Path(tmp)
        for frame_no in range(frame_count):
            t = frame_no / fps
            image = Image.new("RGB", (width, height), tuple(plan.get("background", BG)))
            draw = ImageDraw.Draw(image)
            # Small academy signature, intentionally unobtrusive.
            title = plan.get("watermark", "SHINEY BRAIN")
            if title:
                draw.text((int(48 * scale), int(42 * scale)), title,
                          font=load_font(max(12, int(20 * scale)), True), fill=MUTED)
            for obj in objects:
                draw_object(image, obj, t, scale)
            image.save(frame_dir / f"frame_{frame_no:06d}.png", optimize=False)

        command = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(fps), "-i", str(frame_dir / "frame_%06d.png"),
        ]
        if audio_path:
            command += ["-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:a", "aac", "-b:a", "192k", "-shortest"]
        else:
            command += ["-an", "-t", str(duration)]
        command += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                    str(output_path.resolve())]
        subprocess.run(command, check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render an SBA whiteboard scene JSON to MP4.")
    parser.add_argument("plan", type=Path, help="Path to a scene JSON file")
    parser.add_argument("-o", "--output", type=Path, default=Path("whiteboard-output.mp4"))
    args = parser.parse_args()
    if shutil.which("ffmpeg") is None:
        raise SystemExit("FFmpeg was not found. Install FFmpeg and add it to PATH.")
    render(args.plan.resolve(), args.output.resolve())
    print(f"Rendered: {args.output.resolve()}")


if __name__ == "__main__":
    main()
