#!/usr/bin/env python3
"""Stream spectrum magnitudes from playback monitors. Never captures microphones."""
import json
import os
import pathlib
import re
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time

BANDS = 18
FPS = 20
ENV = dict(os.environ, LC_ALL='C')
RUNNING = True

def stop(*_):
    global RUNNING
    RUNNING = False

def pulse(*args):
    return subprocess.check_output(['pactl', *args], env=ENV, text=True,
                                   stderr=subprocess.DEVNULL, timeout=2)

def output_monitors():
    sinks = json.loads(pulse('-f', 'json', 'list', 'sinks'))
    streams = json.loads(pulse('-f', 'json', 'list', 'sink-inputs'))
    default = pulse('get-default-sink').strip()
    active = {int(s['sink']) for s in streams if not s.get('corked', False)}
    result = {}
    for sink in sinks:
        if sink['name'] != default and int(sink['index']) not in active:
            continue
        # Only the monitor field of an output sink is accepted. Never fall back
        # to the default input source, which could be the user's microphone.
        monitor = sink.get('monitor_source_name') or sink.get('monitor_source')
        if isinstance(monitor, str) and monitor.endswith('.monitor'):
            result[monitor] = sink.get('description', sink['name'])
    return result

class Worker:
    def __init__(self, monitor, directory, selector):
        self.monitor = monitor
        self.selector = selector
        self.values = [0.0] * BANDS
        self.last = 0.0
        self.buffer = b''
        self.config = pathlib.Path(directory) / ('source-' + str(time.monotonic_ns()) + '.conf')
        self.config.write_text(f'''[general]
framerate = {FPS}
bars = {BANDS}
autosens = 1
sensitivity = 100
lower_cutoff_freq = 50
higher_cutoff_freq = 12000
[input]
method = pulse
source = {monitor}
[output]
method = raw
raw_target = /dev/stdout
data_format = ascii
ascii_max_range = 1000
bar_delimiter = 59
frame_delimiter = 10
channels = mono
mono_option = average
[smoothing]
noise_reduction = 0.75
''')
        self.process = subprocess.Popen(['cava', '-p', str(self.config)],
            stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=ENV)
        os.set_blocking(self.process.stdout.fileno(), False)
        selector.register(self.process.stdout, selectors.EVENT_READ, self)

    def read(self):
        data = os.read(self.process.stdout.fileno(), 65536)
        if not data:
            return False
        self.buffer = (self.buffer + data)[-262144:]
        lines = self.buffer.split(b'\n')
        self.buffer = lines.pop()
        for line in reversed(lines):
            # CAVA may prepend a terminal-title escape before its first frame.
            line = re.sub(rb'\x1b\][^\x07]*\x07', b'', line)
            try:
                raw = [int(v) for v in line.split(b';') if v.strip()]
            except ValueError:
                continue
            if len(raw) == BANDS:
                self.values = [max(0.0, min(1.0, (v - 3) / 997)) for v in raw]
                self.last = time.monotonic()
                break
        return True

    def close(self):
        try:
            self.selector.unregister(self.process.stdout)
        except Exception:
            pass
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait()
        self.process.stdout.close()
        self.config.unlink(missing_ok=True)

def main():
    if not shutil.which('cava') or not shutil.which('pactl'):
        print(json.dumps({'status': 'CAVA or pactl is unavailable', 'bands': [0] * BANDS}), flush=True)
        return
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, stop)
    selector = selectors.DefaultSelector()
    # Cinnamon keeps this pipe open. If Cinnamon exits, the helper and every
    # CAVA child close too, including on crashes or an unexpected parent exit.
    try:
        selector.register(sys.stdin.buffer, selectors.EVENT_READ, 'parent')
    except (OSError, PermissionError):
        pass
    subscription = None
    workers = {}
    names = {}
    smooth = [0.0] * BANDS
    refresh = 0.0
    emit = 0.0
    last_sent = None
    heartbeat = 0.0
    status = 'Connecting to playback'
    with tempfile.TemporaryDirectory(prefix='orbit-audio-') as directory:
        try:
            while RUNNING:
                now = time.monotonic()
                if subscription is None or subscription.poll() is not None:
                    if subscription is not None:
                        try: selector.unregister(subscription.stdout)
                        except Exception: pass
                        subscription.stdout.close()
                        subscription.wait()
                    subscription = subprocess.Popen(['pactl', 'subscribe'], stdout=subprocess.PIPE,
                        stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL, env=ENV)
                    os.set_blocking(subscription.stdout.fileno(), False)
                    selector.register(subscription.stdout, selectors.EVENT_READ, 'pulse')
                if now >= refresh:
                    refresh = now + 4.0
                    try:
                        desired = output_monitors()
                        for monitor in list(workers):
                            if monitor not in desired or workers[monitor].process.poll() is not None:
                                workers.pop(monitor).close()
                        for monitor in desired:
                            if monitor not in workers:
                                workers[monitor] = Worker(monitor, directory, selector)
                        names = desired
                        status = 'ready' if workers else 'No playback output'
                    except (OSError, ValueError, subprocess.SubprocessError):
                        status = 'Waiting for audio service'
                        for worker in workers.values(): worker.close()
                        workers.clear(); names = {}
                        refresh = now + 2.0
                for key, _ in selector.select(max(0, min(1 / FPS, emit - time.monotonic()))):
                    if key.data == 'parent':
                        if not os.read(key.fileobj.fileno(), 1024):
                            return
                    elif key.data == 'pulse':
                        events = os.read(key.fileobj.fileno(), 65536)
                        if b'sink-input' in events or b' on server ' in events or b' on sink ' in events:
                            refresh = min(refresh, time.monotonic() + 0.12)
                    else:
                        worker = key.data
                        if not worker.read():
                            workers.pop(worker.monitor, None)
                            worker.close()
                            refresh = min(refresh, time.monotonic() + 1)
                now = time.monotonic()
                if now < emit:
                    continue
                emit = now + 1 / FPS
                fresh = [w.values for w in workers.values() if now - w.last < 0.4]
                for i in range(BANDS):
                    target = max((v[i] for v in fresh), default=0)
                    smooth[i] += (target - smooth[i]) * (0.58 if target > smooth[i] else 0.20)
                    if smooth[i] < 0.003:
                        smooth[i] = 0.0
                bands = [round(v, 3) for v in smooth]
                signature = (tuple(bands), tuple(names), status)
                if signature != last_sent or now - heartbeat > 2:
                    print(json.dumps({'bands': bands, 'status': status,
                        'sources': list(names), 'outputs': list(names.values())}, separators=(',', ':')), flush=True)
                    last_sent = signature; heartbeat = now
        except (BrokenPipeError, KeyboardInterrupt):
            pass
        finally:
            for worker in workers.values():
                worker.close()
            if subscription is not None:
                try: selector.unregister(subscription.stdout)
                except Exception: pass
                if subscription.poll() is None: subscription.terminate()
                try: subscription.wait(timeout=1)
                except subprocess.TimeoutExpired: subscription.kill(); subscription.wait()
                subscription.stdout.close()
            selector.close()

if __name__ == '__main__':
    main()
