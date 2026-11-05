#!/usr/bin/env python3
"""Whiteboard Animation 2 — deterministic Python + FFmpeg renderer."""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps

BG = (250, 249, 244)
INK = (25, 34, 39)
MUTED = (100, 110, 112)
SUPPORTED = {"text", "line", "polyline", "arrow", "circle", "rect", "image"}


def font_path(bold: bool = False) -> str:
    candidates = (
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]
        if bold else
        ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"]
    )
    return next((p for p in candidates if Path(p).exists()), "")


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    path = font_path(bold)
    try:
        return ImageFont.truetype(path, max(1, int(size))) if path else ImageFont.load_default()
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
    remaining = sum(lengths) * amount
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


def draw_revealed_text(image: Image.Image, obj: dict[str, Any], p: float,
                       scale: float) -> None:
    """Reveal text through a temporary mask; compatible with current Pillow."""
    text = str(obj.get("text", ""))
    if not text or p <= 0:
        return
    x = int(round(float(obj.get("x", 80)) * scale))
    y = int(round(float(obj.get("y", 100)) * scale))
    size = max(12, int(round(float(obj.get("size", 42)) * scale)))
    font = load_font(size, bool(obj.get("bold", False)))
    fill = tuple(obj.get("color", INK))
    scratch = ImageDraw.Draw(Image.new("L", (1, 1)))
    bbox = scratch.textbbox((0, 0), text, font=font)
    text_width = max(1, int(math.ceil(bbox[2] - bbox[0])))
    text_height = max(1, int(math.ceil(bbox[3] - bbox[1])))
    reveal_width = max(1, min(text_width, int(math.ceil(text_width * p))))
    mask = Image.new("L", (text_width, text_height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.text((-int(bbox[0]), -int(bbox[1])), text, font=font, fill=255)
    mask = mask.crop((0, 0, reveal_width, text_height))
    color_layer = Image.new("RGB", mask.size, fill)
    image.paste(color_layer, (x, y), mask)


def load_ink_image(path: Path, color: tuple[int, int, int]) -> Image.Image:
    """Convert a clean diagram into transparent ink for whiteboard reveal."""
    source = Image.open(path).convert("RGBA")
    white = Image.new("RGB", source.size, "white")
    white.paste(source, mask=source.getchannel("A"))
    gray = ImageOps.grayscale(white)
    alpha = ImageOps.invert(gray)
    ink = Image.new("RGBA", source.size, color + (0,))
    ink.putalpha(alpha)
    return ink


def draw_image_object(image: Image.Image, obj: dict[str, Any], p: float,
                      scale: float, assets: dict[str, Image.Image]) -> None:
    source = assets[str(obj["path"])]
    x = int(float(obj.get("x", 0)) * scale)
    y = int(float(obj.get("y", 0)) * scale)
    w = max(1, int(float(obj.get("w", source.width)) * scale))
    h = max(1, int(float(obj.get("h", source.height)) * scale))
    fitted = ImageOps.contain(source, (w, h), method=Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    layer.alpha_composite(fitted, ((w-fitted.width)//2, (h-fitted.height)//2))
    reveal = max(0, min(w, int(math.ceil(w * p))))
    if reveal == 0:
        return
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rectangle((0, 0, reveal-1, h), fill=255)
    alpha = ImageChops.multiply(layer.getchannel("A"), mask)
    image.paste(layer.convert("RGB"), (x, y), alpha)


def draw_object(image: Image.Image, obj: dict[str, Any], t: float, scale: float,
                assets: dict[str, Image.Image]) -> None:
    start = float(obj.get("start", 0))
    if t < start:
        return
    p = progress_at(obj, t)
    kind = obj.get("type", "line")
    width = max(1, int(round(float(obj.get("width", 5)) * scale)))
    color = tuple(obj.get("color", INK))
    draw = ImageDraw.Draw(image)

    if kind == "image":
        draw_image_object(image, obj, p, scale, assets)
        return

    if kind == "text":
        draw_revealed_text(image, obj, p, scale)
        return

    if kind in ("line", "polyline", "arrow"):
        raw = [[obj["x1"], obj["y1"]], [obj["x2"], obj["y2"]]] if kind == "line" else obj.get("points", [])
        pts = [[float(x) * scale, float(y) * scale] for x, y in raw]
        shown = partial_points(pts, p)
        if len(shown) >= 2:
            draw.line(shown, fill=color, width=width, joint="curve")
        if kind == "arrow" and p >= 1 and len(pts) >= 2:
            x1, y1 = pts[-2]
            x2, y2 = pts[-1]
            angle = math.atan2(y2 - y1, x2 - x1)
            head = 22 * scale
            left = (x2 - head * math.cos(angle - 0.48), y2 - head * math.sin(angle - 0.48))
            right = (x2 - head * math.cos(angle + 0.48), y2 - head * math.sin(angle + 0.48))
            draw.polygon([(x2, y2), left, right], fill=color)
        return

    if kind == "circle":
        x, y, radius = [float(obj[k]) * scale for k in ("x", "y", "radius")]
        draw.arc((x-radius, y-radius, x+radius, y+radius),
                 -90, -90 + 360 * p, fill=color, width=width)
        return

    if kind == "rect":
        x, y = float(obj["x"]) * scale, float(obj["y"]) * scale
        w, h = float(obj["w"]) * scale, float(obj["h"]) * scale
        remaining = 2 * (w + h) * p
        corners = [(x, y), (x+w, y), (x+w, y+h), (x, y+h), (x, y)]
        for a, b in zip(corners, corners[1:]):
            length = math.hypot(b[0]-a[0], b[1]-a[1])
            if remaining <= 0:
                break
            ratio = min(1.0, remaining / max(length, 0.001))
            end = (a[0] + (b[0]-a[0])*ratio, a[1] + (b[1]-a[1])*ratio)
            draw.line([a, end], fill=color, width=width)
            remaining -= length
        return

    raise ValueError(f"Unsupported object type: {kind}")


def probe_audio_duration(audio_path: Path) -> float:
    if shutil.which("ffprobe") is None:
        raise RuntimeError("ffprobe is required to read the narration duration.")
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)],
        check=True, capture_output=True, text=True
    )
    try:
        duration = float(result.stdout.strip())
    except ValueError as exc:
        raise ValueError(f"Could not read audio duration for {audio_path}") from exc
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError(f"Audio duration is invalid for {audio_path}")
    return duration


def validate_plan(plan: Any) -> dict[str, Any]:
    if not isinstance(plan, dict):
        raise ValueError("Scene plan must be a JSON object.")
    if not isinstance(plan.get("objects", []), list):
        raise ValueError("'objects' must be an array.")
    for index, obj in enumerate(plan.get("objects", [])):
        if not isinstance(obj, dict) or obj.get("type") not in SUPPORTED:
            raise ValueError(f"Object {index} has an unsupported or missing type.")
        if float(obj.get("start", 0)) < 0 or float(obj.get("draw_duration", 0.8)) <= 0:
            raise ValueError(f"Object {index} has invalid timing.")
        if obj["type"] == "image" and not obj.get("path"):
            raise ValueError(f"Image object {index} is missing path.")
        if obj["type"] == "text" and "text" not in obj:
            raise ValueError(f"Text object {index} is missing 'text'.")
        if obj["type"] in ("polyline", "arrow") and len(obj.get("points", [])) < 2:
            raise ValueError(f"Object {index} needs at least two points.")
    return plan


def validate_timeline(plan: dict[str, Any], duration: float) -> list[dict[str, Any]]:
    """Validate absolute-time scenes; object times are relative to each scene start."""
    scenes = plan.get("scenes")
    if scenes is None:
        return []
    if not isinstance(scenes, list) or not scenes:
        raise ValueError("'scenes' must be a non-empty array when supplied.")
    validated: list[dict[str, Any]] = []
    previous_end = 0.0
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            raise ValueError(f"Scene {index} must be an object.")
        try:
            start, end = float(scene["start"]), float(scene["end"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"Scene {index} requires numeric start and end values.") from exc
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
            raise ValueError(f"Scene {index} has an invalid time range.")
        if start < previous_end:
            raise ValueError("Scenes must be ordered and must not overlap.")
        if end > duration + 0.001:
            raise ValueError(f"Scene {index} ends after the narration.")
        objects = scene.get("objects")
        if not isinstance(objects, list):
            raise ValueError(f"Scene {index} requires an objects array.")
        validate_plan({"objects": objects})
        validated.append({**scene, "start": start, "end": end})
        previous_end = end
    return validated


def scene_at(scenes: list[dict[str, Any]], t: float) -> dict[str, Any] | None:
    """Return the active scene at narration time t, or None during a gap."""
    for scene in scenes:
        if scene["start"] <= t < scene["end"]:
            return scene
    return None


def render(plan_path: Path, output_path: Path) -> None:
    plan = validate_plan(json.loads(plan_path.read_text(encoding="utf-8")))
    base = plan_path.parent
    width, height = int(plan.get("width", 1080)), int(plan.get("height", 1920))
    fps = int(plan.get("fps", 30))
    audio_value = plan.get("audio")
    audio_path = (base / audio_value).resolve() if audio_value else None
    if audio_path and not audio_path.is_file():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    duration = probe_audio_duration(audio_path) if audio_path else float(plan.get("duration", 0))
    if width < 320 or height < 320 or fps < 1 or duration <= 0:
        raise ValueError("Invalid width, height, fps, or duration in scene plan.")
    coordinate_width = float(plan.get("coordinate_width", 1080))
    if coordinate_width <= 0:
        raise ValueError("'coordinate_width' must be greater than zero.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    supersample = max(1, int(plan.get("supersample", 2)))
    scale = (width * supersample) / coordinate_width
    objects = plan.get("objects", [])
    assets: dict[str, Image.Image] = {}
    scenes = validate_timeline(plan, duration)
    render_objects = [obj for scene in scenes for obj in scene["objects"]] if scenes else objects
    for obj in render_objects:
        if obj.get("type") == "image":
            key = str(obj["path"])
            asset_path = (base / key).resolve()
            if not asset_path.is_relative_to(base.resolve()):
                raise ValueError(f"Image path escapes the scene folder: {key}")
            if not asset_path.is_file():
                raise FileNotFoundError(f"Illustration file not found: {asset_path}")
            assets[key] = load_ink_image(asset_path, tuple(obj.get("color", INK)))
    frame_count = math.ceil(duration * fps)

    with tempfile.TemporaryDirectory(prefix="sba-whiteboard-") as tmp:
        frame_dir = Path(tmp)
        for frame_no in range(frame_count):
            t = frame_no / fps
            active_scene = scene_at(scenes, t) if scenes else None
            scene_objects = active_scene["objects"] if active_scene else objects
            scene_time = t - active_scene["start"] if active_scene else t
            background = active_scene.get("background", plan.get("background", BG)) if active_scene else plan.get("background", BG)
            image = Image.new("RGB", (width*supersample, height*supersample), tuple(background))
            title = active_scene.get("watermark", plan.get("watermark", "SHINEY BRAIN")) if active_scene else plan.get("watermark", "SHINEY BRAIN")
            if title:
                ImageDraw.Draw(image).text(
                    (int(48*scale), int(42*scale)), title,
                    font=load_font(max(12, int(20*scale)), True), fill=MUTED
                )
            for obj in scene_objects:
                draw_object(image, obj, scene_time, scale, assets)
            if supersample > 1:
                image = image.resize((width, height), Image.Resampling.LANCZOS)
            image.save(frame_dir / f"frame_{frame_no:06d}.png", optimize=False)

        command = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-framerate", str(fps), "-i", str(frame_dir / "frame_%06d.png"),
        ]
        if audio_path:
            command += ["-i", str(audio_path), "-map", "0:v:0", "-map", "1:a:0",
                        "-c:a", "aac", "-b:a", "192k", "-t", f"{duration:.6f}"]
        else:
            command += ["-an", "-t", f"{duration:.6f}"]
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
