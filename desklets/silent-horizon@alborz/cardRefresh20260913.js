const Base=imports.quietHorizonPolish20260911;
const Cairo=imports.cairo, {GLib,Gio,GdkPixbuf}=imports.gi;
var St,Clutter,Main,Mainloop,PopupMenu;
imports.gi.versions.Gdk='3.0';const Gdk=imports.gi.Gdk;
const Data=imports.quietHorizonData20260911;
const {text,line,circle,round,color,pin,softWeather,weatherName,sun}=Base;
const WHITE=[.96,.95,.91],MUTED=[.57,.68,.81],CYAN=[.27,.9,1],TAU=2*Math.PI;
var PAD=48;
var wrap=v=>((v%360)+360)%360;
var delta=(a,b)=>wrap(a-b+180)-180;
var bearing=v=>['N','NE','E','SE','S','SW','W','NW'][Math.round(wrap(v)/45)%8];
var layout=s=>{const weather=354,horizon=weather+72-82,card=s.weatherExpanded===false?44:horizon+318,system=card+16;return {weather,horizon,card,system,height:system+(s.systemExpanded?204:44)+PAD*2};};
var skyX=(s,az)=>16+wrap(az)*.8;
var project=s=>(s.bodies||[]).filter(b=>Number.isFinite(b.azimuth)&&Number.isFinite(b.altitude)&&b.altitude>0).map(b=>({...b,x:skyX(s,b.azimuth),y:174-b.altitude/90*64}));
function chevron(cr,x,y,open){const sign=open?-1:1;line(cr,x-4,y-sign*2,x,y+sign*2,MUTED,.95,1);line(cr,x,y+sign*2,x+4,y-sign*2,MUTED,.95,1);}
var Renderer=class Renderer extends Base.Renderer {
 draw(cr,scale,s){cr.save();cr.scale(scale,scale);cr.setLineCap(Cairo.LineCap.ROUND);cr.translate(PAD,PAD);this.dashboard(cr,s,scale);cr.restore();}
 glass(cr,s,scale,height){
  const spec=s.backdrop,key=JSON.stringify([spec,scale,height]);
  if(!this._glass||this._glassKey!==key){this._glassKey=key;let backdrop=null;if(spec?.path){try{if(this._backdropPath!==spec.path){this._backdropPixbuf=GdkPixbuf.Pixbuf.new_from_file(spec.path);this._backdropPath=spec.path;}backdrop={...spec,pixbuf:this._backdropPixbuf};}catch(e){}}
   this._glass=new Cairo.ImageSurface(Cairo.Format.ARGB32,Math.ceil((320+PAD*2)*scale),Math.ceil((height+PAD*2)*scale));const c=new Cairo.Context(this._glass);c.scale(scale,scale);c.translate(PAD,PAD);Base.panel(c,320,height,backdrop,scale);c.$dispose();
  }
  cr.save();cr.scale(1/scale,1/scale);cr.setSourceSurface(this._glass,-PAD*scale,-PAD*scale);cr.paint();cr.restore();
 }

 dashboard(cr,s,scale){
  const l=layout(s);this.glass(cr,s,scale,l.card);cr.save();round(cr,1.5,1.5,317,l.card-3,19);cr.clip();
  text(cr,'↻',261,22,16,MUTED,0,'Inter Regular',0,'center');
  if(s.weatherExpanded===false){softWeather(cr,29,22,s.weather?.current?.weather_code??0,!!s.isDay,.20);text(cr,'Weather',51,22,11,WHITE);}chevron(cr,293,22,s.weatherExpanded!==false);
  if(s.weatherExpanded!==false){cr.save();this.weather(cr,s,scale);cr.restore();
  this.events(cr,s,l.weather,scale);
  cr.save();cr.translate(0,l.horizon);this.horizonCard(cr,s,scale);cr.restore();}
  else text(cr,s.weather?.current?Math.round(s.weather.current.temperature_2m)+'°'+(s.fahrenheit?'F':'C'):'—',239,22,11,MUTED,0,'Inter Regular',0,'right');
  cr.restore();cr.save();cr.translate(0,l.system-566);this.systemCard(cr,s,scale);cr.restore();
 }
 events(cr,s,y,scale){
  line(cr,24,y,296,y,MUTED,.18,.6);
  const items=s.solarEvents?.items||[];
  items.slice(0,3).forEach((p,i)=>{const x=54+i*70;eventIcon(cr,x,y+26,p.kind);text(cr,p.name,x,y+43,9.5,i===0?[.74,.83,.92]:MUTED,0,i===0?'Inter Medium':'Inter Regular',0,'center');text(cr,eventTime(p.time),x,y+59,10.5,WHITE,0,i===0?'Inter Medium':'Inter Regular',0,'center');});
  const moon=s.eventMoon||s.moonTonight||s.moon;this.moon(cr,moon,252,y+15,23,scale);text(cr,'Moon',264,y+43,9.5,MUTED,0,'Inter Regular',0,'center');text(cr,moon?(moon.fraction*100).toFixed(1)+'%':'—',264,y+59,10.5,WHITE,0,'Inter Regular',0,'center');
 }
 systemCard(cr,s,scale){
        const h=s.systemExpanded?204:44;
        if(!this._systemGlass||this._systemGlassKey!==h+':'+scale){
            this._systemGlassKey=h+':'+scale;this._systemGlass=new Cairo.ImageSurface(Cairo.Format.ARGB32,Math.ceil((320+PAD*2)*scale),Math.ceil((h+PAD*2)*scale));
            const c=new Cairo.Context(this._systemGlass);c.scale(scale,scale);c.translate(PAD,PAD);round(c,1,1,318,h-2,20);color(c,[.015,.025,.045],.78);c.fill();Base.panel(c,320,h,null,scale);c.$dispose();
        }
        cr.save();cr.translate(0,566);cr.save();cr.scale(1/scale,1/scale);cr.setSourceSurface(this._systemGlass,-PAD*scale,-PAD*scale);cr.paint();cr.restore();
        imports.performanceIcons20260911.draw(cr,'PERFORMANCE',29,22,19);text(cr,'System',51,22,11,WHITE);
        const sign=s.systemExpanded?-1:1;line(cr,289,21-sign*2,293,21+sign*2,MUTED,.95,1);line(cr,293,21+sign*2,297,21-sign*2,MUTED,.95,1);
        if(!s.systemExpanded){cr.restore();return;}
        const d=s.systemData,percent=n=>Data.valid(n)?Math.round(n)+'%':'—';
        const icons=imports.performanceIcons20260911;
        const metrics=[['CPU','CPU',d&&d.cpu],['GPU','GPU',d&&d.gpu],['RAM','MEMORY',d&&d.memory]];
        metrics.forEach(([name,icon,v],i)=>{const x=58+i*102;icons.draw(cr,icon,x,59,24);text(cr,name,x,83,9,MUTED,0,'Inter Regular',0,'center');text(cr,percent(v&&v.usage),x,101,16,WHITE,0,'Inter Regular',0,'center');text(cr,v?(name==='RAM'?(v.used/2**30).toFixed(1)+' / '+(v.total/2**30).toFixed(1)+' GiB':Data.valid(v.temp)?Math.round(v.temp)+'°C':'—'):'Reading…',x,119,9,MUTED,0,'Inter Regular',0,'center');});
        line(cr,23,133,297,133,MUTED,.14,.6);
        const disk=d&&d.disks&&d.disks[s.systemDisk||0],net=d&&d.network,bat=d&&d.battery;
        icons.draw(cr,'STORAGE',29,153,19);text(cr,'Storage',47,146,9,MUTED);text(cr,disk?(disk.used/2**30).toFixed(0)+' / '+(disk.total/2**30).toFixed(0)+' GiB':'—',47,162,10,WHITE);
        icons.draw(cr,'BATTERY',197,153,19);text(cr,'Battery',215,146,9,MUTED);text(cr,bat?percent(bat.percent)+' · '+bat.status:'—',215,162,10,WHITE,0,'Inter Regular',80);
        const rate=n=>n>=1024**2?(n/1024**2).toFixed(1)+' MiB/s':n>=1024?(n/1024).toFixed(1)+' KiB/s':Math.round(n)+' B/s';
        icons.draw(cr,'NETWORK',29,186,17);text(cr,net?'↓ '+rate(net.down)+'   ↑ '+rate(net.up):'Reading network…',47,186,9,MUTED,0,'Inter Regular',189);
        text(cr,'Details ›',297,186,9,MUTED,0,'Inter Regular',0,'right');
        cr.restore();
    }
 weather(cr,s,scale){


        const val=(n,suffix='')=>Data.valid(n)?Math.round(n)+suffix:'—';
        const w=s.weather,c=w&&w.current;
        const today=w&&w.daily?w.daily.time.findIndex(t=>new Date(t*1000).toDateString()===new Date().toDateString()):-1;
        pin(cr,105,32);text(cr,s.city,117,32,12,WHITE,0,'Inter Medium',177);
        text(cr,c?weatherName(c.weather_code,s.isDay):'Loading…',101,53,11,MUTED,.35,'Inter Regular',196);
        softWeather(cr,53,76,c?c.weather_code:null,s.isDay?1:0,.90,c?(c.wind_speed_10m||0)*(s.fahrenheit?1.609344:1):0);
        text(cr,c?val(c.temperature_2m,'°')+(s.fahrenheit?'F':'C'):'—',101,90,33,WHITE,-.8,'Inter Medium');
        text(cr,w&&today>=0?'H '+val(w.daily.temperature_2m_max[today],'°')+'  L '+val(w.daily.temperature_2m_min[today],'°'):'—',296,83,10,MUTED,0,'Inter Regular',0,'right');
        text(cr,'Feels like '+val(c&&c.apparent_temperature,'°'),296,103,10,MUTED,0,'Inter Regular',0,'right');
        const forecast=s.forecast,points=forecast&&forecast.points||[];
        cr.save();cr.translate(0,-144);
        const aq=s.air&&s.air.aqi,uv=forecast&&forecast.uv;
        const uvName=!Data.valid(uv)?'Unavailable':uv<3?'Low':uv<6?'Moderate':uv<8?'High':uv<11?'Very high':'Extreme';
        line(cr,24,272,296,272,MUTED,.16,.6);
        line(cr,113,282,113,312,MUTED,.23,.6);line(cr,213,282,213,312,MUTED,.23,.6);
        // Leaf, small sun and water drop: three equal-status weather readings.
        cr.save();cr.translate(34,296);cr.newPath();cr.moveTo(-7,5);cr.curveTo(-9,-4,-2,-7,8,-8);cr.curveTo(8,1,1,8,-7,5);color(cr,[.55,.76,.36]);cr.fill();line(cr,-8,9,4,-3,[.70,.86,.48],.85,.8);cr.restore();
        text(cr,'AQI '+val(aq),51,288,10.5,WHITE);
        const airName=Data.aqiLabel(aq).toLowerCase();text(cr,airName[0].toUpperCase()+airName.slice(1),51,306,10,MUTED,0,'Inter Regular',60);
        cr.save();cr.translate(133,296);cr.scale(.28,.28);sun(cr,0,0,16);cr.restore();
        text(cr,'UV '+(Data.valid(uv)?uv.toFixed(1):'—'),150,288,10.5,WHITE);
        text(cr,uvName,150,306,10,MUTED,0,'Inter Regular',60);
        cr.save();cr.translate(233,296);cr.newPath();cr.moveTo(0,-8);cr.curveTo(-2,-3,-6,1,-6,4);cr.curveTo(-6,12,6,12,6,4);cr.curveTo(6,1,2,-3,0,-8);color(cr,CYAN,.85);cr.fill();cr.restore();
        text(cr,'Humidity',250,288,9.5,MUTED);
        text(cr,c?val(c.relative_humidity_2m,'%'):'—',250,306,11,WHITE);
        cr.restore();
        line(cr,24,183,296,183,MUTED,.18,.6);
        const hours=points.slice(1,4),hourly=w&&w.hourly;
        hours.forEach((p,i)=>{const x=57+i*103,idx=hourly?hourly.time.findIndex(t=>t>=p.epoch):-1,code=idx>=0&&hourly.weather_code?hourly.weather_code[idx]:null;
            text(cr,p.label,x,204,10,MUTED,0,'Inter Regular',0,'center');
            const date=new Date(p.epoch*1000),o=new imports.vendor.astronomy.Astronomy.Observer(s.latitude ?? 0,s.longitude ?? 0,s.elevation ?? 0);
            const A=imports.vendor.astronomy.Astronomy,e=A.Equator('Sun',date,o,true,true),day=A.Horizon(date,o,e.ra,e.dec,'normal').altitude>0;
            softWeather(cr,x,226,code,day,.29);text(cr,val(p.value,'°'),x,250,13,WHITE,0,'Inter Regular',0,'center');
        });
        line(cr,24,270,296,270,MUTED,.16,.6);
        for(let j=0;j<5;j++){
            const k=Math.max(0,today)+j,d=w&&w.daily,x=39+j*61;
            text(cr,d&&d.time[k]?new Date(d.time[k]*1000).toLocaleDateString('en-US',{weekday:'short'}):'—',x,289,10,MUTED,0,'Inter Regular',0,'center');
            softWeather(cr,x,312,d&&d.weather_code?d.weather_code[k]:null,1,.27);
            text(cr,d?val(d.temperature_2m_max[k],'°')+'/'+val(d.temperature_2m_min[k],'°'):'—',x,336,10,WHITE,0,'Inter Regular',0,'center');
        }

 }
 horizonCard(cr,s,scale){
  // Reuse the installed glass material and scenic assets; typography stays Inter.

  cr.save();cr.rectangle(1.5,82,317,236);cr.clip();
  const alt=s.sunAltitude??-18;let a,b,t;
  if(alt>=6){a=b='day';t=0;}else if(alt>=-4){a='twilight';b='day';t=(alt+4)/10;}else if(alt>=-14){a='night';b='twilight';t=(alt+14)/10;}else {a=b='night';t=0;}
  if(!this._rightImages)this._rightImages={};
  const image=(kind,opacity)=>{if(!this._rightImages[kind]){const p=GdkPixbuf.Pixbuf.new_from_file(this.path+'/assets/horizon-'+kind+'.png'),surface=new Cairo.ImageSurface(Cairo.Format.ARGB32,960,558),ic=new Cairo.Context(surface);ic.scale(960/p.width,558/p.height);Gdk.cairo_set_source_pixbuf(ic,p,0,0);ic.paint();ic.$dispose();this._rightImages[kind]=surface;}cr.save();cr.translate(0,48);cr.scale(1/3,1/3);cr.setSourceSurface(this._rightImages[kind],0,0);const fade=new Cairo.LinearGradient(0,102,0,288);fade.addColorStopRGBA(0,1,1,1,0);fade.addColorStopRGBA(1,1,1,1,opacity);cr.mask(fade);cr.restore();};
  image(a,1);if(a!==b)image(b,t);
  let foot=new Cairo.LinearGradient(0,190,0,238);foot.addColorStopRGBA(0,.014,.025,.04,0);foot.addColorStopRGBA(1,.014,.025,.04,.96);cr.setSource(foot);cr.rectangle(0,190,320,128);cr.fill();cr.restore();
  const bodies=project(s);
  cr.save();cr.rectangle(8,82,304,124);cr.clip();
  for(const p of bodies){this.planet(cr,p.name,p.x,p.y,p.magnitude);if(p.name===s.skySelected){
   cr.newPath();cr.arc(p.x,p.y,7.5,0,TAU);color(cr,WHITE,.9);cr.setLineWidth(.85);cr.stroke();
   if(s.skyMotion&&Number.isFinite(p.nextAzimuth)){
    const dx=delta(p.nextAzimuth,p.azimuth)*.8,dy=-(p.nextAltitude-p.altitude)/90*64,mag=Math.hypot(dx,dy);
    if(mag>.01){const ux=dx/mag,uy=dy/mag,len=Math.max(15,Math.min(28,mag)),x=p.x+ux*(10+len),y=p.y+uy*(10+len);line(cr,p.x+ux*10,p.y+uy*10,x,y,WHITE,.7,.85);line(cr,x,y,x-ux*4-uy*2.5,y-uy*4+ux*2.5,WHITE,.7,.85);line(cr,x,y,x-ux*4+uy*2.5,y-uy*4-ux*2.5,WHITE,.7,.85);}
   }
  }}
  cr.restore();
  // The bearing strip provides orientation without a second compass overlay.
  for(let az=0;az<=360;az+=15){const x=16+az*.8;line(cr,x,211,x,216,MUTED,.65,.7);}
  for(let az=0;az<=360;az+=90)text(cr,bearing(az),16+az*.8,225,10,MUTED,0,'Inter Regular',0,'center');
  line(cr,1,238,319,238,MUTED,.27,.6);
  text(cr,'ABOVE HORIZON',20,253,8.5,MUTED,1,'Inter Medium');
  if(!bodies.length)text(cr,'No objects above the horizon',20,279,10,MUTED);
  bodies.forEach((p,i)=>{const x=20+(i%4)*74,y=273+Math.floor(i/4)*17;cr.newPath();cr.arc(x+4,y,3.5,0,TAU);color(cr,p.name===s.skySelected?CYAN:WHITE,.85);cr.setLineWidth(.8);cr.stroke();if(p.name===s.skySelected)circle(cr,x+4,y,1.7,CYAN);text(cr,p.name,x+13,y,9.5,p.name===s.skySelected?WHITE:MUTED,0,'Inter Regular',58);});
  const selected=bodies.find(p=>p.name===s.skySelected);

 }
};

