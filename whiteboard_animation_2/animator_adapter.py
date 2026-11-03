#!/usr/bin/env python3
"""Render manifest scenes with the optional MIT whiteboard-animator package."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from whiteboard_animator import Scene, SnippetRegionPlan, render_video


def inside(base: Path, value: str, label: str, index: int) -> Path:
    path = (base / value).resolve()
    if not path.is_relative_to(base.resolve()):
        raise SystemExit(f"Scene {index}: {label} must stay inside the manifest folder.")
    if not path.is_file():
        raise SystemExit(f"Scene {index}: {label} not found: {path}")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render line-art scenes using whiteboard-animator."
    )
    parser.add_argument("manifest", type=Path, help="JSON manifest containing scenes and audio")
    parser.add_argument("-o", "--output", type=Path, default=Path("whiteboard-animator-output.mp4"))
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    args = parser.parse_args()

    manifest_path = args.manifest.resolve()
    base = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    scenes_data = manifest.get("scenes")
    if not isinstance(scenes_data, list) or not scenes_data:
        raise SystemExit("Manifest must contain a non-empty 'scenes' array.")

    scenes = []
    for index, data in enumerate(scenes_data):
        if not isinstance(data, dict) or not data.get("image") or not data.get("audio"):
            raise SystemExit(f"Scene {index} must include image and audio paths.")
        image_path = inside(base, data["image"], "image", index)
        audio_path = inside(base, data["audio"], "audio", index)
        region_plan = None
        if data.get("regions"):
            region_path = inside(base, data["regions"], "region plan", index)
            region_plan = SnippetRegionPlan.model_validate_json(
                region_path.read_text(encoding="utf-8")
            )
        scenes.append(Scene(str(image_path), audio=str(audio_path), region_plan=region_plan))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    render_video(scenes, str(args.output.resolve()), quality=args.quality)
    print(f"Rendered: {args.output.resolve()}")


if __name__ == "__main__":
    main()
