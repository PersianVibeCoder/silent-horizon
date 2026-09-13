const Desklet=imports.ui.desklet;
const St=imports.gi.St;
const Gio=imports.gi.Gio;
const GLib=imports.gi.GLib;
const Clutter=imports.gi.Clutter;
const Main=imports.ui.main;
const Mainloop=imports.mainloop;
const Settings=imports.ui.settings;
const PopupMenu=imports.ui.popupMenu;
const ByteArray=imports.byteArray;

class SilentDesklet extends Desklet.Desklet {
    constructor(metadata,id){
        super(metadata,id);this._id=id;this._path=metadata.path;this._uuid=metadata.uuid;
        imports.searchPath.unshift(metadata.path);
        this.Data=imports.quietHorizonData20260911;this.Art=imports.quietHorizonPolish20260911;this.Sky=imports.quietSky;this.Audio=imports.atmosphereAudio;this.A=imports.vendor.astronomy.Astronomy;
        this._renderer=new this.Art.Renderer(metadata.path);this._state={};this._artPaths={};this._artAccents={};this._disposed=false;
        this.settings=new Settings.DeskletSettings(this,metadata.uuid,id);
        for(let key of ['role','scale','placement','headline','use24','visualizer','city','latitude','longitude','elevation','fahrenheit','details'])
            this.settings.bind(key,key,()=>this._changed());
        this.settings.bind('locked','locked',()=>this._applyLock());
        this.setHeader('Silent Horizon');this.content.set_style('padding:0;margin:0;border:none;background-color:transparent;');
        this._root=new St.Widget({layout_manager:new Clutter.FixedLayout(),reactive:false});
        this._area=new St.DrawingArea({reactive:false});this._root.add_child(this._area);this.setContent(this._root);
        this._area.connect('repaint',()=>{
            if(this._disposed)return;
            const cr=this._area.get_context();try{this._renderer.draw(cr,this.scale,this._state);}catch(e){global.logError(e);}finally{cr.$dispose();}
        });
        this._spectrum=new St.DrawingArea({reactive:false});this._root.add_child(this._spectrum);this._bands=[];
        this._spectrum.connect('repaint',()=>{if(this._disposed)return;let cr=this._spectrum.get_context();this.Audio.draw(cr,...this._spectrum.get_surface_size(),this._bands,1,60);cr.$dispose();});
        this._edge=new St.DrawingArea({reactive:false});this._root.add_child(this._edge);
        this._edge.connect('repaint',()=>{if(this._disposed)return;const cr=this._edge.get_context();try{this.Art.drawEdge(cr,this.scale,this._edge.width,this._edge.height,((GLib.get_monotonic_time()/1e6)/48+(this.role==='music'?.35:0))%1);}finally{cr.$dispose();}});
        this._edgeTimer=Mainloop.timeout_add(100,()=>{if(this._disposed)return false;if(this.role!=='clock'&&this.actor.mapped){this._edge.set_size(this._area.width,this.role==='dashboard'?574*this.scale:this._area.height);this._edge.queue_repaint();}return true;});
        this._buttons=[];this._buildButtons();
        this.actor.connect('enter-event',()=>{if(this.role==='panorama'){this._hover=true;this._tick();}return Clutter.EVENT_PROPAGATE;});
        this.actor.connect('leave-event',()=>{if(this.role==='panorama'){this._hover=false;this._tick();}return Clutter.EVENT_PROPAGATE;});
        this._draggable.connect('drag-begin',()=>{this.placement='free';});
        this._lockMenu=new PopupMenu.PopupSwitchMenuItem('Lock widget position',this.locked);
        this._lockMenu.connect('toggled',(_item,state)=>{this.locked=state;this._applyLock();});
        this._menu.addMenuItem(this._lockMenu);
        this._globalLockSignal=global.settings.connect('changed::lock-desklets',()=>this._applyLock());
        this._applyLock();
        this._monitorSignal=Main.layoutManager.connect('monitors-changed',()=>{this._align();this._prepareBackdrop();});
        this._wallpaper=new Gio.Settings({schema_id:'org.cinnamon.desktop.background'});
        this._wallpaperSignal=this._wallpaper.connect('changed',()=>this._prepareBackdrop());
        let reset=new PopupMenu.PopupMenuItem('Restore recommended layout');reset.connect('activate',()=>{this.placement='inspiration';this.scale=Math.min(Main.layoutManager.primaryMonitor.width/1672,Main.layoutManager.primaryMonitor.height/941);this._changed();});this._menu.addMenuItem(reset);
        let center=new PopupMenu.PopupMenuItem('Center this component');center.connect('activate',()=>{this.placement='center';this._align();});this._menu.addMenuItem(center);
        for(const [label,url] of [['Weather · Open-Meteo','https://open-meteo.com/'],['Air quality · CAMS / Open-Meteo','https://open-meteo.com/en/docs/air-quality-api']]){
            const item=new PopupMenu.PopupMenuItem(label);item.connect('activate',()=>Gio.AppInfo.launch_default_for_uri(url,null));this._menu.addMenuItem(item);
        }
        const skyInfo=new PopupMenu.PopupMenuItem('Dark / Dawn: astronomical twilight; Moon: the relevant night',{reactive:false});this._menu.addMenuItem(skyInfo);
        this._changed();
        this._timer=Mainloop.timeout_add_seconds(1,()=>{this._tick();return !this._disposed;});
        this._cardArt=imports.cardRefresh20260913;this._cardArt.install(this);
        imports.cardGlowAligned20260913.apply(this);
    }
    _applyLock(){
        if(!this._draggable)return;
        const d=this._draggable;
        const locked=!!this.locked||global.settings.get_boolean('lock-desklets');
        if(locked){
            if(d._dragInProgress&&d._dragCancellable)d._cancelDrag({get_time:()=>global.get_current_time()});
            if(!d._dragInProgress){d._buttonDown=false;d._ungrabActor();}
        }
        d.inhibit=locked;
        if(this._lockMenu)this._lockMenu.setToggleState(!!this.locked);
    }
    _onButtonReleaseEvent(actor,event){
        // A plain click must release DND's device grab even when no drag began.
        const d=this._draggable;
        if(event.get_button()===1&&d&&!d._dragInProgress&&!d._animationInProgress){
            d._buttonDown=false;d._ungrabActor(event);
        }
        return super._onButtonReleaseEvent(actor,event);
    }
    _buildButtons(){
        for(const button of this._buttons){if(Main.layoutManager.isTrackingChrome(button))Main.layoutManager.untrackChrome(button);button.destroy();}this._buttons=[];
        this.actor.reactive=true;
        if(this.role==='clock')return;
        const add=(x,y,w,h,label,action)=>{
            let b=new St.Button({reactive:true,can_focus:true,accessible_name:label,style:'background:transparent;border:none;padding:0;'});
            b.set_position((x+12)*this.scale,(y+12)*this.scale);b.set_size(w*this.scale,h*this.scale);b.connect('clicked',()=>action());this._root.add_child(b);this._buttons.push(b);
        };
        if(this.role==='dashboard'){
            add(18,120,284,228,'Weather details',()=>this._showDetails('weather',this._buttons[0]));
            add(18,361,284,77,'Tonight details',()=>this._showDetails('tonight',this._buttons[1]));
            add(10,444,300,100,'Planet positions',()=>this._showDetails('sky',this._buttons[2]));
            this._buttons[2].track_hover=true;this._buttons[2].connect('notify::hover',b=>{this._state.skyHover=b.hover;this._area.queue_repaint();});
            add(0,566,320,44,'Expand or collapse System',()=>this._toggleSystem());
            if(this._state.systemExpanded){add(248,737,56,30,'System details',()=>this._showDetails('system',this._buttons[4]));add(18,704,162,30,'Change storage drive',()=>{const ds=this._state.systemData?.disks||[];if(ds.length){this._state.systemDisk=((this._state.systemDisk||0)+1)%ds.length;this._area.queue_repaint();}});}
            return;
        }
        add(38,155,38,38,'Previous track',()=>this._command('Previous'));
        add(93,152,44,44,'Play or pause',()=>this._command('PlayPause'));
        add(154,155,38,38,'Next track',()=>this._command('Next'));
        add(24,120,272,20,'Seek in track',()=>{});
        this._buttons[3].connect('button-press-event',(actor,event)=>{
            if(event.get_button()!==1)return Clutter.EVENT_PROPAGATE;
            let [sx]=event.get_coords(),[ax]=actor.get_transformed_position();this._command('seek',(sx-ax)/(272*this.scale));return Clutter.EVENT_STOP;
        });
        add(275,15,30,34,'Music sources and details',()=>this._showDetails('music',this._buttons[4]));

    }
    _toggleSystem(){
        this._state.systemExpanded=!this._state.systemExpanded;
        const h=Math.ceil((634+(this._state.systemExpanded?160:0))*this.scale);
        this._root.remove_all_transitions();this._area.set_height(h);this._root.set_clip_to_allocation(true);this._root.ease({height:h,duration:240,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});
        this._buildButtons();this._area.queue_repaint();if(this._state.systemExpanded)this._startSystem();else this._stopSystem();
    }
    _startSystem(){
        if(this._systemProcess||this._disposed)return;const path=GLib.get_home_dir()+'/.local/share/cinnamon/applets/quiet-line@alborz/performance-worker.py';
        try{const p=Gio.Subprocess.new(['/usr/bin/python3',path],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);this._systemProcess=p;const cancel=new Gio.Cancellable();this._systemCancel=cancel;const stream=new Gio.DataInputStream({base_stream:p.get_stdout_pipe()});
            const next=()=>stream.read_line_async(0,cancel,(input,res)=>{if(this._disposed||this._systemProcess!==p)return;try{const [bytes]=input.read_line_finish(res);if(!bytes)return;this._state.systemData=JSON.parse(ByteArray.toString(bytes));this._area.queue_repaint();next();}catch(e){if(!cancel.is_cancelled())global.logError(e);}});next();
            p.wait_async(null,(proc,res)=>{try{proc.wait_finish(res);}catch(e){}if(this._systemProcess===p){this._systemProcess=null;cancel.cancel();}});
        }catch(e){global.logError(e);}
    }
    _stopSystem(){if(this._systemCancel){this._systemCancel.cancel();this._systemCancel=null;}if(this._systemProcess){const p=this._systemProcess;this._systemProcess=null;try{p.send_signal(15);}catch(e){}}}
    _changed(){
        if(!this._area||this._disposed)return;
        let [w,h]=this.Art.SIZES[this.role]||this.Art.SIZES.clock;if(this.role==='dashboard'&&this._state.systemExpanded)h+=160;
        this._root.set_size(Math.ceil(w*this.scale),Math.ceil(h*this.scale));this._area.set_size(Math.ceil(w*this.scale),Math.ceil(h*this.scale));
        this._edge.visible=this.role!=='clock';this._buildButtons();this._lastMinute=null;this._lastPaintKey=null;this._skyKey=null;this._align();
        this._spectrum.set_position(233*this.scale,176*this.scale);this._spectrum.set_size(70*this.scale,20*this.scale);
        this._spectrum.visible=this.role==='music'&&this.visualizer;
        if(this._spectrum.visible&&!this._audioProcess)this._startAudio();
        if(!this._spectrum.visible)this._stopAudio();
        const serviceKey=this.role==='dashboard'?[this.latitude,this.longitude,this.fahrenheit].join(','):'';
        if(serviceKey!==this._serviceKey){this._stopService();this._serviceKey=serviceKey;if(serviceKey)this._startService();}
        this._prepareBackdrop();this._tick();this._applyLock();
    }
    on_desklet_added_to_desktop(){
        this._applyLock();
        if(this.placement==='free'){
            let saved=global.settings.get_strv('enabled-desklets').find(s=>s.startsWith(this._uuid+':'+this._id+':'));
            if(saved){let p=saved.split(':');this.actor.set_position(+p[2],+p[3]);}
        }else this._align();
    }
    _align(){
        if(!this._area||this.placement==='free'||this._disposed)return;
        const m=Main.layoutManager.primaryMonitor,[w,h]=this.Art.SIZES[this.role];let x,y;
        if(this.placement==='center'){x=m.x+(m.width-w*this.scale)/2;y=m.y+(m.height-h*this.scale)/2;}
        else{
            const sx=m.width/1672,sy=m.height/941;
            if(this.role==='clock'){x=m.x+m.width*.48-w*this.scale/2;y=m.y+110*sy;}
            else if(this.role==='dashboard'){x=m.x+m.width-44*sx-w*this.scale+12*this.scale;y=m.y+65*sy-12*this.scale;}
            else{x=m.x+m.width-44*sx-w*this.scale+12*this.scale;y=m.y+65*sy+(682+18)*this.scale-12*this.scale;}

        }
        this.actor.set_position(Math.round(Math.max(m.x,x)),Math.round(Math.max(m.y+24,y)));
    }
    _tick(){
        if(this._disposed)return;
        const d=GLib.DateTime.new_now_local(), now=new Date(),minute=Math.floor(now.getTime()/60000);
        Object.assign(this._state,{details:this.details||this._hover,role:this.role,headline:this.headline,city:this.city,latitude:this.latitude,longitude:this.longitude,elevation:this.elevation,time:d.format(this.use24?'%H:%M':'%I:%M'),period:this.use24?'':d.format('%p'),day:d.format('%A').toUpperCase(),date:d.format('%m.%d.%y'),longDate:d.format('%d %B %Y').toUpperCase(),fahrenheit:this.fahrenheit,localStamp:d.format('%a %d %b %Y · %l:%M %p').replace(/  +/g,' ')});
        if(this._lastMinute!==minute){
            this._lastMinute=minute;
            if(this.role!=='clock'){
                const o=new this.A.Observer(this.latitude,this.longitude,this.elevation), start=new Date(now);start.setHours(0,0,0,0);
                const fmt=t=>{if(!t)return '—';let r=new Date(Math.round(t.date.getTime()/60000)*60000);return String(r.getHours()).padStart(2,'0')+':'+String(r.getMinutes()).padStart(2,'0');};
                const rise=this.A.SearchRiseSet('Sun',o,1,start,1),set=this.A.SearchRiseSet('Sun',o,-1,start,1);
                this._state.sunrise=fmt(rise);this._state.sunset=fmt(set);
                this._sunriseMs=rise?rise.date.getTime():null;this._sunsetMs=set?set.date.getTime():null;
                if(this.role==='dashboard'){const eq=this.A.Equator('Sun',now,o,true,true);this._state.sunAltitude=this.A.Horizon(now,o,eq.ra,eq.dec,'normal').altitude;}
                if(this.role==='dashboard')this._state.moon=this.Sky.calculate(now,this.latitude,this.longitude,this.elevation,'local-up');
                if(this.role==='dashboard')this._state.bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune'].map(name=>{let e=this.A.Equator(name,now,o,true,true),h=this.A.Horizon(now,o,e.ra,e.dec,'normal');return {name,altitude:h.altitude,azimuth:h.azimuth,magnitude:this.A.Illumination(name,now).mag};}).filter(b=>b.altitude>0);
            }
        }
        if(this.role!=='clock'){
            this._state.isDay=this._sunriseMs!==null&&this._sunsetMs!==null?now.getTime()>=this._sunriseMs&&now.getTime()<this._sunsetMs:this._state.sunAltitude>0;
            if(this._serviceKey&&(!this._lastServiceMessage||Date.now()-this._lastServiceMessage>90000)){this._stopService();this._startService();}
            const forecastKey=[minute,this._state.weather&&this._state.weather.updated].join(':');
            if(this._forecastKey!==forecastKey){this._forecastKey=forecastKey;this._state.forecast=this.Data.forecast(this._state.weather,now);}
            const monitor=Main.layoutManager.primaryMonitor,[ax,ay]=this.actor.get_position();
            this._state.backdrop={path:this._frostPath||'',x:ax+12*this.scale-monitor.x,y:ay+12*this.scale-monitor.y,width:monitor.width,height:monitor.height};
            const skyKey=[Math.floor(now.getTime()/600000),this._state.weather&&this._state.weather.updated].join(':');
            if(this.role==='dashboard'&&this._skyKey!==skyKey){
                this._skyKey=skyKey;this._state.forecast=this.Data.forecast(this._state.weather,now);
                this._state.tonight=this.Data.tonight(this.A,this._state.weather,now,this.latitude,this.longitude,this.elevation);
                this._state.moonTonight=this.Sky.calculate(new Date(this._state.tonight.moonEpoch*1000),this.latitude,this.longitude,this.elevation,'local-up');
            }
        }
        const m=this._state.media;
        this._state.position=m?Math.min(m.duration||Infinity,m.position+(m.status==='Playing'?Math.max(0,Date.now()/1000-m.sampled)*m.rate:0)):0;
        this._state.artPath=m?this._artPaths[m.artKey]||'':'';this._state.artAccent=m?this._artAccents[m.artKey]:null;
        if(this.role==='music'){
            const h=(m?244:112)*this.scale;
            if(this._root.height!==Math.ceil(h)){this._root.set_height(Math.ceil(h));this._area.set_height(Math.ceil(h));}
            this._spectrum.visible=!!(m&&m.status==='Playing'&&this.visualizer);
            this._buttons.forEach(b=>b.visible=!!m);
            [m&&m.canPrevious,m&&(m.status==='Playing'?m.canPause:m.canPlay),m&&m.canNext,m&&m.canSeek&&m.duration>0].forEach((enabled,i)=>{if(this._buttons[i])this._buttons[i].reactive=!!enabled;});
        }
        // A clock and the large panorama need repainting only once per minute.
        const paintKey=this.role!=='clock'?JSON.stringify([this._state.weather,this._state.air,this._state.media,this._state.artPath,this._state.backdrop,this._skyKey,this._state.isDay,Math.floor(this._state.position),this._lastMinute]):[this.role,this._state.time,this._lastMinute,this._state.details].join(':');
        if(paintKey!==this._lastPaintKey){this._lastPaintKey=paintKey;this._area.queue_repaint();}
    }
    _prepareBackdrop(){
        if(this._disposed||this.role==='clock'||!this._wallpaper)return;
        const m=Main.layoutManager.primaryMonitor;
        const args=[this._wallpaper.get_string('picture-uri'),this._wallpaper.get_string('picture-options'),String(m.width),String(m.height)];
        const key=JSON.stringify(args);if(key===this._frostKey)return;this._frostKey=key;
        if(this._frostProcess)this._frostProcess.force_exit();
        try{
            const proc=Gio.Subprocess.new(['/usr/bin/python3',this._path+'/frost-backdrop.py',...args],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);this._frostProcess=proc;
            proc.communicate_utf8_async(null,null,(p,r)=>{
                if(this._disposed||this._frostProcess!==p)return;
                try{const [ok,out]=p.communicate_utf8_finish(r);if(ok&&p.get_successful()){this._frostPath=out.trim();this._tick();}}catch(e){global.logError(e);}
                this._frostProcess=null;
            });
        }catch(e){global.logError(e);}
    }
    _startService(){
        this._lastServiceMessage=Date.now();
        try{
            this._process=Gio.Subprocess.new(['/usr/bin/python3',this._path+'/quiet-service.py',String(this.latitude),String(this.longitude),String(this.fahrenheit)],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDIN_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);
            const proc=this._process,input=new Gio.DataInputStream({base_stream:proc.get_stdout_pipe()});this._input=input;this._cancel=new Gio.Cancellable();
            const read=()=>input.read_line_async(GLib.PRIORITY_DEFAULT,this._cancel,(stream,result)=>{
                if(this._disposed||proc!==this._process)return;
                try{let [bytes]=stream.read_line_finish(result);if(!bytes){this._state.weatherError=true;return;}
                    let data=JSON.parse(ByteArray.toString(bytes));this._lastServiceMessage=Date.now();
                    if(data.kind==='media'){this._state.media=data.media;this._state.sessions=data.sessions||[];this._state.preferred=data.preferred;}
                    if(data.kind==='weather'){this._state.weather=data;this._state.weatherError=false;}
                    if(data.kind==='weatherError'){this._state.weatherError=true;if(this._state.weather)this._state.weather.stale=true;}
                    if(data.kind==='air')this._state.air=data;
                    if(data.kind==='airError'&&this._state.air)this._state.air.stale=true;
                    if(data.kind==='art'){this._artPaths[data.key]=data.path;this._artAccents[data.key]=data.accent;}
                    for(const x of imports.ui.deskletManager.definitions){const peer=x.desklet;if(x.uuid===this._uuid&&peer&&peer.role==='music'&&!peer._disposed){
                        peer._state.media=this._state.media;peer._state.sessions=this._state.sessions;peer._state.preferred=this._state.preferred;peer._artPaths=this._artPaths;peer._artAccents=this._artAccents;peer._tick();
                    }}
                    this._tick();read();
                }catch(e){if(!this._disposed)global.logError(e);}
            });read();
        }catch(e){global.logError(e);this._state.weatherError=true;}
    }
    _showDetails(kind,anchor){
        if(this._detailMenu){const same=this._detailKind===kind&&this._detailMenu.isOpen;this._detailMenu.destroy();this._detailMenu=null;if(same)return;}
        const menu=new PopupMenu.PopupMenu(anchor,St.Side.RIGHT);this._detailMenu=menu;this._detailKind=kind;
        Main.uiGroup.add_child(menu.actor);menu.actor.hide();
        if(!this._detailManager)this._detailManager=new PopupMenu.PopupMenuManager(this);
        this._detailManager.addMenu(menu);
        const s=this._state,c=s.weather&&s.weather.current,f=s.forecast,n=s.tonight;
        const num=(v,u='')=>typeof v==='number'?Math.round(v)+u:'—';
        const row=(label,action)=>{let item=new PopupMenu.PopupMenuItem(label,{reactive:!!action});if(action)item.connect('activate',action);else item.label.set_style('color:#cbd5e1;');menu.addMenuItem(item);};
        if(kind==='system'){
            const d=s.systemData;if(!d){row('Waiting for system readings…');menu.open();return;}
            const size=n=>(n/2**30).toFixed(1)+' GiB';
            row(d.cpu.name);row('CPU '+num(d.cpu.usage,'%')+' · '+num(d.cpu.temp,'°C'));
            row(d.gpu.name);row('GPU '+num(d.gpu.usage,'%')+' · '+num(d.gpu.temp,'°C'));
            if(d.gpu.total!=null)row('Graphics memory '+num(d.gpu.used)+' / '+num(d.gpu.total)+' MiB');
            row('Memory '+size(d.memory.used)+' / '+size(d.memory.total));
            for(const disk of d.disks)row(disk.name+' · '+disk.mount+' · '+size(disk.used)+' / '+size(disk.total));
            row('Network '+d.network.interfaces.join(', '));row('Interface totals: ↓ '+size(d.network.received)+' · ↑ '+size(d.network.sent));
            row('Battery '+num(d.battery.percent,'%')+' · '+d.battery.status);
        }else if(kind==='weather'){
            row('WEATHER · '+this.city);
            row('Air quality: '+num(s.air&&s.air.aqi)+' US AQI · '+this.Data.aqiLabel(s.air&&s.air.aqi));
            row('UV index: '+(f&&typeof f.uv==='number'?f.uv.toFixed(1):'—'));
            row('Feels like '+num(c&&c.apparent_temperature,'°')+' · Humidity '+num(c&&c.relative_humidity_2m,'%'));
            row('Wind '+num(c&&c.wind_speed_10m,this.fahrenheit?' mph':' km/h')+' · Rain chance '+num(f&&f.rain,'%'));
            if(f&&f.peak)row('Peak heat: '+num(f.peak.value,'°')+' at '+this.Data.hourLabel(f.peak.epoch));
            const h=s.weather&&s.weather.hourly,now=Date.now()/1000;
            if(h)h.time.map((t,i)=>({t,i})).filter(p=>p.t>=now).slice(0,12).forEach(p=>row(this.Data.hourLabel(p.t)+'   '+num(h.temperature_2m[p.i],'°')+'   Rain '+num(h.precipitation_probability[p.i],'%')));
            if(s.weather&&s.weather.stale)row('Showing cached weather');
        }else if(kind==='tonight'){
            row(n?n.title:'Tonight');row(n?n.subtitle:'Forecast unavailable');
            row('Cloud in best window: '+num(n&&n.best&&n.best.cloud,'%'));
            row('Astronomical darkness: '+(n?this.Data.timeLabel(n.dark):'—'));
            row('Morning twilight: '+(n?this.Data.timeLabel(n.dawn):'—'));
            row('Window estimated from clouds and moonlight');
            const h=s.weather&&s.weather.hourly;
            if(h&&n&&n.sunset)h.time.map((t,i)=>({t,i})).filter(p=>p.t>=n.sunset&&p.t<(n.dawn||n.sunset+36000)).slice(0,12).forEach(p=>row(this.Data.hourLabel(p.t)+'   Cloud '+num(h.cloud_cover[p.i],'%')));
        }else if(kind==='sky'){
            row('ABOVE YOUR HORIZON · '+this.city);
            for(const b of (s.bodies||[]))row(b.name+'   '+b.altitude.toFixed(1)+'° up · '+b.azimuth.toFixed(1)+'° azimuth');
            row('Map: Sun, Moon and planets above the horizon');row('Markers show calculated positions, not naked-eye visibility');
            row('Updated each minute; daylight does not filter objects');
        }else{
            row('BROWSER SOURCES');
            row((!s.preferred?'✓ ':'')+'Automatically follow playback',()=>this._command('select',''));
            for(const session of s.sessions||[])row((s.preferred===session.name?'✓ ':'')+session.browser+' · '+session.title.slice(0,48),()=>this._command('select',session.name));
            if(s.media){row('Source: '+s.media.source);row(s.media.status);if(s.media.canSeek&&s.media.duration){row('Back 10 seconds',()=>this._command('seek',Math.max(0,(s.position-10)/s.media.duration)));row('Forward 10 seconds',()=>this._command('seek',Math.min(1,(s.position+10)/s.media.duration)));}}
        }
        menu.open();
    }
    _command(action,fraction){
        if(this.role==='music'){
            const host=imports.ui.deskletManager.definitions.find(x=>x.uuid===this._uuid&&x.desklet&&x.desklet.role==='dashboard');
            if(host)host.desklet._command(action,fraction);return;
        }
        if(!this._process)return;
        try{this._process.get_stdin_pipe().write_all(ByteArray.fromString(JSON.stringify({action,fraction})+'\n'),null);}catch(e){global.logError(e);}
    }
    _startAudio(){
        try{
            const p=Gio.Subprocess.new(['/usr/bin/python3',this._path+'/audio-spectrum.py'],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDIN_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);this._audioProcess=p;this._audioCancel=new Gio.Cancellable();
            const input=new Gio.DataInputStream({base_stream:p.get_stdout_pipe()});
            const read=()=>input.read_line_async(GLib.PRIORITY_DEFAULT,this._audioCancel,(stream,result)=>{
                if(this._disposed||this._audioProcess!==p)return;
                try{const [bytes]=stream.read_line_finish(result);if(!bytes)return;const data=JSON.parse(ByteArray.toString(bytes));this._bands=data.bands||[];if(!this._lastSpectrumFrame||GLib.get_monotonic_time()-this._lastSpectrumFrame>45000){this._lastSpectrumFrame=GLib.get_monotonic_time();this._spectrum.queue_repaint();}read();}catch(e){if(!this._disposed)global.logError(e);}
            });read();
        }catch(e){global.logError(e);}
    }
    _trackMouse(){super._trackMouse();}
    _untrackMouse(){super._untrackMouse();}
    _stopAudio(){if(this._audioCancel){this._audioCancel.cancel();this._audioCancel=null;}if(this._audioProcess){this._audioProcess.send_signal(15);this._audioProcess=null;}}
    _stopService(){if(this._cancel){this._cancel.cancel();this._cancel=null;}if(this._process){this._process.force_exit();this._process=null;}this._state.media=null;}
    _dispose(){if(this._disposed)return;this._stopSystem();this._root?.remove_all_transitions();if(this._edgeTimer){Mainloop.source_remove(this._edgeTimer);this._edgeTimer=0;}if(this._globalLockSignal){global.settings.disconnect(this._globalLockSignal);this._globalLockSignal=0;}if(this._detailMenu){this._detailMenu.destroy();this._detailMenu=null;}this._disposed=true;if(this._frostProcess){this._frostProcess.force_exit();this._frostProcess=null;}if(this._wallpaperSignal)this._wallpaper.disconnect(this._wallpaperSignal);this._untrackMouse();if(this._timer)Mainloop.source_remove(this._timer);this._timer=0;this._stopService();this._stopAudio();if(this._monitorSignal)Main.layoutManager.disconnect(this._monitorSignal);this._monitorSignal=0;this.settings.finalize();}
    destroy(deleteConfig){this._dispose();super.destroy(deleteConfig);}
    on_desklet_reloaded(){this._dispose();}
    on_desklet_removed(){this._dispose();}
}
function main(metadata,id){return new SilentDesklet(metadata,id);}
