import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "animator_adapter.py"


@unittest.skipUnless(
    shutil.which("whiteboard-animate") and shutil.which("ffmpeg"),
    "Install whiteboard-animator and FFmpeg to run this integration test",
)
class AnimatorAdapterIntegrationTest(unittest.TestCase):
    def test_line_art_scene_renders_to_mp4(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            image = Image.new("RGB", (720, 720), "white")
            draw = ImageDraw.Draw(image)
            draw.ellipse((270, 70, 450, 250), outline="black", width=9)
            for x1, y1, x2, y2 in [
                (360, 25, 360, 5), (250, 160, 220, 160),
                (470, 160, 500, 160), (360, 260, 360, 580),
                (360, 390, 220, 300), (360, 390, 500, 300),
                (360, 580, 250, 650), (360, 580, 470, 650),
            ]:
                draw.line((x1, y1, x2, y2), fill="black", width=9)
            image.save(folder / "photosynthesis-sketch.png")

            audio = folder / "narration.wav"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", "2.5", "-c:a", "pcm_s16le", str(audio),
                ],
                check=True,
            )
            manifest = {
                "scenes": [
                    {"image": "photosynthesis-sketch.png", "audio": "narration.wav"}
                ]
            }
            manifest_path = folder / "manifest.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            output = folder / "traced-test.mp4"

            subprocess.run(
                [
                    sys.executable, str(ADAPTER), str(manifest_path),
                    "-o", str(output), "--quality", "low",
                ],
                check=True,
                cwd=ROOT,
            )
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 1000)


if __name__ == "__main__":
    unittest.main()
