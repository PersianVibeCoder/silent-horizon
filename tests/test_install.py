import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('installer', ROOT / 'scripts/install.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class FakeSettings:
    def __init__(self):
        self.data = {
            ('org.cinnamon', 'enabled-desklets'): "['old@example:4:10:20']",
            ('org.cinnamon', 'enabled-applets'): "['panel1:left:0:menu@cinnamon.org:5']",
            ('org.cinnamon', 'panels-enabled'): "['1:0:bottom']",
            ('org.cinnamon', 'panels-height'): "['1:40']",
            **{('org.cinnamon', k): "'[]'" for k in ['panel-zone-icon-sizes','panel-zone-symbolic-icon-sizes','panel-zone-text-sizes']},
            ('org.cinnamon', 'next-desklet-id'): '9',
            ('org.cinnamon', 'next-applet-id'): '10',
            ('org.cinnamon.desktop.background', 'picture-uri'): "'file:///previous.jpg'",
            ('org.cinnamon.desktop.background', 'picture-options'): "'scaled'",
        }
        self.fail = False

    def get(self, schema, key):
        return self.data[schema, key]

    def set(self, schema, key, value):
        if self.fail and key == 'enabled-desklets':
            self.fail = False
            raise RuntimeError('Simulated settings failure')
        self.data[schema, key] = value


class InstallerTests(unittest.TestCase):
    def test_install_repeat_and_restore(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            settings = FakeSettings()
            original = settings.data.copy()
            prior = home / '.local/share/cinnamon/desklets' / mod.DESK
            prior.mkdir(parents=True)
            (prior / 'my-file.txt').write_text('previous version')
            backup = mod.install(home, settings, 'full')
            instances = list((home / '.config/cinnamon/spices' / mod.DESK).glob('*.json'))
            self.assertEqual(len(instances), 2)
            data = json.loads(instances[0].read_text())
            self.assertEqual(data['latitude']['value'], 0)
            self.assertEqual(data['longitude']['value'], 0)
            self.assertEqual(data['city']['value'], '')
            data['latitude']['value'] = 12
            instances[0].write_text(json.dumps(data))
            enabled = settings.data['org.cinnamon', 'enabled-applets']
            second = mod.install(home, settings, 'full')
            self.assertEqual(settings.data['org.cinnamon', 'enabled-applets'], enabled)
            self.assertEqual(json.loads(instances[0].read_text())['latitude']['value'], 12)
            mod.restore(second, settings, home)
            mod.restore(backup, settings, home)
            self.assertEqual(settings.data, original)
            self.assertEqual((prior / 'my-file.txt').read_text(), 'previous version')
            self.assertFalse(instances[0].exists())

    def test_widgets_preserves_panels_and_wallpaper(self):
        with tempfile.TemporaryDirectory() as temp:
            settings = FakeSettings()
            original = settings.data.copy()
            mod.install(Path(temp), settings, 'widgets')
            for key, value in original.items():
                if key[1] not in ['enabled-desklets', 'next-applet-id', 'next-desklet-id']:
                    self.assertEqual(settings.data[key], value)

    def test_failure_rolls_back(self):
        with tempfile.TemporaryDirectory() as temp:
            settings = FakeSettings()
            original = settings.data.copy()
            settings.fail = True
            with self.assertRaisesRegex(RuntimeError, 'Simulated'):
                mod.install(Path(temp), settings, 'full')
            self.assertEqual(settings.data, original)
            self.assertFalse((Path(temp) / '.local/share/cinnamon/desklets' / mod.DESK).exists())

    def test_fonts_prepared_before_activation(self):
        with tempfile.TemporaryDirectory() as temp:
            settings = FakeSettings()
            original = settings.data.copy()
            calls = []
            def prepare(home):
                self.assertTrue((home / '.local/share/fonts/silent-horizon/horizon-verse/baskervville/Baskervville-Italic[wght].ttf').exists())
                self.assertEqual(settings.data, original)
                calls.append(True)
            mod.install(Path(temp), settings, 'full', prepare_fonts=prepare)
            self.assertEqual(calls, [True])

    def test_uninstall_restores_first_install_and_is_repeatable(self):
        import sys
        from unittest.mock import patch
        sys.path.insert(0, str(ROOT / 'scripts'))
        import uninstall
        with tempfile.TemporaryDirectory() as temp:
            settings = FakeSettings()
            original = settings.data.copy()
            home = Path(temp)
            first = mod.install(home, settings, 'full')
            second = mod.install(home, settings, 'full')
            with patch.object(uninstall.shutil, 'which', return_value=None):
                uninstall.uninstall(home, settings)
                self.assertEqual(settings.data, original)
                self.assertFalse((home / '.local/share/fonts/silent-horizon').exists())
                self.assertFalse((home / '.local/share/cinnamon/applets' / mod.APP).exists())
                uninstall.uninstall(home, settings)
                self.assertEqual(settings.data, original)
            self.assertTrue((first / 'restored').exists())
            self.assertTrue((second / 'restored').exists())

    def test_reference_scales_and_upgrade(self):
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            settings = FakeSettings()
            mod.install(home, settings, 'full', 2560, 1440)
            configs = list((home / '.config/cinnamon/spices' / mod.DESK).glob('*.json'))
            for p in configs:
                data = json.loads(p.read_text())
                self.assertEqual(data['scale']['value'], 1.53 if data['role']['value'] == 'clock' else 1.1)
                data['scale']['value'] = 1.33
                p.write_text(json.dumps(data))
            mod.install(home, settings, 'full', 2560, 1440)
            for p in configs:
                data = json.loads(p.read_text())
                self.assertEqual(data['scale']['value'], 1.53 if data['role']['value'] == 'clock' else 1.1)

    def test_plank_existing_dock_keeps_layout_and_restores(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as temp:
            home = Path(temp)
            (home / '.config/plank/dock1').mkdir(parents=True)
            settings = FakeSettings()
            schema = 'net.launchpad.plank.dock.settings:/net/launchpad/plank/docks/dock1/'
            settings.data['net.launchpad.plank', 'enabled-docks'] = "['dock1']"
            settings.data[schema, 'theme'] = "'Existing theme'"
            settings.data[schema, 'icon-size'] = '64'
            settings.data[schema, 'dock-items'] = "['my-app.dockitem']"
            original = settings.data.copy()
            tx = mod.Transaction(home, settings)
            with patch.object(mod, 'run', return_value='Plank 0.11.89'), patch.object(mod.platform, 'machine', return_value='x86_64'), patch.object(mod.platform, 'libc_ver', return_value=('glibc','2.39')):
                mod.install_plank(tx, home, settings)
            self.assertEqual(settings.data[schema, 'theme'], "'Quiet-Glass'")
            self.assertEqual(settings.data[schema, 'icon-size'], '64')
            self.assertEqual(settings.data[schema, 'dock-items'], "['my-app.dockitem']")
            self.assertTrue((home / '.local/lib/quiet-glass-plank/libplank.so.1').exists())
            mod.restore(tx.backup, settings, home)
            self.assertEqual(settings.data, original)
            self.assertFalse((home / '.config/autostart/plank.desktop').exists())

    def test_dry_run(self):
        result = subprocess.run(['bash', str(ROOT / 'install.sh'), '--dry-run'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('No changes made', result.stdout)

    def test_zero_observer_defaults(self):
        folder = ROOT / 'desklets' / mod.DESK
        schema = json.loads((folder / 'settings-schema.json').read_text())
        for key in ['latitude', 'longitude', 'elevation']:
            self.assertEqual(schema[key]['default'], 0)
        self.assertEqual(schema['city']['default'], '')
        for name in ['cardRefresh20260913.js', 'quietHorizonPolish20260911.js']:
            self.assertIn('s.latitude ?? 0,s.longitude ?? 0,s.elevation ?? 0', (folder / name).read_text())


if __name__ == '__main__':
    unittest.main()
