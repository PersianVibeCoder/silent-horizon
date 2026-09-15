"""Build fixed clock faces. Build-time dependency: fonttools (not needed to install)."""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / 'fonts'
FACES = [
    ('horizon-verse/worksans/WorkSans[wght].ttf', 300, 'Silent Horizon Lead', 'Regular'),
    ('horizon-verse/worksans/WorkSans[wght].ttf', 100, 'Silent Horizon Time', 'Regular'),
    ('horizon-verse/baskervville/Baskervville-Italic[wght].ttf', 400, 'Silent Horizon Today', 'Italic'),
    ('inter/Inter-VariableFont_opsz,wght.ttf', 400, 'Silent Horizon Date', 'Regular'),
]

for source, weight, family, style in FACES:
    font = TTFont(FONTS / source)
    axes = {a.axisTag: a.defaultValue for a in font['fvar'].axes}
    axes['wght'] = weight
    font = instantiateVariableFont(font, axes, inplace=True)
    # Independent family names avoid installed font versions and synthetic styles.
    names = {1: family, 2: style, 3: family + '-1.0', 4: family + ' ' + style,
             6: family.replace(' ', '') + '-' + style, 16: family, 17: style}
    font['name'].names = [n for n in font['name'].names if n.nameID not in names and n.nameID not in (21, 22, 25)]
    for ident, value in names.items():
        font['name'].setName(value, ident, 3, 1, 0x409)
        font['name'].setName(value, ident, 1, 0, 0)
    font.save(FONTS / 'clock' / (family.replace(' ', '') + '.ttf'))
