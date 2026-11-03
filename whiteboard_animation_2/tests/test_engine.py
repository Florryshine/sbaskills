import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import engine  # noqa: E402


@unittest.skipUnless(shutil.which("ffmpeg"), "FFmpeg is required for render smoke test")
class RenderSmokeTest(unittest.TestCase):
    def test_renders_a_short_portrait_mp4_with_image_asset(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            illustration = Image.new("RGB", (100, 100), "white")
            ImageDraw.Draw(illustration).ellipse((15, 15, 85, 85), outline="black", width=5)
            illustration.save(folder / "diagram.png")
            plan = {
                "width": 360,
                "height": 640,
                "coordinate_width": 1080,
                "fps": 5,
                "duration": 1.2,
                "watermark": "",
                "objects": [
                    {"type": "text", "text": "TEST", "x": 80, "y": 100,
                     "size": 70, "start": 0, "draw_duration": 0.5},
                    {"type": "circle", "x": 540, "y": 900, "radius": 100,
                     "start": 0.2, "draw_duration": 0.7},
                    {"type": "image", "path": "diagram.png", "x": 300, "y": 1100,
                     "w": 300, "h": 300, "start": 0.1, "draw_duration": 0.8}
                ]
            }
            plan_path = folder / "scene.json"
            output = folder / "smoke.mp4"
            plan_path.write_text(json.dumps(plan), encoding="utf-8")
            engine.render(plan_path, output)
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 1000)
            probe = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(output)],
                check=True, capture_output=True, text=True
            )
            self.assertGreater(float(probe.stdout.strip()), 0.5)


if __name__ == "__main__":
    unittest.main()
