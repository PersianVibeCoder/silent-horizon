"""Offline visual regression; render into a temporary directory, never the desktop."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from PIL import Image, ImageChops

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which('cjs'), 'Cinnamon JavaScript runtime required')
class RenderTests(unittest.TestCase):
    def test_cached_glow_matches_original(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run(
                ['cjs', str(ROOT / 'tests/performance-regression.js'), str(ROOT), directory],
                capture_output=True, text=True, timeout=60)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            expected = list(Path(directory).glob('expected-*.png'))
            self.assertEqual(len(expected), 24)
            for reference in expected:
                with Image.open(reference) as before, Image.open(reference.with_name(
                        reference.name.replace('expected-', 'actual-'))) as after:
                    difference = ImageChops.difference(before.convert('RGBA'), after.convert('RGBA'))
                    self.assertTrue(all(high == 0 for low, high in difference.getextrema()), reference.name)
