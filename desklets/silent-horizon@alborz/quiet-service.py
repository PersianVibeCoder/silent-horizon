#!/usr/bin/python3
"""Desktop/browser MPRIS and weather bridge. All blocking IO stays outside Cinnamon."""
import base64
import hashlib
import io
from PIL import Image
import json
import os
from pathlib import Path
import queue
import re
import selectors
import sys
import threading
import time
import urllib.parse
import urllib.request
from gi.repository import Gio, GLib

CACHE = Path(os.environ.get('XDG_CACHE_HOME', str(Path.home()/'.cache'))) / 'quiet-sky'
CACHE.mkdir(parents=True, exist_ok=True)
RESULTS = queue.Queue()
BUS = Gio.bus_get_sync(Gio.BusType.SESSION, None)
PLAYER = 'org.mpris.MediaPlayer2.Player'
PATH = '/org/mpris/MediaPlayer2'

def emit(kind, **values):
    print(json.dumps(dict(kind=kind, **values), ensure_ascii=False), flush=True)

def call(name, path, interface, method, args=None):
    return BUS.call_sync(name, path, interface, method, args, None,
                         Gio.DBusCallFlags.NONE, 1200, None).unpack()

def props(name, interface):
    return call(name, PATH, 'org.freedesktop.DBus.Properties', 'GetAll',
                GLib.Variant('(s)', (interface,)))[0]

def fetch(url, limit=8_000_000):
    if urllib.parse.urlparse(url).scheme not in ('http', 'https'):
        raise ValueError('Unsupported URL')
    req = urllib.request.Request(url, headers={'User-Agent':'QuietSky/1.0'})
    with urllib.request.urlopen(req, timeout=15) as response:
        data = response.read(limit+1)
        if len(data)>limit:
            raise ValueError('Response exceeds limit')
        return data

def weather(lat, lon, fahrenheit):
    key = hashlib.sha256(f'{lat},{lon},{fahrenheit}'.encode()).hexdigest()[:16]
    path = CACHE/f'atmosphere-weather-{key}.json'
    try:
        if path.exists():
            old = json.loads(path.read_text())
            RESULTS.put(('weather', dict(old, stale=time.time()-old['updated']>1800)))
        query = urllib.parse.urlencode(dict(latitude=lat, longitude=lon,
            current='temperature_2m,weather_code,is_day,relative_humidity_2m,apparent_temperature,wind_speed_10m',
            hourly='temperature_2m,precipitation_probability,cloud_cover,uv_index,weather_code',
            daily='temperature_2m_max,temperature_2m_min,weather_code',
            temperature_unit='fahrenheit' if fahrenheit else 'celsius',
            wind_speed_unit='mph' if fahrenheit else 'kmh',
            timezone='auto', timeformat='unixtime', forecast_days=5))
        data=json.loads(fetch('https://api.open-meteo.com/v1/forecast?'+query))
        value=dict(current=data['current'], daily=data['daily'], hourly=data['hourly'],
                   timezone=data['timezone'], updated=time.time(), stale=False)
        path.write_text(json.dumps(value))
        RESULTS.put(('weather', value))
    except Exception as exc:
        RESULTS.put(('weatherError', dict(message=str(exc)[:160])))

def air_quality(lat, lon):
    key=hashlib.sha256(f'{lat},{lon}'.encode()).hexdigest()[:16]
    path=CACHE/f'atmosphere-air-{key}.json'
    try:
        if path.exists():
            old=json.loads(path.read_text())
            RESULTS.put(('air',dict(old,stale=time.time()-old['updated']>3600)))
        query=urllib.parse.urlencode(dict(latitude=lat,longitude=lon,current='us_aqi',
                                         timezone='auto',timeformat='unixtime',forecast_days=1))
        data=json.loads(fetch('https://air-quality-api.open-meteo.com/v1/air-quality?'+query))
        value=dict(aqi=data['current'].get('us_aqi'),updated=time.time(),stale=False)
        path.write_text(json.dumps(value));RESULTS.put(('air',value))
    except Exception as exc:
        RESULTS.put(('airError',dict(message=str(exc)[:160])))

