#!/usr/bin/env python3
"""Optional adapter for the MIT whiteboard-animator renderer.

This is kept separate from engine.py so the base prototype stays lightweight.
The package is installed only when explicitly requested.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a sequence of finished line-art scenes with whiteboard-animator."
    )
    parser.add_argument("manifest", type=Path, help="JSON manifest containing scenes and audio")
    parser.add_argument("-o", "--output", type=Path, default=Path("whiteboard-animator-output.mp4"))
    parser.add_argument("--quality", choices=("low", "medium", "high"), default="high")
    args = parser.parse_args()

    if shutil.which("whiteboard-animate") is None:
        raise SystemExit(
            "whiteboard-animate is missing. Install the optional dependency with: "
            "python -m pip install -r requirements-whiteboard-animator.txt"
        )

    manifest_path = args.manifest.resolve()
    base = manifest_path.parent
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    scenes = manifest.get("scenes")
    if not isinstance(scenes, list) or not scenes:
        raise SystemExit("Manifest must contain a non-empty 'scenes' array.")

    images: list[str] = []
    audios: list[str] = []
    for index, scene in enumerate(scenes):
        image_value = scene.get("image")
        audio_value = scene.get("audio")
        if not image_value or not audio_value:
            raise SystemExit(f"Scene {index} must include both image and audio.")
        image_path = (base / image_value).resolve()
        audio_path = (base / audio_value).resolve()
        if not image_path.is_relative_to(base) or not audio_path.is_relative_to(base):
            raise SystemExit(f"Scene {index} asset path must stay inside the manifest folder.")
        if not image_path.is_file():
            raise SystemExit(f"Scene {index} image not found: {image_path}")
        if not audio_path.is_file():
            raise SystemExit(f"Scene {index} audio not found: {audio_path}")
        images.append(str(image_path))
        audios.append(str(audio_path))

    args.output.parent.mkdir(parents=True, exist_ok=True)
    command = [
        "whiteboard-animate",
        *images,
        "--audio",
        *audios,
        "--quality",
        args.quality,
        "-o",
        str(args.output.resolve()),
    ]
    subprocess.run(command, check=True)
    print(f"Rendered: {args.output.resolve()}")


if __name__ == "__main__":
    main()