function readPrefs(a){try{const [ok,data]=GLib.file_get_contents(a._rightPrefs);if(ok)return JSON.parse(imports.byteArray.toString(data));}catch(e){}return {};}
function savePrefs(a){if(a._rightSave)Mainloop.source_remove(a._rightSave);a._rightSave=Mainloop.timeout_add(350,()=>{a._rightSave=0;try{GLib.file_set_contents(a._rightPrefs,JSON.stringify({weatherExpanded:a._state.weatherExpanded,skyMotion:a._state.skyMotion}));}catch(e){global.logError(e);}return false;});}
var install=function(a){
 if(a.role!=='dashboard'||a._effectsRepaired)return;
 a._connectedInstalled=true;a._effectsRepaired=true;
 St=imports.gi.St;Clutter=imports.gi.Clutter;Main=imports.ui.main;Mainloop=imports.mainloop;PopupMenu=imports.ui.popupMenu;
 a._rightInstalled=true;a._rightPrefs=GLib.get_user_config_dir()+'/cinnamon/right-cards-'+a._id+'.json';
 const prefs=readPrefs(a);Object.assign(a._state,{weatherExpanded:prefs.weatherExpanded!==false,skyMotion:!!prefs.skyMotion,skySelected:null});
 a._renderer=new Renderer(a._path);a._edge.hide();if(a._edgeTimer){Mainloop.source_remove(a._edgeTimer);a._edgeTimer=0;}
 a._rightLayout=function(){const l=layout(this._state);this._root.remove_all_transitions();this._root.set_clip_to_allocation(false);this._root.set_size(Math.ceil((320+PAD*2)*this.scale),Math.ceil(l.height*this.scale));this._area.set_size(Math.ceil((320+PAD*2)*this.scale),Math.ceil(l.height*this.scale));this._edge.hide();this._buildButtons();if(this._glassOverlay){this._glassOverlay.set_size(this._area.width,this._area.height);this._root.set_child_above_sibling(this._glassOverlay,null);this._glassOverlay.queue_repaint();}this._area.queue_repaint();};
 a._refreshCard=function(){
  if(this._disposed)return;
  const now=GLib.get_monotonic_time();
  if(this._refreshRequestedAt && now-this._refreshRequestedAt<1000000)return;
  this._refreshRequestedAt=now;
  this._lastMinute=null;this._rightMinute=null;this._forecastKey=null;this._skyKey=null;this._lastPaintKey=null;
  if(this._process){
   const proc=this._process,bytes=imports.byteArray.fromString(JSON.stringify({action:'refresh'})+'\n');
   try{proc.get_stdin_pipe().write_all_async(bytes,GLib.PRIORITY_DEFAULT,null,(stream,result)=>{
    try{stream.write_all_finish(result);}catch(e){
     if(!this._disposed&&this._process===proc){this._stopService();this._startService();}
    }
   });}catch(e){this._stopService();this._startService();}
  }else this._startService();
  if(this._state.systemExpanded){this._stopSystem();this._startSystem();}
  this._tick();this._area.queue_repaint();
 };
 a._rightSelect=function(name){this._state.skySelected=this._state.skySelected===name?null:name;this._rightUpdateButtons();this._area.queue_repaint();};
 a._toggleWeather=function(){this._state.weatherExpanded=!this._state.weatherExpanded;if(this._detailMenu){this._detailMenu.destroy();this._detailMenu=null;}this._rightLayout();savePrefs(this);};
 a._toggleSystem=function(){this._state.systemExpanded=!this._state.systemExpanded;this._rightLayout();if(this._state.systemExpanded)this._startSystem();else this._stopSystem();};
 a._rightUpdateButtons=function(){
  const bodies=project(this._state),l=layout(this._state);
  if(!this._planetButtons||!this._skyScene)return;
  this._planetButtons.forEach((b,i)=>{const p=bodies[i];b.visible=!!p;if(p){b._planet=p.name;b.accessible_name=(p.name===this._state.skySelected?'Selected: ':'Select ')+p.name+', '+p.altitude.toFixed(1)+' degrees above horizon';}});
  this._skyScene.accessible_name='All solar-system objects above the horizon. Click an object to select.';
 };
 a._buildButtons=function(){
  if(this._skyDragSignal){global.stage.disconnect(this._skyDragSignal);this._skyDragSignal=0;}
  for(const b of this._buttons){if(Main.layoutManager.isTrackingChrome(b))Main.layoutManager.untrackChrome(b);b.destroy();}this._buttons=[];this._planetButtons=[];this._skyScene=null;
  const l=layout(this._state),add=(x,y,w,h,label,fn)=>{const b=new St.Button({reactive:true,can_focus:true,accessible_name:label,style:'background:transparent;border:none;padding:0;border-radius:8px;'});b.set_position((x+PAD)*this.scale,(y+PAD)*this.scale);b.set_size(w*this.scale,h*this.scale);b.connect('clicked',()=>fn(b));b.connect('key-focus-in',()=>b.set_style('background:rgba(111,191,230,0.1);border:1px solid rgba(132,212,244,0.6);padding:0;border-radius:8px;'));b.connect('key-focus-out',()=>b.set_style('background:transparent;border:none;padding:0;border-radius:8px;'));this._root.add_child(b);this._buttons.push(b);return b;};
  add(277,4,32,34,this._state.weatherExpanded?'Collapse Weather':'Expand Weather',()=>this._toggleWeather());
  if(!this._state.weatherExpanded)add(0,0,245,44,'Expand Weather',()=>this._toggleWeather());
  const refresh=add(247,5,28,33,'Refresh weather, air quality, Sun, Moon and planets',()=>this._refreshCard());
  new imports.ui.tooltips.Tooltip(refresh,'Refresh all · updates also run automatically');
  if(this._state.weatherExpanded){add(16,116,288,223,'Weather details',b=>this._showDetails('weather',b));
  add(16,l.weather+2,288,64,'Sun times and Moon details',b=>this._solarDetails(b));
  const scene=new St.Widget({reactive:true,can_focus:true});this._skyScene=scene;scene.set_position((PAD+8)*this.scale,(l.horizon+82+PAD)*this.scale);scene.set_size(304*this.scale,154*this.scale);this._root.add_child(scene);this._buttons.push(scene);
  scene.connect('key-press-event',(_actor,e)=>{if(e.get_key_symbol()===Clutter.KEY_Escape){this._rightSelect(null);return Clutter.EVENT_STOP;}return Clutter.EVENT_PROPAGATE;});
  scene.connect('button-press-event',(_actor,e)=>{
   if(e.get_button()!==1)return Clutter.EVENT_PROPAGATE;scene.grab_key_focus();const [sx,sy]=e.get_coords();let moved=false;
   if(this._skyDragSignal)global.stage.disconnect(this._skyDragSignal);
   this._skyDragSignal=global.stage.connect('captured-event',(_stage,event)=>{
    if(event.type()===Clutter.EventType.MOTION){const [x,y]=event.get_coords();if(Math.hypot(x-sx,y-sy)>4)moved=true;return Clutter.EVENT_STOP;}
    if(event.type()===Clutter.EventType.BUTTON_RELEASE){global.stage.disconnect(this._skyDragSignal);this._skyDragSignal=0;
     if(!moved){const [ax,ay]=this.actor.get_position(),x=(sx-ax)/this.scale-PAD,y=(sy-ay)/this.scale-PAD-l.horizon;const hit=project(this._state).map(p=>({...p,d:Math.hypot(p.x-x,p.y-y)})).sort((p,q)=>p.d-q.d)[0];this._rightSelect(hit&&hit.d<=13?hit.name:null);}else{if(!project(this._state).some(p=>p.name===this._state.skySelected))this._state.skySelected=null;savePrefs(this);}
     this._area.queue_repaint();return Clutter.EVENT_STOP;}return Clutter.EVENT_PROPAGATE;
   });return Clutter.EVENT_STOP;
  });
  for(let i=0;i<9;i++)this._planetButtons.push(add(16+(i%4)*74,l.horizon+264+Math.floor(i/4)*17,74,17,'Select planet',b=>this._rightSelect(b._planet)));
  }
  add(0,l.system,320,44,'Expand or collapse System',()=>this._toggleSystem());
  if(this._state.systemExpanded){add(248,l.system+171,56,30,'System details',b=>this._showDetails('system',b));add(18,l.system+138,162,30,'Change storage drive',()=>{const ds=this._state.systemData?.disks||[];if(ds.length){this._state.systemDisk=((this._state.systemDisk||0)+1)%ds.length;this._area.queue_repaint();}});}
  this._rightUpdateButtons();
 };
 const changed=a._changed;a._changed=function(){changed.call(this);this._rightLayout();};
 const align=a._align;a._align=function(){align.call(this);if(this.placement!=='free'){const [x,y]=this.actor.get_position();this.actor.set_position(x-(PAD-12)*this.scale,y-(PAD-12)*this.scale);}};
 const [oldX,oldY]=a.actor.get_position();a.actor.set_position(oldX-(PAD-12)*a.scale,oldY-(PAD-12)*a.scale);
 const tick=a._tick;a._tick=function(){tick.call(this);if(this._state.backdrop){this._state.backdrop.x+=(PAD-12)*this.scale;this._state.backdrop.y+=(PAD-12)*this.scale;}if(this._rightMinute!==this._lastMinute){this._rightMinute=this._lastMinute;this._state.solarEvents=solarEvents(this.A,new Date(),this.latitude,this.longitude,this.elevation);this._state.eventMoon=this.Sky.calculate(new Date(this._state.solarEvents.moonEpoch*1000),this.latitude,this.longitude,this.elevation,'local-up');const now=new Date(Date.now()+15*60000),o=new this.A.Observer(this.latitude,this.longitude,this.elevation);for(const b of this._state.bodies||[]){const e=this.A.Equator(b.name,now,o,true,true),h=this.A.Horizon(now,o,e.ra,e.dec,'normal');b.nextAzimuth=h.azimuth;b.nextAltitude=h.altitude;}if(!project(this._state).some(p=>p.name===this._state.skySelected))this._state.skySelected=null;this._rightUpdateButtons();this._area.queue_repaint();}};
 const dispose=a._dispose;a._dispose=function(){if(this._rimTimer){Mainloop.source_remove(this._rimTimer);this._rimTimer=0;}if(this._skyDragSignal){global.stage.disconnect(this._skyDragSignal);this._skyDragSignal=0;}if(this._rightSave){Mainloop.source_remove(this._rightSave);this._rightSave=0;}dispose.call(this);};
 const motion=new PopupMenu.PopupSwitchMenuItem('Selected planet: show motion direction',a._state.skyMotion);motion.connect('toggled',(_item,value)=>{a._state.skyMotion=value;a._area.queue_repaint();savePrefs(a);});a._menu.addMenuItem(motion);
 const info=new PopupMenu.PopupMenuItem('Live sky positions · illustrative landscape');info.connect('activate',()=>a._showDetails('sky',a._skyScene||a._buttons[0]));a._menu.addMenuItem(info);
 a._solarDetails=function(anchor){
  if(this._detailMenu){this._detailMenu.destroy();this._detailMenu=null;}
  const menu=new PopupMenu.PopupMenu(anchor,St.Side.RIGHT);this._detailMenu=menu;Main.uiGroup.add_child(menu.actor);menu.actor.hide();if(!this._detailManager)this._detailManager=new PopupMenu.PopupMenuManager(this);this._detailManager.addMenu(menu);
  const e=this._state.solarEvents||{},row=t=>menu.addMenuItem(new PopupMenu.PopupMenuItem(t,{reactive:false}));
  const fmt=t=>t?new Date(t*1000).toLocaleDateString('en-US',{weekday:'short'})+' · '+Data.hourLabel(t):'Unavailable';
  row('SUN & MOON · '+this.city);for(const event of e.items||[])row(event.name+': '+fmt(event.time));row('Dark / Dawn: Sun 18° below the horizon');row('Moon phase: '+fmt(e.moonEpoch));menu.open();
 };
 a._glassOverlay=new St.DrawingArea({reactive:false});a._root.add_child(a._glassOverlay);a._glassOverlay.connect('repaint',area=>{const c=area.get_context();try{c.scale(a.scale,a.scale);c.translate(PAD,PAD);const l=layout(a._state),phase=(GLib.get_monotonic_time()/1e6/48)%1;rim(c,320,l.card);edge(c,l.card,phase);c.translate(0,l.system);rim(c,320,a._state.systemExpanded?204:44);edge(c,a._state.systemExpanded?204:44,(phase+.35)%1);}finally{c.$dispose();}});
 a._rimTimer=Mainloop.timeout_add(100,()=>{if(a._disposed)return false;if(a.actor.mapped){a._glassOverlay.queue_repaint();a._rimFrames=(a._rimFrames||0)+1;}return true;});
 a._rightMinute=null;
 installEventButtons(a);
 a._rightLayout();a._tick();
};

