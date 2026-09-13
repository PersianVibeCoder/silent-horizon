#!/usr/bin/python3
"""Cache a soft wallpaper backdrop; never capture windows or the screen."""
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter
import hashlib,sys,urllib.parse,os

def main():
    uri,mode,width,height=sys.argv[1:]
    parsed=urllib.parse.urlparse(uri)
    if parsed.scheme not in ('file',''):raise ValueError('Local wallpaper required')
    source=Path(urllib.parse.unquote(parsed.path))
    w,h=int(width),int(height)
    key=hashlib.sha256(f'{source}:{source.stat().st_mtime_ns}:{mode}:{w}:{h}:soft-frost-v1'.encode()).hexdigest()[:24]
    cache=Path(os.environ.get('XDG_CACHE_HOME',str(Path.home()/'.cache')))/'quiet-sky';cache.mkdir(parents=True,exist_ok=True)
    target=cache/f'frost-{key}.png'
    if not target.exists():
        # Work at half resolution; interpolation plus Gaussian diffusion removes
        # individual stars without continuously blurring Cinnamon's scene.
        size=(max(1,w//2),max(1,h//2))
        with Image.open(source) as original:
            im=original.convert('RGB')
            if mode in ('zoom','spanned'):im=ImageOps.fit(im,size,Image.Resampling.LANCZOS)
            elif mode=='stretched':im=im.resize(size,Image.Resampling.LANCZOS)
            elif mode=='scaled':
                im=ImageOps.contain(im,size,Image.Resampling.LANCZOS)
                canvas=Image.new('RGB',size);canvas.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2));im=canvas
            else:
                im=im.resize((max(1,im.width//2),max(1,im.height//2)),Image.Resampling.LANCZOS)
                canvas=Image.new('RGB',size)
                if mode=='wallpaper':
                    for y in range(0,size[1],im.height):
                        for x in range(0,size[0],im.width):canvas.paste(im,(x,y))
                else:canvas.paste(im,((size[0]-im.width)//2,(size[1]-im.height)//2))
                im=canvas
            im=im.filter(ImageFilter.GaussianBlur(11))
            temporary=target.with_suffix('.tmp.png');im.save(temporary);temporary.replace(target)
    print(target)

if __name__=='__main__':main()
