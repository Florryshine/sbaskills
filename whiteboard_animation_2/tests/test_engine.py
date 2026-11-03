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


@unittest.skipUnless(
    shutil.which("ffmpeg") and shutil.which("ffprobe"),
    "FFmpeg and ffprobe are required for render smoke test",
)
class RenderSmokeTest(unittest.TestCase):
    def test_renders_image_and_uses_real_audio_duration(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            illustration = Image.new("RGB", (100, 100), "white")
            ImageDraw.Draw(illustration).ellipse((15, 15, 85, 85), outline="black", width=5)
            illustration.save(folder / "diagram.png")

            audio_path = folder / "narration.wav"
            subprocess.run(
                [
                    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
                    "-t", "0.8", "-c:a", "pcm_s16le", str(audio_path),
                ],
                check=True,
            )

            plan = {
                "width": 360,
                "height": 640,
                "coordinate_width": 1080,
                "fps": 5,
                "duration": 99,
                "audio": "narration.wav",
                "watermark": "",
                "objects": [
                    {"type": "text", "text": "TEST", "x": 80, "y": 100,
                     "size": 70, "start": 0, "draw_duration": 0.5},
                    {"type": "circle", "x": 540, "y": 900, "radius": 100,
                     "start": 0.2, "draw_duration": 0.7},
                    {"type": "image", "path": "diagram.png", "x": 300, "y": 1100,
                     "w": 300, "h": 300, "start": 0.1, "draw_duration": 0.8},
                ],
            }
            plan_path = folder / "scene.json"
            output = folder / "smoke.mp4"
            plan_path.write_text(json.dumps(plan), encoding="utf-8")
            engine.render(plan_path, output)
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 1000)

            probe = subprocess.run(
                [
                    "ffprobe", "-v", "error", "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1", str(output),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertAlmostEqual(float(probe.stdout.strip()), 0.8, delta=0.15)


class TimelineUnitTest(unittest.TestCase):
    def test_scene_selection_uses_absolute_timeline_and_local_scene_time(self):
        scenes = engine.validate_timeline({"scenes": [
            {"start": 0, "end": 3, "objects": [{"type": "text", "text": "CELL", "start": 0, "draw_duration": 1}]},
            {"start": 3, "end": 7, "objects": [{"type": "text", "text": "NUCLEUS", "start": 0.5, "draw_duration": 1}]},
        ]}, 7)
        self.assertEqual(engine.scene_at(scenes, 1)["objects"][0]["text"], "CELL")
        self.assertEqual(engine.scene_at(scenes, 4)["objects"][0]["text"], "NUCLEUS")
        self.assertIsNone(engine.scene_at(scenes, 2.9) if False else engine.scene_at(scenes, 7))

    def test_rejects_overlapping_scenes(self):
        with self.assertRaisesRegex(ValueError, "must not overlap"):
            engine.validate_timeline({"scenes": [
                {"start": 0, "end": 4, "objects": []},
                {"start": 3, "end": 6, "objects": []},
            ]}, 8)

    def test_rejects_scene_after_audio(self):
        with self.assertRaisesRegex(ValueError, "after the narration"):
            engine.validate_timeline({"scenes": [
                {"start": 5, "end": 9, "objects": []},
            ]}, 8)


if __name__ == "__main__":
    unittest.main()
