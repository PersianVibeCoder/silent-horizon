# Silent Horizon + Quiet Line · v1.1.1

- Bundle fixed clock font faces for the light headline, serif italic “today,” thin digits/AM-PM and spaced date. Verify the actual font paths at installation to catch fallback fonts.
- Use 12-hour time on new installs; preserve existing user preferences.
- Fix the minimized Weather arrow and make refresh writes asynchronous with duplicate-click protection.
- Keep the original taskbar icons, full-resolution wallpaper, Quiet Glass Plank theme/custom renderer and backup-based uninstaller.
- Replace the showcase with a 48-second 1080p60 video, original ambient score, smooth transitions and a Quiet Glass dock close-up.

Download `silent-horizon.zip`, extract it, run `bash install.sh`, then log out and back in. For an existing clock, turn off **24-hour clock** if you want AM/PM. Uninstall with `bash uninstall.sh`.

Video files are separate release assets and are not in the installer ZIP. Location defaults remain zero with a blank label.

Validation: ten installer tests, including a font-isolated install and intentional missing-italic failure; clock rendering compared against the original font files without host fonts; refresh button handlers tested with repeated requests and expansion toggles. Distribution-specific font rendering can still vary slightly.
