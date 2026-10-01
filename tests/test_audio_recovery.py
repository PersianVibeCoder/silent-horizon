"""Exercise the actual helper against a failing, fake PulseAudio command."""
import os
import re
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[1]


class AudioRecoveryTests(unittest.TestCase):
    def test_dead_subscription_backs_off_and_parent_eof_exits(self):
        # Recovery logic must stay identical; each visualiser retains its own bands/FPS.
        desklet = ROOT / 'desklets/silent-horizon@alborz/audio-spectrum.py'
        applet = ROOT / 'applets/quiet-line@alborz/audio-spectrum.py'
        normalize = lambda text: re.sub(r'(?m)^(BANDS|FPS) = \d+$', r'\1 = <variant>', text)
        self.assertEqual(normalize(desklet.read_text()), normalize(applet.read_text()))
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            command = base / 'pactl'
            command.write_text(
                '#!' + sys.executable + '\n'
                'import os,sys\n'
                'with open(os.environ["AUDIO_TEST_LOG"], "a") as log: log.write(" ".join(sys.argv[1:])+"\\n")\n'
                'sys.exit(1)\n')
            command.chmod(0o755)
            cava = base / 'cava'
            cava.write_text('#!/bin/sh\nexit 1\n')
            cava.chmod(0o755)
            log = base / 'calls.log'
            env = dict(os.environ, PATH=str(base) + os.pathsep + os.environ['PATH'], AUDIO_TEST_LOG=str(log))
            process = subprocess.Popen([sys.executable, str(desklet)], env=env,
                                       stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                time.sleep(2.8)
                process.stdin.close()
                process.wait(timeout=4)
                self.assertEqual(process.returncode, 0, process.stderr.read().decode())
                calls = log.read_text().splitlines()
                self.assertGreaterEqual(calls.count('subscribe'), 1)
                self.assertLessEqual(calls.count('subscribe'), 2, 'Dead subscription must not respawn in a tight loop')
                self.assertLessEqual(calls.count('-f json list sinks'), 2)
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                process.stderr.close()
