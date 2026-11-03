import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "generate_comparison_assets.py"
ADAPTER = ROOT / "animator_adapter.py"
ENGINE = ROOT / "engine.py"


def duration(path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path),
        ],
        check=True, capture_output=True, text=True,
    )
    return float(result.stdout.strip())


@unittest.skipUnless(
    shutil.which("whiteboard-animate") and shutil.which("ffmpeg")
    and shutil.which("ffprobe") and shutil.which("espeak"),
    "Install optional whiteboard-animator, FFmpeg and espeak for the full comparison",
)
class PhotosynthesisComparisonTest(unittest.TestCase):
    def test_both_renderers_use_same_board_and_narration(self):
        subprocess.run([sys.executable, str(GENERATOR)], check=True, cwd=ROOT)
        assets = ROOT / "comparison"
        manifest = assets / "engine-b-manifest.json"
        plan = assets / "engine-a-scene.json"
        board = assets / "photosynthesis-board.png"
        audio = assets / "photosynthesis-narration.wav"
        self.assertTrue(board.is_file())
        self.assertTrue(audio.is_file())
        expected_duration = duration(audio)

        engine_a = assets / "engine-a.mp4"
        engine_b = assets / "engine-b.mp4"

        subprocess.run(
                [sys.executable, str(ENGINE), str(plan), "-o", str(engine_a)],
            check=True,
            cwd=ROOT,
        )
        subprocess.run(
                [
                    sys.executable, str(ADAPTER), str(manifest),
                    "-o", str(engine_b), "--quality", "low",
                ],
            check=True,
            cwd=ROOT,
        )
        for output in (engine_a, engine_b):
            self.assertTrue(output.is_file())
            self.assertGreater(output.stat().st_size, 10_000)
            self.assertAlmostEqual(duration(output), expected_duration, delta=0.3)
            preview = output.with_name(output.stem + "-preview.jpg")
            subprocess.run(
                ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", "4",
                 "-i", str(output), "-frames:v", "1", str(preview)],
                check=True,
            )
            self.assertTrue(preview.is_file())


if __name__ == "__main__":
    unittest.main()