def artwork(url, key, page_url=""):
    try:
        path=CACHE/('art-hd-'+key)
        if not path.exists():
            if url.startswith('data:image/'):
                data=base64.b64decode(url.split(',',1)[1], validate=True)
                if len(data)>8_000_000: raise ValueError('Artwork too large')
            elif url.startswith('file://'):
                # MPRIS may provide a local thumbnail. Never read it into logs.
                data=Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).read_bytes()
                if len(data)>8_000_000: raise ValueError('Artwork too large')
            else:
                data=fetch(url)
            original_size=Image.open(io.BytesIO(data)).size
            parsed=urllib.parse.urlparse(page_url)
            video_id=urllib.parse.parse_qs(parsed.query).get('v',[''])[0]
            if parsed.hostname in ('youtube.com','www.youtube.com','music.youtube.com','youtu.be'):
                if parsed.hostname=='youtu.be':video_id=parsed.path.strip('/')
                if re.fullmatch(r'[A-Za-z0-9_-]{11}',video_id):
                    for quality in ('maxresdefault','sddefault','hqdefault'):
                        try:
                            candidate=fetch(f'https://i.ytimg.com/vi/{video_id}/{quality}.jpg')
                            size=Image.open(io.BytesIO(candidate)).size
                            if min(size)>max(120,min(original_size)):
                                data=candidate;break
                        except Exception:continue
            path.write_bytes(data)
        # Derive a quiet, saturated accent once per cover, off Cinnamon's UI thread.
        with Image.open(path) as im:
            im=im.convert('RGB');w,h=im.size;side=min(w,h)
            im=im.crop(((w-side)//2,(h-side)//2,(w+side)//2,(h+side)//2)).resize((32,32))
            pixels=[p for p in im.getdata() if max(p)-min(p)>25 and 35<max(p)<245]
            if pixels:
                weights=[(max(p)-min(p))/255 for p in pixels];total=sum(weights)
                accent=[round(sum(p[c]*v for p,v in zip(pixels,weights))/total/255,4) for c in range(3)]
            else:accent=[.22,.55,.75]
        RESULTS.put(('art', dict(key=key, path=str(path),accent=accent)))
    except Exception:
        pass

def main():
    lat=float(sys.argv[1]); lon=float(sys.argv[2]); fahrenheit=sys.argv[3]=='true'
    next_weather=0; next_discovery=0; next_media=0
    last_wall=time.time(); weather_worker=None; air_worker=None
    names=[]; identities={}; selected=None; preferred=None; attempted_art=set(); active_seen={}; last_status={}
    input_buffer=b''
    sel=selectors.DefaultSelector(); sel.register(sys.stdin, selectors.EVENT_READ)
    while True:
        now=time.monotonic()
        wall=time.time()
        if abs(wall-last_wall)>60: next_weather=0
        last_wall=wall
        if now>=next_weather:
            if weather_worker is None or not weather_worker.is_alive():
                weather_worker=threading.Thread(target=weather,args=(lat,lon,fahrenheit),daemon=True);weather_worker.start()
            if air_worker is None or not air_worker.is_alive():
                air_worker=threading.Thread(target=air_quality,args=(lat,lon),daemon=True);air_worker.start()
            next_weather=now+300
        if now>=next_discovery:
            try:
                all_names=call('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','ListNames')[0]
                names=[n for n in all_names if n.startswith('org.mpris.MediaPlayer2.')]
                for name in names:
                    if name not in identities:
                        try:
                            identities[name]=props(name,'org.mpris.MediaPlayer2').get('Identity',name)
                        except Exception:
                            # One disappearing/unresponsive player must not hide the others.
                            continue
                identities={n:v for n,v in identities.items() if n in all_names}
            except Exception:
                names=[]
            next_discovery=now+2
        if now>=next_media:
            sessions=[]
            for name in names:
                try:
                    p=props(name,PLAYER); m=p.get('Metadata',{}); status=p.get('PlaybackStatus','Stopped')
                    if status=='Playing' and last_status.get(name)!='Playing': active_seen[name]=now
                    last_status[name]=status
                    if status=='Stopped' or not m.get('xesam:title'): continue
                    url=m.get('xesam:url',''); identity=identities.get(name,name.removeprefix('org.mpris.MediaPlayer2.'))
                    source='YouTube Music' if 'music.youtube.' in url else 'YouTube' if 'youtube.' in url or 'youtu.be' in url else identity
                    sessions.append(dict(name=name, title=m.get('xesam:title',''),
                        artist=' · '.join(m.get('xesam:artist',[])), album=m.get('xesam:album',''),
                        artwork=m.get('mpris:artUrl',''), trackid=m.get('mpris:trackid',''),
                        source=source, browser=identity, pageUrl=url, status=status,
                        position=max(0,p.get('Position',0)/1e6), duration=max(0,m.get('mpris:length',0)/1e6),
                        canPlay=p.get('CanPlay',False),canPause=p.get('CanPause',False),
                        canNext=p.get('CanGoNext',False),canPrevious=p.get('CanGoPrevious',False),
                        canSeek=p.get('CanSeek',False), rate=p.get('Rate',1), sampled=time.time()))
                except Exception:
                    continue
            sessions.sort(key=lambda s:(s['status']=='Playing',active_seen.get(s['name'],0),s['name']==selected),reverse=True)
            media=next((s for s in sessions if s['name']==preferred),sessions[0] if sessions else None)
            selected=media['name'] if media else None
            if media:
                media['artKey']=hashlib.sha256((media['artwork']+'|'+media['title']+'|'+media['artist']).encode()).hexdigest()[:24]
            emit('media',media=media,sessions=[{k:s[k] for k in ('name','title','browser','source','status')} for s in sessions],preferred=preferred)
            if media and media['artwork'] and media['artKey'] not in attempted_art:
                attempted_art.add(media['artKey'])
                threading.Thread(target=artwork,args=(media['artwork'],media['artKey'],media['pageUrl']),daemon=True).start()
            next_media=now+1
        while not RESULTS.empty():
            kind,value=RESULTS.get_nowait(); emit(kind,**value)
            if kind=='weatherError': next_weather=min(next_weather,now+60)
        if sel.select(.1):
            chunk=os.read(sys.stdin.fileno(),65536)
            if not chunk: break
            input_buffer+=chunk
            while b'\n' in input_buffer:
                line,input_buffer=input_buffer.split(b'\n',1)
                try:
                    command=json.loads(line)
                    if command.get('action')=='refresh':
                        next_weather=0; next_discovery=0; next_media=0
                    elif command.get('action')=='select':
                        choice=command.get('fraction')
                        if not choice or choice in names: preferred=choice or None
                        next_media=0
                    elif selected and command.get('action') in ('PlayPause','Next','Previous'):
                        call(selected,PATH,PLAYER,command['action'])
                        next_media=0
                    elif selected and command.get('action')=='seek' and media and media['canSeek'] and media['duration']>0:
                        fraction=max(0,min(1,float(command['fraction'])))
                        call(selected,PATH,PLAYER,'SetPosition',GLib.Variant('(ox)',(media['trackid'],int(fraction*media['duration']*1e6))))
                        next_media=0
                except Exception as exc:
                    emit('mediaError',message=str(exc)[:160])

if __name__=='__main__':
    try: main()
    except (BrokenPipeError, KeyboardInterrupt): pass
