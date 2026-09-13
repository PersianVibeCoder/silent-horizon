#!/usr/bin/env python3
"""User-local Cinnamon installation with a journaled backup and explicit restore."""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DESK = 'silent-horizon@alborz'
APP = 'quiet-line@alborz'
PACKAGES = ['python3-gi', 'python3-pil', 'gir1.2-gtk-3.0', 'cava',
            'pulseaudio-utils', 'fontconfig']


def run(args):
    return subprocess.check_output(args, text=True).strip()


class Settings:
    def get(self, schema, key):
        return run(['gsettings', 'get', schema, key])

    def set(self, schema, key, value):
        subprocess.run(['gsettings', 'set', schema, key, value], check=True)


def parse_list(value):
    # gsettings can prefix an empty string array with its GVariant type.
    import ast
    return ast.literal_eval(value.removeprefix('@as '))


def config(schema_file, overrides):
    data = json.loads(schema_file.read_text())
    for key, item in data.items():
        if 'default' in item:
            item['value'] = overrides.get(key, item['default'])
    return data


class Transaction:
    def __init__(self, home, settings):
        self.home = home.resolve()
        self.settings = settings
        stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
        self.backup = self.home / '.local/state/silent-horizon/backups' / stamp
        self.backup.mkdir(parents=True, mode=0o700)
        self.journal = {'home': str(self.home), 'files': [], 'settings': []}
        self.save()

    def save(self):
        tmp = self.backup / 'manifest.tmp'
        tmp.write_text(json.dumps(self.journal, indent=2))
        tmp.replace(self.backup / 'manifest.json')

    def record_file(self, dest):
        dest = Path(dest)
        if not dest.resolve().is_relative_to(self.home):
            raise RuntimeError('Install destination escapes your home directory: ' + str(dest))
        if dest.is_symlink():
            raise RuntimeError('Refusing to replace symbolic link: ' + str(dest))
        slot = str(len(self.journal['files']))
        exists = dest.exists()
        if exists:
            copy(dest, self.backup / slot)
        self.journal['files'].append({'path': str(dest), 'slot': slot, 'existed': exists})
        self.save()

    def put(self, source, dest):
        self.record_file(dest)
        remove(dest)
        copy(source, dest)

    def write_json(self, data, dest):
        self.record_file(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(data, indent=2) + '\n')

    def setting(self, schema, key, value):
        old = self.settings.get(schema, key)
        self.journal['settings'].append([schema, key, old])
        self.save()
        self.settings.set(schema, key, value)


