# Silent Horizon + Quiet Line · v1.0.1

- Register and verify the bundled clock fonts before enabling desklets.
- Install only missing APT dependencies; skip sudo when everything is already present.
- Add `bash uninstall.sh` to restore all installation backups and return to the pre-install desktop, including installations made with v1.0.0.

Download `silent-horizon.zip`, extract it, and run `bash install.sh`. On the same PC with dependencies already available, the installer needs no administrator access. After updating, log out and back in so Cinnamon reloads the fonts.

To uninstall, run `bash uninstall.sh` as the user who installed it. Recovery backups, shared system packages and unbacked-up runtime caches are retained. The desktop files, bundled fonts, wallpaper and panel settings are removed or restored from their pre-install backups.

The ZIP includes Gemini Blue wallpaper and fonts, but no video. The preview plays on the repository main page. New location defaults remain 0, 0 with a blank label.

Validation: installer tests cover font-registration order, updates, rollback, uninstall through multiple backups and repeated uninstall. A separate clean graphical session is still needed to verify the reported clock appearance.
