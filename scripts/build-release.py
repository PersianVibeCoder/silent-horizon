#!/usr/bin/env python3
"""Build the complete installable ZIP from an explicit directory allowlist."""
import hashlib
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / 'dist'
out.mkdir(exist_ok=True)
allowed = ['applets', 'desklets', 'fonts', 'wallpapers', 'media', 'scripts', 'tests', 'plank']
files = [root / name for name in ['README.md', 'LICENSE', 'CREDITS.md', 'install.sh', 'uninstall.sh']]
for name in allowed:
    files.extend(p for p in (root / name).rglob('*') if p.is_file()
                 and '__pycache__' not in p.parts and p.suffix != '.pyc')
archive = out / 'silent-horizon.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for p in sorted(files):
        relative = p.relative_to(root)
        if p.is_symlink():
            raise RuntimeError('Release must not contain symbolic links: ' + str(relative))
        info = zipfile.ZipInfo('silent-horizon/' + str(relative), date_time=(2026, 9, 13, 0, 0, 0))
        info.external_attr = (0o100755 if p.name == 'install.sh' else 0o100644) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, p.read_bytes())
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / 'SHA256SUMS').write_text(f'{digest}  {archive.name}\n')
print(archive)
print(digest)