def copy(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source.is_dir():
        shutil.copytree(source, dest)
    else:
        shutil.copy2(source, dest)


def remove(path):
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.is_dir():
        shutil.rmtree(path)


def restore(backup, settings, home):
    data = json.loads((backup / 'manifest.json').read_text())
    if Path(data['home']).resolve() != home.resolve():
        raise RuntimeError('This backup belongs to a different home directory.')
    for item in data['files']:
        if not Path(item['path']).resolve().is_relative_to(home.resolve()):
            raise RuntimeError('Unsafe path in backup manifest.')
    # Disable the new components before restoring their files.
    for schema, key, old in reversed(data['settings']):
        settings.set(schema, key, old)
    for item in reversed(data['files']):
        dest = Path(item['path'])
        remove(dest)
        if item['existed']:
            copy(backup / item['slot'], dest)
    (backup / 'restored').touch()
    print('Previous files and desktop settings restored. Log out and back in.')


def install(home, settings, layout, width=1920, height=1080, prepare_fonts=None):
    tx = Transaction(home, settings)
    try:
        for kind, uuid in [('desklets', DESK), ('applets', APP)]:
            tx.put(ROOT / kind / uuid, home / '.local/share/cinnamon' / kind / uuid)
        tx.put(ROOT / 'fonts', home / '.local/share/fonts/silent-horizon')
        if prepare_fonts:
            prepare_fonts(home)
        wallpaper = home / '.local/share/backgrounds/silent-horizon/Gemini Blue_no stars.jpg'
        tx.put(ROOT / 'wallpapers/Gemini Blue_no stars.jpg', wallpaper)
        desklets = parse_list(settings.get('org.cinnamon', 'enabled-desklets'))
        applets = parse_list(settings.get('org.cinnamon', 'enabled-applets'))
        ids = [int(v.split(':')[1]) for v in desklets if v.split(':')[1].isdigit()]
        ids += [int(v.split(':')[-1]) for v in applets if v.split(':')[-1].isdigit()]
        ids += [int(settings.get('org.cinnamon', key)) for key in ['next-applet-id', 'next-desklet-id']]
        # Also avoid disabled instances whose saved configuration still exists.
        for uuid in [DESK, APP]:
            ids += [int(p.stem) for p in (home / '.config/cinnamon/spices' / uuid).glob('*.json') if p.stem.isdigit()]
        next_id = max(ids + [0]) + 1
        def instance(kind, uuid, role, extra=None):
            nonlocal next_id
            ident = next_id
            next_id += 1
            schema = ROOT / kind / uuid / 'settings-schema.json'
            values = {'role': role, **(extra or {})}
            tx.write_json(config(schema, values), home / '.config/cinnamon/spices' / uuid / f'{ident}.json')
            return ident
        # Reuse existing instances/settings on updates, including the recipient's location.
        existing = [v for v in desklets if v.startswith(DESK + ':')]
        if not existing:
            scale = round(min(width / 1920, height / 1080), 2)
            for role in ['clock', 'dashboard']:
                ident = instance('desklets', DESK, role, {'scale': max(.5, min(3, scale))})
                desklets.append(f'{DESK}:{ident}:100:100')
        if layout == 'full':
            roles = {}
            stock_ids = {}
            for entry in applets:
                parts = entry.split(':')
                if len(parts) != 5:
                    continue
                stock_ids[parts[3]] = parts[4]
                if parts[3] == APP:
                    saved = home / '.config/cinnamon/spices' / APP / (parts[4] + '.json')
                    if saved.exists():
                        role = json.loads(saved.read_text()).get('role', {}).get('value')
                        roles[role] = parts[4]
            applets = []
            def stock(uuid, side, order):
                nonlocal next_id
                ident = stock_ids.get(uuid)
                if ident is None:
                    ident = next_id
                    next_id += 1
                applets.append(f'panel1:{side}:{order}:{uuid}:{ident}')
            stock('menu@cinnamon.org', 'left', 0)
            for role, side, order in [('navigation', 'left', 1), ('center', 'right', 0), ('controls', 'right', 30)]:
                ident = roles.get(role)
                if ident is None:
                    ident = instance('applets', APP, role)
                applets.append(f'panel1:{side}:{order}:{APP}:{ident}')
            for order, uuid in enumerate(['calendar', 'notifications', 'network', 'sound', 'systray', 'xapp-status', 'removable-drives', 'keyboard', 'power'], 1):
                # Some Cinnamon installations do not ship every optional stock applet.
                if (Path('/usr/share/cinnamon/applets') / (uuid + '@cinnamon.org')).exists():
                    stock(uuid + '@cinnamon.org', 'right', order)
            tx.setting('org.cinnamon', 'panels-enabled', repr(['1:0:top']))
            tx.setting('org.cinnamon', 'panels-height', repr(['1:44']))
            tx.setting('org.cinnamon.desktop.background', 'picture-uri', repr(wallpaper.as_uri()))
            tx.setting('org.cinnamon.desktop.background', 'picture-options', repr('zoom'))
            tx.setting('org.cinnamon', 'enabled-applets', repr(applets))
        tx.setting('org.cinnamon', 'enabled-desklets', repr(desklets))
        tx.setting('org.cinnamon', 'next-desklet-id', str(next_id))
        tx.setting('org.cinnamon', 'next-applet-id', str(next_id))
    except BaseException:
        print('Installation failed. Restoring the saved desktop settings…', file=sys.stderr)
        restore(tx.backup, settings, home)
        raise
    return tx.backup


def refresh_fonts(home):
    if not shutil.which('fc-cache') or not shutil.which('fc-match'):
        raise RuntimeError('fontconfig is required. Install it before using --no-deps.')
    subprocess.run(['fc-cache', '-f', str(home / '.local/share/fonts/silent-horizon')], check=True)
    for pattern, family in [('Baskervville:style=Italic', 'Baskervville'), ('Work Sans:weight=light', 'Work Sans'), ('Inter', 'Inter')]:
        resolved = run(['fc-match', '-f', '%{family}', pattern])
        if family not in resolved.split(','):
            raise RuntimeError(f'Font {family} was not registered (resolved to {resolved}).')
    print('Clock fonts registered: Baskervville Italic, Work Sans and Inter.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--layout', choices=['full', 'widgets'], default='full')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--no-deps', action='store_true')
    parser.add_argument('--yes', action='store_true', help='Accept replacing the panel and wallpaper when using full layout')
    parser.add_argument('--restore', type=Path, metavar='BACKUP_DIRECTORY')
    args = parser.parse_args()
    if args.dry_run:
        print('Plan: user-local desklets, applets, fonts and wallpaper. New weather settings: 0, 0; blank label.')
        print('Layout:', args.layout, '— full replaces panels and wallpaper; widgets preserves them.')
        print('Dependencies:', ' '.join(PACKAGES) if not args.no_deps else 'skipped')
        print('Back up changed files and settings under ~/.local/state/silent-horizon/backups/. No changes made.')
        return
    if os.geteuid() == 0:
        parser.error('Run as your normal desktop user, without sudo. Only dependency installation uses sudo.')
    if not shutil.which('gsettings') or not shutil.which('cinnamon'):
        parser.error('Cinnamon is required. This installer does not install or replace your desktop environment.')
    settings = Settings()
    if args.restore:
        restore(args.restore.expanduser().resolve(), settings, Path.home())
        return
    if not args.yes:
        print('Silent Horizon installs weather/sky and clock desklets, Quiet Line, fonts and wallpaper.')
        print('Full layout replaces the current panel layout and wallpaper; widgets leaves those settings alone.')
        print('Selected:', args.layout, '— your current settings and affected files will be backed up.')
        if input('Install? [y/N] ').strip().lower() not in ('y', 'yes'):
            print('Cancelled. Nothing changed.')
            return
    if not args.no_deps:
        if not shutil.which('apt-get'):
            parser.error('Install the README dependencies for your distribution, then run with --no-deps.')
        missing = []
        for package in PACKAGES:
            result = subprocess.run(['dpkg-query', '-W', '-f=${Status}', package], capture_output=True, text=True)
            if result.returncode or result.stdout.strip() != 'install ok installed':
                missing.append(package)
        if missing:
            subprocess.run(['sudo', 'apt-get', 'update'], check=True)
            subprocess.run(['sudo', 'apt-get', 'install', '-y', *missing], check=True)
        else:
            print('All dependencies are installed; no administrator access needed.')
    width, height = 1920, 1080
    try:
        import gi
        gi.require_version('Gdk', '3.0')
        from gi.repository import Gdk
        screen = Gdk.Screen.get_default()
        if screen:
            geometry = screen.get_monitor_geometry(screen.get_primary_monitor())
            width, height = geometry.width, geometry.height
    except (ImportError, ValueError):
        pass
    backup = install(Path.home(), settings, args.layout, width, height, prepare_fonts=refresh_fonts)
    print('\nInstalled. Log out and back in to load all components and fonts.')
    print('Right-click Weather → Configure to enter your own location. Defaults are 0, 0.')
    print('Restore command:\n  python3 ' + repr(str(Path(__file__).resolve())) + ' --restore ' + repr(str(backup)))


if __name__ == '__main__':
    main()
