# Cinnamon performance and lifecycle improvements

Preserves the existing design and visible animation cadence while reducing
unnecessary redraws, repeated calculations and background polling.

## Changes

- Weather-card invalidation no longer includes music metadata or playback position.
  Media progress continues to update in the music component.
- Cache the static portion of the ribbon overlay; retain its existing 100 ms frame
  interval, 48-second cycle, drawing order, colour and opacity.
- Stop ribbon timers, audio visualisers and open system-monitor helpers when their
  actor is unmapped or Cinnamon's screensaver is active. Restart on visibility/unlock.
  A collapsed card's visible header still animates.
- Clock/weather desklet housekeeping aligns to minute boundaries; music keeps its
  one-second position updates. Incoming data still updates immediately.
- Cache daily sunrise/sunset and upcoming solar events. Invalidate for location,
  date/timezone, crossed events, backwards time changes and manual refresh. Keep
  live planet positions and night-time Moon calculations on their minute cadence.
- Load and decode renderer images asynchronously, coalesce pending requests, bound
  the decoded-image cache, back off failed loads, and cancel on disposal.
- MPRIS player changes use D-Bus signals, with five-second property and 30-second
  discovery fallbacks for incomplete players. Keep the weather bridge outside Cinnamon.
- Audio topology uses its existing PulseAudio subscription, with a 30-second
  recovery scan instead of four seconds. Failed subscriptions retry at most once
  every two seconds; failed visualiser launches back off for five seconds.
- Track helper exit and close the parent pipe on music-desklet removal/pause.

No changes to assets, fonts, CSS, installer backup/restore, or the Plank renderer.
A live HiDPI check also corrected installer monitor sizing: GDK logical dimensions
are multiplied by the monitor scale to match Cinnamon stage coordinates.
Weather and air-quality refresh remain five minutes (weather-error retry: one minute).
The two `quietActivity.js` copies are intentionally identical so applets and desklets
can be loaded independently from their respective Cinnamon search paths.

## Offline checks

Run from the project root:

```sh
python3 -m unittest discover -s tests
node tests/redraw-regression.js
cjs tests/refresh-handler.js desklets/silent-horizon@alborz/cardRefresh20260913.js
dbus-run-session -- cjs tests/activity-regression.js "$PWD"
dbus-run-session -- /usr/bin/python3 tests/media-integration.py
```

The unittest suite includes 24 pixel-exact comparisons against the original glow
rendering sequence, covering expanded/collapsed cards, 1x/1.1x/1.53x scale, and cache
reuse across animation frames. It also runs actual image decoding, real astronomy
cache checks, and a failing-audio-service recovery test. D-Bus tests use an isolated
bus; media tests stub weather fetching and need neither network access nor login.
These checks do not prove full-desktop visual parity or actual CPU savings.

## Validation

- 12 unittest cases passed, including all 24 pixel-identical glow comparisons.
- Redraw isolation, refresh handler, clock colours, isolated media integration
  (including external playback signals), and isolated screensaver lifecycle passed.
- All applet/desklet JavaScript and Python syntax checks passed; `git diff --check` is clean.
- Full installation and live weather/system/media/lifecycle smoke checks passed.
- Controlled before/after CPU benchmarking has not been performed.

## Further live validation

1. Capture the current desktop layout and measure Cinnamon plus helper CPU/RSS
   under a fixed workload; retain the unmodified Git revision for an A/B comparison.
2. Use a disposable profile or the installer backup/restore workflow for comparisons.
   Configure the intended location before evaluating weather/astronomy accuracy.
3. Compare original and patched clock, weather, system and media components
   separately. Use the same scene, scale, playback and sampling duration.
4. Exercise collapse/expand, pause/resume, device switching, fullscreen windows,
   lock/unlock, suspend/resume, monitor/scale changes and removal/reload.
5. Compare screenshots and animation; check Cinnamon logs and remaining helpers.
   Verify both widgets-only and full panel/dock layouts.

Unmapped/locked detection is implemented. Arbitrary window coverage is not: Cinnamon
can leave a desklet mapped behind another window. Aggressive occlusion detection
is deferred rather than risking visibly paused animations. Idle time alone does
not freeze visible effects. The system card still shares a drawing area with the
weather card; its intentional once-per-second telemetry repaint remains while open.
