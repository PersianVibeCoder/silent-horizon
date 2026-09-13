# Quiet Glass for Plank

This folder includes the creator's exact Quiet-Glass theme and user-local Plank renderer, including the corner lights, padded glass surface and rounded selection effect.

The renderer binary targets x86_64, glibc 2.38 or newer, and Plank 0.11.89 (as shipped with Mint 22 / Ubuntu 24.04). The installer checks these before enabling it. Other platforms get the normal Quiet Glass theme; build the supplied source to enable the custom rendering there.

The library is loaded only by the user-local Plank launcher. System libraries are never replaced. Installation backs up the theme, library, launcher, application entry, autostart entry and changed dock settings. Existing pinned apps and configured dock geometry are preserved. Log out and back in to start the custom renderer.

## Source and rebuilding

`plank-quiet-glass-source.tar.xz` contains the full patched Plank 0.11.89 source used for this renderer, including the Ubuntu compatibility changes. `quiet-glass.patch` documents the visual changes. Plank and these modifications retain GPL-3.0-or-later; see COPYING and individual source notices. They are excluded from the desktop project's MIT license.

Upstream source: https://archive.ubuntu.com/ubuntu/pool/universe/p/plank/plank_0.11.89.orig.tar.xz
Ubuntu patches: https://archive.ubuntu.com/ubuntu/pool/universe/p/plank/plank_0.11.89-4ubuntu5.debian.tar.xz

On Debian/Ubuntu, build dependencies include build-essential, pkg-config, valac, libtool-bin, libgtk-3-dev, libgee-0.8-dev, libbamf3-dev, libwnck-3-dev, libdbusmenu-gtk3-dev, libgnome-menu-3-dev and libplank-dev.

Extract the source archive, enter its folder, then run:

```sh
./configure --prefix=/usr --libdir=/usr/lib/x86_64-linux-gnu --disable-docs --disable-apport --disable-maintainer-mode
make -C lib -j2
```

The resulting `lib/.libs/libplank.so.1` can replace the user-local copy under `~/.local/lib/quiet-glass-plank/`. Keep the launcher and theme installed. No root access is needed to replace that local copy.
