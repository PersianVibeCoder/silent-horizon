# Silent Horizon + Quiet Line · v1.1.3

- Fix desktop Spotify detection: discover all MPRIS players, including native and instance-suffixed Spotify names, instead of filtering for web browsers.
- Keep healthy media players available when another player fails discovery.
- Fix rapid media/refresh commands getting stuck in buffered input.
- Add independent color pickers for the clock headline/today, digits, date, and AM/PM. Right-click the clock → Configure; changes apply immediately.

Validation: private-session DBus integration tests with simulated Spotify and browser peers cover discovery, artwork, pause/next/previous/seek, source selection, player exit/relaunch, and a broken peer. This verifies the MPRIS bridge, not an authenticated Spotify client on every distribution. All 10 installer regressions and refresh-handler checks pass. Clock colors were rendered and inspected with the bundled fonts, including malformed/missing-setting fallbacks.

Download `silent-horizon.zip`, extract, run `bash install.sh` as your desktop user, then log out and back in to reload the updated service. Existing settings are preserved. Change clock colors in Configure. Uninstall with `bash uninstall.sh` to restore backed-up files/settings; shared system packages remain installed.

The wallpaper, fonts and Quiet Glass theme remain included; videos remain outside the ZIP. The existing video preview is linked in the README. New location defaults remain zero with a blank label.