var solarEvents=function(A,now,lat,lon,elevation){
 const o=new A.Observer(lat,lon,elevation),start=new Date(now.getTime()+1000);
 const epoch=t=>t?t.date.getTime()/1000:null;
 const sunrise=epoch(A.SearchRiseSet('Sun',o,1,start,2)),sunset=epoch(A.SearchRiseSet('Sun',o,-1,start,2)),dark=epoch(A.SearchAltitude('Sun',o,-1,start,2,-18)),dawn=epoch(A.SearchAltitude('Sun',o,1,start,2,-18));
 const items=[{name:'Sunrise',kind:'rise',time:sunrise},{name:'Sunset',kind:'set',time:sunset},{name:'Dark',kind:'dark',time:dark},{name:'Dawn',kind:'dawn',time:dawn}].filter(e=>e.time!==null).sort((a,b)=>a.time-b.time).slice(0,3);
 const e=A.Equator('Sun',now,o,true,true),alt=A.Horizon(now,o,e.ra,e.dec,'normal').altitude;
 return {items,sunrise,sunset,dark,dawn,moonEpoch:alt<0?now.getTime()/1000:(dark||sunset||now.getTime()/1000)+3600};
};
function eventTime(epoch){return Data.hourLabel(Math.round(epoch/60)*60);}
function eventIcon(cr,x,y,kind){
 if(kind==='rise'||kind==='set'){
  const morning=kind==='rise',haloColor=morning?[.55,.80,1]:[1,.57,.18];
  const halo=new Cairo.RadialGradient(x,y,0,x,y,13);halo.addColorStopRGBA(0,...haloColor,.32);halo.addColorStopRGBA(.45,...haloColor,.12);halo.addColorStopRGBA(1,...haloColor,0);cr.setSource(halo);cr.rectangle(x-13,y-13,26,26);cr.fill();
  const cy=y+(morning?-1:2),r=5.4;
  cr.save();cr.rectangle(x-8,y-9,16,12);cr.clip();const disk=new Cairo.RadialGradient(x-1,cy-2,0,x,cy,r);
  disk.addColorStopRGB(0,...(morning?[1,1,.96]:[1,.96,.63]));disk.addColorStopRGB(.6,...(morning?[1,.96,.73]:[1,.77,.28]));disk.addColorStopRGB(1,...(morning?[.91,.84,.60]:[1,.43,.13]));cr.setSource(disk);cr.arc(x,cy,r,0,TAU);cr.fill();cr.restore();
  const horizon=morning?[.65,.83,1]:[1,.73,.39];line(cr,x-8,y+3,x+8,y+3,horizon,.82,.85);line(cr,x-5,y+5.5,x+5,y+5.5,horizon,.32,.7);
 }else{
  const glow=new Cairo.RadialGradient(x,y,0,x,y,11);glow.addColorStopRGBA(0,.5,.75,1,.24);glow.addColorStopRGBA(1,.5,.75,1,0);cr.setSource(glow);cr.rectangle(x-11,y-11,22,22);cr.fill();
  if(kind==='dawn'){cr.newPath();cr.arc(x,y+3,4,Math.PI,TAU);color(cr,[.68,.82,1]);cr.setLineWidth(1.2);cr.stroke();line(cr,x-7,y+4,x+7,y+4,[.68,.82,1],.8,.7);}
  else {circle(cr,x-1,y,5,[.68,.82,1],.85);circle(cr,x+2,y-2,4.8,[.03,.045,.07]);circle(cr,x+5,y-5,.9,WHITE,.9);}
 }
}
function rim(cr,w,h){
 // Specular arcs only: the original glass material supplies the broad glow.
 round(cr,1.2,1.2,w-2.4,h-2.4,20);color(cr,[.62,.74,.85],.19);cr.setLineWidth(.65);cr.stroke();
 for(const [x,y]of [[8,8],[w-8,h-8]])for(const [width,alpha]of [[7,.08],[3,.22],[1.1,.95]]){
  const g=new Cairo.RadialGradient(x,y,0,x,y,62);g.addColorStopRGBA(0,.98,1,1,alpha);g.addColorStopRGBA(.27,.85,.96,1,alpha*.75);g.addColorStopRGBA(.66,.58,.8,1,alpha*.15);g.addColorStopRGBA(1,.45,.65,.85,0);round(cr,1.4,1.4,w-2.8,h-2.8,20);cr.setSource(g);cr.setLineWidth(width);cr.stroke();
 }
}
function edge(cr,h,phase){cr.save();cr.translate(-12,-12);Base.drawEdge(cr,1,344,h+24,phase);cr.restore();}
var foreground=rim;
var animatedEdge=edge;

