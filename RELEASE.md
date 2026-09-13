# Silent Horizon + Quiet Line · v1.1.0

- Restore the original taskbar icons and correct clock/card proportions and panel sizing.
- Refresh Cinnamon’s font map so the bundled clock fonts can be picked up correctly.
- Install Plank when missing and apply Quiet Glass, preserving existing pinned apps and dock layout.
- Include the custom Quiet Glass renderer for compatible Plank 0.11.89 systems, with full patched source and build instructions.
- Include the original full-resolution Gemini Blue wallpaper and backup-based uninstall.

Download `silent-horizon.zip`, extract it and run `bash install.sh`. Log out and back in afterward. Run `bash uninstall.sh` to restore backed-up desktop files and settings. Shared system packages remain installed.

New location defaults are zero with a blank label. The showcase video remains on the main page and outside the installer ZIP.

Validation: nine installer tests pass. Clock rendering was compared pixel-for-pixel in an isolated Cinnamon session; original taskbar icons and the Quiet Glass dock were inspected there. The final rebuilt renderer has not had a further graphical run, and other distributions remain unverified.
