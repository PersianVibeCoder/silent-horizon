"""Run with dbus-run-session -- python3 tests/media-integration.py.
Uses real isolated MPRIS peers and the production bridge; no Spotify login needed.
"""
from gi.repository import Gio, GLib
from pathlib import Path
from PIL import Image
import tempfile, threading, subprocess, sys, os, json, queue, time
root=Path(__file__).resolve().parents[1]
bus=Gio.bus_get_sync(Gio.BusType.SESSION,None)
loop=GLib.MainLoop();threading.Thread(target=loop.run,daemon=True).start()
events=[]
def own(name,method='RequestName'):
 args=GLib.Variant('(su)',(name,0)) if method=='RequestName' else GLib.Variant('(s)',(name,))
 bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus',method,args,None,0,1000,None)
# A broken peer must not prevent discovery of healthy players.
own('org.mpris.MediaPlayer2.broken')
connections=[]
def player(name,identity,status,art):
 c=Gio.DBusConnection.new_for_address_sync(os.environ['DBUS_SESSION_BUS_ADDRESS'],Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT|Gio.DBusConnectionFlags.MESSAGE_BUS_CONNECTION,None,None);connections.append(c)
 values={'org.mpris.MediaPlayer2':{'Identity':GLib.Variant('s',identity)},'org.mpris.MediaPlayer2.Player':{'PlaybackStatus':GLib.Variant('s',status),'Metadata':GLib.Variant('a{sv}',{'xesam:title':GLib.Variant('s',identity+' track'),'xesam:artist':GLib.Variant('as',['Test artist']),'mpris:trackid':GLib.Variant('o','/track/test'),'mpris:length':GLib.Variant('x',180000000),'mpris:artUrl':GLib.Variant('s',art)}),'Position':GLib.Variant('x',1000000),'Rate':GLib.Variant('d',1.0),**{k:GLib.Variant('b',True) for k in ['CanPlay','CanPause','CanGoNext','CanGoPrevious','CanSeek']}}}
 xml='<node>'
 for interface,props in values.items():
  xml+='<interface name="'+interface+'">'+''.join('<property name="'+k+'" type="'+v.get_type_string()+'" access="read"/>' for k,v in props.items())
  if interface.endswith('.Player'):xml+=''.join('<method name="'+m+'"/>' for m in ['PlayPause','Next','Previous'])+'<method name="SetPosition"><arg type="o" direction="in"/><arg type="x" direction="in"/></method>'
  xml+='</interface>'
 xml+='</node>'
 def call(conn,sender,path,interface,method,params,inv):
  events.append((name,method,params.unpack()))
  if method=='PlayPause':values[interface]['PlaybackStatus']=GLib.Variant('s','Paused' if values[interface]['PlaybackStatus'].unpack()=='Playing' else 'Playing')
  inv.return_value(None)
 for info in Gio.DBusNodeInfo.new_for_xml(xml).interfaces:c.register_object('/org/mpris/MediaPlayer2',info,call,lambda conn,sender,path,interface,key:values[interface][key],None)
 c.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','RequestName',GLib.Variant('(su)',(name,0)),None,0,1000,None)
 return c
with tempfile.TemporaryDirectory() as td:
 art=Path(td)/'cover.png';Image.new('RGB',(32,32),(40,130,210)).save(art)
 browser=player('org.mpris.MediaPlayer2.firefox.test','Firefox','Paused',art.as_uri())
 spotify=player('org.mpris.MediaPlayer2.spotify','Spotify','Playing',art.as_uri())
 service=root/'desklets/silent-horizon@alborz/quiet-service.py'
 code="import runpy,sys; m=runpy.run_path(sys.argv[1]); m['main'].__globals__.update(weather=lambda *a:None,air_quality=lambda *a:None); sys.argv=['bridge','0','0','true']; m['main']()"
 proc=subprocess.Popen([sys.executable,'-c',code,str(service)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=dict(os.environ,XDG_CACHE_HOME=td))
 lines=queue.Queue()
 def reader():
  for line in proc.stdout:
   try:lines.put(json.loads(line))
   except ValueError:pass
 threading.Thread(target=reader,daemon=True).start()
 def wait(predicate):
  end=time.monotonic()+12
  while time.monotonic()<end:
   try:value=lines.get(timeout=.5)
   except queue.Empty:continue
   if predicate(value):return value
  raise AssertionError('Timed out waiting for media state')
 def command(action,**extra):proc.stdin.write(json.dumps(dict(action=action,**extra))+'\n');proc.stdin.flush()
 def media(v):return v.get('kind')=='media' and v.get('media')
 try:
  v=wait(lambda v:media(v) and v['media']['source']=='Spotify');assert len(v['sessions'])==2
  wait(lambda v:v.get('kind')=='art' and Path(v['path']).is_file())
  command('PlayPause');wait(lambda v:media(v) and v['media']['source']=='Spotify' and v['media']['status']=='Paused')
  proc.stdin.write(''.join(json.dumps(v)+'\n' for v in [{'action':'Next'},{'action':'Previous'},{'action':'seek','fraction':.5}]))
  proc.stdin.flush()
  wait(lambda v:media(v) and any(e[1]=='SetPosition' for e in events))
  assert all(any(e[0]=='org.mpris.MediaPlayer2.spotify' and e[1]==m for e in events) for m in ['PlayPause','Next','Previous','SetPosition'])
  assert next(e[2][1] for e in events if e[1]=='SetPosition')==90000000
  command('select',fraction='org.mpris.MediaPlayer2.firefox.test');wait(lambda v:media(v) and v['media']['source']=='Firefox')
  command('select',fraction='org.mpris.MediaPlayer2.spotify');wait(lambda v:media(v) and v['media']['source']=='Spotify')
  spotify.close_sync(None);wait(lambda v:media(v) and v['media']['source']=='Firefox')
  spotify=player('org.mpris.MediaPlayer2.spotify.instance42','Spotify','Playing',art.as_uri())
  command('select',fraction=None);wait(lambda v:media(v) and v['media']['name'].endswith('instance42'))
  spotify.close_sync(None);browser.close_sync(None)
  wait(lambda v:v.get('kind')=='media' and v['media'] is None)
  print('PASS: native Spotify and instance names, browser coexistence, broken peer, artwork, pause/next/previous/seek, selection, close/reopen, empty state')
 finally:
  proc.stdin.close()
  try:proc.wait(timeout=5)
  except subprocess.TimeoutExpired:proc.kill();proc.wait()
  loop.quit()