var upcomingItems=function(e){
 return [['Dark','dark',e.dark],['Dawn','dawn',e.dawn],['Sunrise','rise',e.sunrise],['Sunset','set',e.sunset]]
  .filter(p=>Number.isFinite(p[2])).map(([name,kind,time])=>({name,kind,time})).sort((a,b)=>a.time-b.time).slice(0,3);
};
var eventTooltip=function(event,now=new Date(),nearest=false){
 const date=new Date(event.time*1000),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
 const key=d=>[d.getFullYear(),d.getMonth(),d.getDate()].join('-');
 const day=key(date)===key(now)?'Today':key(date)===key(tomorrow)?'Tomorrow':date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
 const explanation=event.kind==='dark'?'Astronomical twilight ends; Sun 18° below the horizon.':event.kind==='dawn'?'Astronomical twilight begins; Sun 18° below the horizon.':'';
 return (nearest?'Next · ':'')+event.name+' — '+day+', '+eventTime(event.time)+(explanation?'\n'+explanation:'');
};
var installEventButtons=function(a){
 if(a._calmEventButtons)return;a._calmEventButtons=true;
 const UI=imports.gi.St,Tips=imports.ui.tooltips,Shell=imports.ui.main,Menus=imports.ui.popupMenu;
 a._eventButtons=[];
 a._updateEventTips=function(){
  const e=this._state.solarEvents;if(!e)return;
  // Also normalizes the pre-update live instance without restarting Cinnamon.
  if(this._calmSolar!==e){e.items=upcomingItems(e);this._calmSolar=e;}
  const now=new Date();
  for(const b of this._eventButtons){
   const item=e.items[b._eventIndex],moon=this._state.eventMoon||this._state.moon;
   const title=b._eventIndex===3?'Moon phase · Tonight'+(moon?'\n'+(moon.fraction*100).toFixed(1)+'% illuminated':''):item?eventTooltip(item,now,b._eventIndex===0):'Event time unavailable';
   if(b.accessible_name!==title){b.accessible_name=title;b._eventTip.set_text(title);}
  }
 };
 const update=a._rightUpdateButtons;a._rightUpdateButtons=function(){this._updateEventTips();update.call(this);};
 const build=a._buildButtons;a._buildButtons=function(){
  this._eventButtons=[];build.call(this);
  if(this._state.weatherExpanded===false)return;
  const old=this._buttons.find(b=>b.accessible_name==='Sun times and Moon details');
  if(old){this._buttons=this._buttons.filter(b=>b!==old);old.destroy();}
  const y=layout(this._state).weather+2;
  for(let i=0;i<4;i++){
   const b=new UI.Button({reactive:true,can_focus:true,style:'background:transparent;border:none;padding:0;border-radius:8px;'});
   b.set_position((19+i*70+PAD)*this.scale,(y+PAD)*this.scale);b.set_size(70*this.scale,64*this.scale);
   b._eventIndex=i;b._eventTip=new Tips.Tooltip(b,'');
   b.connect('clicked',()=>this._solarDetails(b));
   b.connect('key-focus-in',()=>b.set_style('background:rgba(111,191,230,0.08);border:1px solid rgba(132,212,244,0.4);padding:0;border-radius:8px;'));
   b.connect('key-focus-out',()=>b.set_style('background:transparent;border:none;padding:0;border-radius:8px;'));
   this._root.add_child(b);this._buttons.push(b);this._eventButtons.push(b);
  }
  this._updateEventTips();
 };
 const tick=a._tick;a._tick=function(){tick.call(this);this._updateEventTips();};
 a._solarDetails=function(anchor){
  if(this._detailMenu){this._detailMenu.destroy();this._detailMenu=null;}
  const menu=new Menus.PopupMenu(anchor,UI.Side.RIGHT);this._detailMenu=menu;Shell.uiGroup.add_child(menu.actor);menu.actor.hide();
  if(!this._detailManager)this._detailManager=new Menus.PopupMenuManager(this);this._detailManager.addMenu(menu);
  const e=this._state.solarEvents||{},row=t=>menu.addMenuItem(new Menus.PopupMenuItem(t,{reactive:false}));
  row('SUN & MOON · '+this.city);
  (e.items||[]).forEach((event,i)=>row(eventTooltip(event,new Date(),i===0).split('\n')[0]));
  row('Dark / Dawn: Sun 18° below the horizon');
  const moon=this._state.eventMoon||this._state.moon;if(moon)row('Moon: '+(moon.fraction*100).toFixed(1)+'% illuminated');
  menu.open();
 };
};
