#!/usr/bin/env python3
"""Restore the desktop state from before the first Silent Horizon installation."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
from install import Settings, restore


def uninstall(home, settings):
    folder = home / '.local/state/silent-horizon/backups'
    backups = sorted((p.parent for p in folder.glob('*/manifest.json')
                      if not (p.parent / 'restored').exists()), reverse=True)
    if not backups:
        print('No unrestored installation backups found. Nothing changed.')
        return
    for backup in backups:
        restore(backup, settings, home)
    if shutil.which('fc-cache'):
        subprocess.run(['fc-cache', '-f'], check=True)
    print('Uninstalled. Your pre-install files, fonts, wallpaper and panel settings are restored.')
    print('Log out and back in to unload the running applets and clock fonts.')
    print('Recovery backups, shared system packages and unbacked-up runtime caches are retained.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--yes', action='store_true')
    args = parser.parse_args()
    if os.geteuid() == 0:
        parser.error('Run this as the user who installed the desktop, without sudo.')
    if not args.yes:
        print('Restore all pending installation backups, newest first, to the pre-install desktop.')
        print('Changes made since installation to affected files and desktop settings will be undone.')
        if input('Uninstall and restore? [y/N] ').strip().lower() not in ('y', 'yes'):
            return
    uninstall(Path.home(), Settings())


if __name__ == '__main__':
    main()
