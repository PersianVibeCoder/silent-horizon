const Applet=imports.ui.applet, Main=imports.ui.main, Mainloop=imports.mainloop;
const Settings=imports.ui.settings, PopupMenu=imports.ui.popupMenu, Tooltips=imports.ui.tooltips;
const Util=imports.misc.util, ByteArray=imports.byteArray, DocInfo=imports.misc.docInfo;
const {St,Clutter,Gio,GLib,Cinnamon,GdkPixbuf,Pango}=imports.gi;
imports.gi.versions.Gdk='3.0';const Gdk=imports.gi.Gdk,Cairo=imports.cairo;
const UUID='quiet-line@alborz';
function host(){return imports.ui.deskletManager.definitions.find(d=>d.uuid==='silent-horizon@alborz'&&d.desklet&&d.desklet.role==='dashboard')?.desklet;}
function applet(uuid){return imports.ui.appletManager.definitions.find(d=>d.uuid===uuid&&d.applet)?.applet;}
function center(){return imports.ui.appletManager.definitions.find(d=>d.uuid===UUID&&d.applet?.role==='center')?.applet;}
function txt(text,sub=false){return new St.Label({text,style_class:sub?'quiet-line-secondary':'quiet-line-title',y_align:Clutter.ActorAlign.CENTER});}
function glyph(name,size=18){const names={'edit-find-symbolic':'search','media-skip-backward-symbolic':'rewind','media-skip-forward-symbolic':'forward','media-playback-start-symbolic':'play','media-playback-pause-symbolic':'pause'};return names[name]?new St.Icon({gicon:Gio.icon_new_for_string(GLib.get_home_dir()+'/.local/share/cinnamon/applets/'+UUID+'/uicons/'+names[name]+'-symbolic.svg'),icon_size:size,icon_type:St.IconType.SYMBOLIC}):new St.Icon({icon_name:name,icon_size:size,icon_type:St.IconType.SYMBOLIC});}
function round(c,x,y,w,h,r){c.newSubPath();c.arc(x+w-r,y+r,r,-Math.PI/2,0);c.arc(x+w-r,y+h-r,r,0,Math.PI/2);c.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);c.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);c.closePath();}

class QuietLine extends Applet.Applet {
 constructor(metadata,orientation,height,id){
  super(orientation,height,id);this.path=metadata.path;this._dead=false;this._signals=[];this._tips=[];this._styles=[];this._vis=[];this._timers=[];this._bands=[];
  this.settings=new Settings.AppletSettings(this,UUID,id);
  this.settings.bind('role','role',()=>{});this.settings.bind('visualizer','visualizer',()=>this._updateMedia());this.settings.bind('search-key','searchKey',()=>this._bindKey());
  this.actor.set_style_class_name('applet-box quiet-line-module');this.set_applet_tooltip('QuietLine');
  this.box=new St.BoxLayout({style_class:'quiet-line-content',y_align:Clutter.ActorAlign.CENTER});this.actor.add_child(this.box);
  if(this.role==='navigation')this._navigation();else if(this.role==='center')this._center();else if(this.role==='clock')this._clock();else if(this.role==='performance')this._performance();else this._controls();
 }
 _button(child,name,action,width=34,height=36){const b=new St.Button({child,can_focus:true,reactive:true,accessible_name:name,style_class:'quiet-line-button',width,height});b.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);b.connect('clicked',action);this._tips.push(new Tooltips.PanelItemTooltip(b,name,this._orientation));return b;}
 _repeat(seconds,fn){const id=Mainloop.timeout_add_seconds(seconds,()=>{if(this._dead)return false;try{fn();}catch(e){global.logError(e,'QuietLine');}return true;});this._timers.push(id);}
 _connect(obj,name,fn){this._signals.push([obj,obj.connect(name,fn)]);}
 _style(a,s){if(!this._styles.some(v=>v[0]===a))this._styles.push([a,a.get_style()]);a.set_style(s);}
 _hide(a){if(!this._vis.some(v=>v[0]===a))this._vis.push([a,a.visible]);a.hide();}
 _navigation(){
  this.box.set_style('padding:0;spacing:20px;');this.workspaces=new St.BoxLayout({style:'spacing:0px;'});this.box.add_child(this.workspaces);
  this._workspaceButtons=[];
  const build=()=>{this.workspaces.destroy_all_children();this._workspaceButtons=[];for(let i=0;i<global.workspace_manager.n_workspaces;i++){const b=new St.Button({width:22,height:32,can_focus:true,accessible_name:'Workspace '+(i+1),style_class:'quiet-line-button'});b.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);b.connect('clicked',()=>global.workspace_manager.get_workspace_by_index(i).activate(global.get_current_time()));b._dot=new St.Widget({width:5,height:5,style:'background-color:#59616a;border-radius:3px;'});b.set_child(b._dot);this.workspaces.add_child(b);this._workspaceButtons.push(b);this._tips.push(new Tooltips.PanelItemTooltip(b,'Workspace '+(i+1),this._orientation));}this._workspaceState();};
  build();this._connect(global.workspace_manager,'notify::n-workspaces',build);this._connect(global.window_manager,'switch-workspace',()=>this._workspaceState());


  this._connect(this.workspaces,'scroll-event',(a,e)=>{const d=e.get_scroll_direction(),delta=d===Clutter.ScrollDirection.UP?-1:d===Clutter.ScrollDirection.DOWN?1:0;if(!delta)return Clutter.EVENT_PROPAGATE;const i=Math.max(0,Math.min(global.workspace_manager.n_workspaces-1,global.workspace_manager.get_active_workspace_index()+delta));global.workspace_manager.get_workspace_by_index(i).activate(global.get_current_time());return Clutter.EVENT_STOP;});
 }
 _clock(){
  this.box.set_style('padding:0 10px;');
  this.panelTime=new St.Label({y_align:Clutter.ActorAlign.CENTER,style:'font-family:Work Sans;font-size:15px;font-weight:500;color:#e2eaf0;'});
  this.clockButton=this._button(this.panelTime,'Open calendar',()=>this._toggleCalendar(),-1,32);this.clockButton.set_style('padding:0 8px;');this.box.add_child(this.clockButton);
  this.calendarMenu=new PopupMenu.PopupMenu(this.clockButton,this._orientation);Main.uiGroup.add_actor(this.calendarMenu.actor);this.calendarMenu.actor.hide();this.calendarMenu.actor.add_style_class_name('quiet-line-popup');this._menuManager.addMenu(this.calendarMenu);
  const tick=()=>{const d=GLib.DateTime.new_now_local(),t=d.format('%l:%M').trim(),p=d.format('%p');const key=t+p;if(key!==this._clockText){this._clockText=key;this.panelTime.clutter_text.set_markup(t+' <span size="smaller" weight="semibold" foreground="#9cabb7">'+p+'</span>');}};tick();this._repeat(1,tick);
 }
 _toggleCalendar(){
  if(this.calendarMenu.isOpen){this.calendarMenu.close();return;}
  const today=new Date();this._calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);this._renderCalendar();this.calendarMenu.open();
 }
 _renderCalendar(){
  this.calendarMenu.removeAll();const month=this._calendarMonth,today=new Date();
  const item=new PopupMenu.PopupBaseMenuItem({reactive:false});
  const content=new St.BoxLayout({vertical:true,style:'spacing:12px;padding:6px;'});item.addActor(content);this.calendarMenu.addMenuItem(item);
  const header=new St.BoxLayout({style:'spacing:8px;'});
  const change=delta=>{this._calendarMonth=new Date(month.getFullYear(),month.getMonth()+delta,1);this._renderCalendar();};
  const control=(label,name,fn,w=30)=>{const b=new St.Button({label,accessible_name:name,can_focus:true,width:w,height:30,style_class:'quiet-line-button'});b.connect('clicked',fn);return b;};
  header.add_child(control('‹','Previous month',()=>change(-1)));
  header.add_child(new St.Label({text:month.toLocaleDateString('en-US',{month:'long',year:'numeric'}),y_align:Clutter.ActorAlign.CENTER,style:'font-family:Work Sans;font-size:15px;font-weight:500;text-align:center;',width:178}));
  header.add_child(control('›','Next month',()=>change(1)));content.add_child(header);
  const weekdays=new St.BoxLayout({style:'spacing:2px;'});for(const name of ['S','M','T','W','T','F','S'])weekdays.add_child(new St.Label({text:name,width:34,style:'font-size:11px;color:#94a6b7;text-align:center;'}));content.add_child(weekdays);
  const first=month.getDay(),count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for(let week=0;week<Math.ceil((first+count)/7);week++){
   const row=new St.BoxLayout({style:'spacing:2px;'});
   for(let col=0;col<7;col++){
    const day=week*7+col-first+1,valid=day>=1&&day<=count,date=new Date(month.getFullYear(),month.getMonth(),day),isToday=valid&&date.toDateString()===today.toDateString();
    const cell=new St.Label({text:valid?String(day):'',width:34,height:30,y_align:Clutter.ActorAlign.CENTER,style:'font-family:Work Sans;font-size:13px;text-align:center;padding-top:6px;border-radius:8px;'+(isToday?'color:#9be7f0;background-color:rgba(45,174,193,0.20);font-weight:600;':'color:#dce4ec;')});row.add_child(cell);
   }content.add_child(row);
  }
  content.add_child(control('Today','Return to current month',()=>{this._calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);this._renderCalendar();},254));
 }
 _workspaceState(){this._workspaceButtons.forEach((b,i)=>{const active=i===global.workspace_manager.get_active_workspace_index();b._dot.set_size(active?12:5,active?3:5);b._dot.set_style(active?'background-color:#42d9ea;border-radius:2px;':'background-color:#59616a;border-radius:3px;');});}

 _center(){
  this.actor.set_style('margin:0;padding:0;background:none;border:none;box-shadow:none;');this.box.set_style('padding:0 18px 0 0;spacing:10px;');
  this.mediaBox=new St.BoxLayout({style:'spacing:10px;',y_align:Clutter.ActorAlign.CENTER});this.box.add_child(this.mediaBox);
  this.cover=new St.DrawingArea({width:30,height:30,y_align:Clutter.ActorAlign.CENTER});this.cover.connect('repaint',a=>this._drawCover(a));this.mediaBox.add_child(this.cover);
  const labels=this.mediaLabels=new St.BoxLayout({vertical:true,y_align:Clutter.ActorAlign.CENTER});this.title=txt('');this.artist=txt('',true);for(const label of [this.title,this.artist]){label.clutter_text.set_ellipsize(Pango.EllipsizeMode.END);label.clutter_text.set_single_line_mode(true);}labels.add_child(this.title);labels.add_child(this.artist);this.mediaBox.add_child(labels);
  this.prev=this._button(glyph('media-skip-backward-symbolic',13),'Previous track',()=>this._command('Previous'),26,30);this.mediaBox.add_child(this.prev);
  this.playIcon=glyph('media-playback-start-symbolic',15);this.play=this._button(this.playIcon,'Play or pause',()=>this._command('PlayPause'),28,30);this.mediaBox.add_child(this.play);
  this.next=this._button(glyph('media-skip-forward-symbolic',13),'Next track',()=>this._command('Next'),26,30);this.mediaBox.add_child(this.next);
  this.spectrum=new St.DrawingArea({width:34,height:16,y_align:Clutter.ActorAlign.CENTER});this.spectrum.connect('repaint',a=>this._drawSpectrum(a));this.mediaBox.add_child(this.spectrum);
  const searchRow=new St.BoxLayout({style:'spacing:14px;',y_align:Clutter.ActorAlign.CENTER});searchRow.add_child(glyph('edit-find-symbolic',18));searchRow.add_child(txt('Search apps & files',true));const hint=txt('Super K',true);hint.set_style('font-size:10px;color:#91a1b4;padding-left:14px;');searchRow.add_child(hint);
  this.searchButton=this._button(searchRow,'Search apps and recent files · Super K',()=>this.openSearch(),278);this.box.add_child(this.searchButton);
  this._makeSearch();this._bindKey();
  const sources=new PopupMenu.PopupMenuItem('Browser sources and playback details');sources.connect('activate',()=>host()?._showDetails('music',this.actor));this._applet_context_menu.addMenuItem(sources);
  this._updateMedia();this._repeat(1,()=>this._updateMedia());
 }
 _bindKey(){if(this.role!=='center'||!this.searchMenu)return;Main.keybindingManager.addHotKey('quiet-line-search',this.searchKey,()=>this.openSearch());}
 _makeSearch(){
  this.searchMenu=new Applet.AppletPopupMenu(this,this._orientation);this.searchMenu.actor.add_style_class_name('quiet-line-popup quiet-line-alborz-applet');this._menuManager.addMenu(this.searchMenu);
  const item=new PopupMenu.PopupBaseMenuItem({reactive:false});this.entry=new St.Entry({hint_text:'Search apps and recent files…',style_class:'quiet-line-search-entry',can_focus:true});item.addActor(this.entry,{expand:true,span:-1});this.searchMenu.addMenuItem(item);
  this.results=new PopupMenu.PopupMenuSection();this.searchMenu.addMenuItem(this.results);this.entry.clutter_text.connect('text-changed',()=>this._searchResults());this.entry.clutter_text.connect('activate',()=>{if(this._firstResult)this._firstResult();});
  this._connect(this.searchMenu,'open-state-changed',(m,open)=>{if(open)this.entry.grab_key_focus();});
 }
 openSearch(){if(!this.searchMenu)return;const nav=imports.ui.appletManager.definitions.find(d=>d.uuid===UUID&&d.applet?.role==='navigation')?.applet;if(nav?.searchLauncher)this.searchMenu.sourceActor=nav.searchLauncher;this.entry.set_text('');this._searchResults();this.searchMenu.open();global.stage.set_key_focus(this.entry.clutter_text);}
 _searchResults(){
  this.results.removeAll();this._firstResult=null;const query=this.entry.get_text().trim().toLocaleLowerCase();
  const add=(name,iconName,action)=>{const run=()=>{this.searchMenu.close();action();};const item=new PopupMenu.PopupIconMenuItem(name,iconName,St.IconType.SYMBOLIC);item.connect('activate',run);this.results.addMenuItem(item);if(!this._firstResult)this._firstResult=run;};
  const apps=Gio.AppInfo.get_all().filter(a=>a.should_show()).map(a=>Cinnamon.AppSystem.get_default().lookup_app(a.get_id())).filter(Boolean).filter(a=>!query||a.get_name().toLocaleLowerCase().includes(query)||a.get_id().toLocaleLowerCase().includes(query));
  const matches=query?apps.slice(0,6):['firefox.desktop','nemo.desktop','org.gnome.Terminal.desktop','org.gnome.SystemMonitor.desktop'].map(id=>Cinnamon.AppSystem.get_default().lookup_app(id)).filter(Boolean);
  for(const a of matches)add(a.get_name(),'application-x-executable-symbolic',()=>a.activate());
  if(query){const docs=DocInfo.getDocManager()._infosByTimestamp||[];for(const d of docs.filter(d=>d.name.toLocaleLowerCase().includes(query)).slice(0,5))add(d.name,'text-x-generic-symbolic',()=>Gio.AppInfo.launch_default_for_uri(d.uri,global.create_app_launch_context()));}
  else for(const name of ['Documents','Downloads','Pictures'])add(name,'folder-symbolic',()=>Gio.AppInfo.launch_default_for_uri(Gio.File.new_for_path(GLib.build_filenamev([GLib.get_home_dir(),name])).get_uri(),global.create_app_launch_context()));
  if(!this._firstResult){const empty=new PopupMenu.PopupMenuItem('No matching apps or recent files',{reactive:false});this.results.addMenuItem(empty);}
 }
 _command(action){
  const h=host();if(!h)return;
  if(action==='PlayPause'&&h._state?.media){
   this._pendingPlayback={status:this._playing?'Paused':'Playing',source:h._state.media.name,until:GLib.get_monotonic_time()+4000000};
   this._mediaKey=null;this._updateMedia();
  }
  h._command(action);
 }
 _updateMedia(state){
  if(this._dead||this.role!=='center'||!this.mediaBox)return;const s=state===undefined?host()?._state:state;let m=s?.media;
  const pending=this._pendingPlayback;if(pending){if(!m||!['Playing','Paused'].includes(m.status)||m.name!==pending.source||m.status===pending.status||GLib.get_monotonic_time()>=pending.until)this._pendingPlayback=null;else m=Object.assign({},m,{status:pending.status});}
  const active=!!(m&&['Playing','Paused'].includes(m.status));this._playing=active&&m.status==='Playing';this.mediaBox.visible=active;this.searchButton.hide();this.actor.visible=active;this.spectrum.visible=!!this.visualizer;
  if(active){const key=JSON.stringify([m.title,m.artist,m.status,m.canPrevious,m.canNext,m.canPlay,m.canPause,s.artPath,this.visualizer]);if(key!==this._mediaKey){this._mediaKey=key;this.title.set_text(m.title||m.source||'Browser audio');this.artist.set_text(m.artist||m.source||'');const measure=label=>{const layout=label.clutter_text.get_layout().copy();layout.set_width(-1);layout.set_ellipsize(Pango.EllipsizeMode.NONE);layout.set_text(label.text,-1);return layout.get_pixel_size()[0];};const natural=Math.max(measure(this.title),measure(this.artist));this.mediaLabels.set_width(Math.min(220,Math.ceil(natural)+2));this.playIcon.gicon=Gio.icon_new_for_string(this.path+'/uicons/'+(this._playing?'pause':'play')+'-symbolic.svg');for(const [button,enabled] of [[this.prev,m.canPrevious],[this.next,m.canNext],[this.play,m.canPlay||m.canPause]]){button.reactive=!!enabled;button.opacity=enabled?255:65;}
    this.set_applet_tooltip((m.title||'')+'\n'+(m.artist||m.source||''));if(this._artPath!==s.artPath){this._artPath=s.artPath;this._loadCover(s.artPath);}this._accent=s.artAccent;this.cover.queue_repaint();}}
  else{this._mediaKey=null;this._accent=null;this.set_applet_tooltip('Search apps and recent files · Super K');}
  if(this._playing&&this.visualizer){if(!this._audio)this._startAudio();}else{this._stopAudio();this._bands=[];this.spectrum.queue_repaint();}
 }
 _loadCover(path){
  if(this._artCancel)this._artCancel.cancel();this._artCancel=new Gio.Cancellable();const cancel=this._artCancel;this._pixbuf=null;this.cover.queue_repaint();if(!path)return;
  Gio.File.new_for_path(path).read_async(0,cancel,(file,result)=>{let stream;try{stream=file.read_finish(result);GdkPixbuf.Pixbuf.new_from_stream_at_scale_async(stream,256,256,true,cancel,(obj,res)=>{try{const p=GdkPixbuf.Pixbuf.new_from_stream_finish(res);if(!this._dead&&cancel===this._artCancel){this._pixbuf=p;this.cover.queue_repaint();}}catch(e){if(!cancel.is_cancelled())global.logError(e);}finally{stream.close_async(0,null,()=>{});}});}catch(e){if(!cancel.is_cancelled())global.logError(e);}});
 }
 _drawCover(a){const c=a.get_context(),[w,h]=a.get_surface_size();try{round(c,0,0,w,h,5);c.clip();if(this._pixbuf){const p=this._pixbuf,k=Math.max(w/p.width,h/p.height);c.translate((w-p.width*k)/2,(h-p.height*k)/2);c.scale(k,k);Gdk.cairo_set_source_pixbuf(c,p,0,0);c.paint();}else{c.setSourceRGBA(.12,.21,.3,1);c.paint();c.setSourceRGBA(.7,.88,.98,.7);c.arc(w/2,h/2,7,0,Math.PI*2);c.fill();}}finally{c.$dispose();}}
 _drawSpectrum(a){const c=a.get_context();try{this._softBands=this._softBands||Array(9).fill(0);for(let i=0;i<9;i++){const raw=this._playing?Math.max(this._bands[i*2]||0,this._bands[i*2+1]||0):0;const previous=this._softBands[i];const v=previous+(raw-previous)*(raw>previous?.48:.20);this._softBands[i]=v;const h=1.4+Math.pow(v,.7)*10;c.setSourceRGBA(...(i===5?[.87,.76,.52]:[.48,.78,.88]),v>.01?.72:.22);round(c,1+i*3.7,8-h/2,1.3,h,.65);c.fill();}}finally{c.$dispose();}}

 _startAudio(){
  if(this._dead||this._audio)return;try{const p=Gio.Subprocess.new(['/usr/bin/python3',this.path+'/audio-spectrum.py'],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDIN_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);this._audio=p;const cancel=new Gio.Cancellable();this._audioCancel=cancel;const input=new Gio.DataInputStream({base_stream:p.get_stdout_pipe()});
   const read=()=>input.read_line_async(0,cancel,(stream,res)=>{if(this._dead||this._audio!==p)return;try{const [bytes]=stream.read_line_finish(res);if(!bytes)return;const data=JSON.parse(ByteArray.toString(bytes));this._bands=data.bands||[];if(this.actor.mapped)this.spectrum.queue_repaint();read();}catch(e){if(!cancel.is_cancelled())global.logError(e);}});read();
   p.wait_async(null,(proc,res)=>{try{proc.wait_finish(res);}catch(e){}if(this._audio===p){this._audio=null;cancel.cancel();}});
  }catch(e){global.logError(e);}
 }
 _stopAudio(){if(this._audioCancel){this._audioCancel.cancel();this._audioCancel=null;}if(this._audio){const p=this._audio;this._audio=null;try{p.get_stdin_pipe().close(null);p.send_signal(15);}catch(e){}}}
 _performance(){
  this.actor.set_style('margin:0;padding:0;background:none;border:none;');this.box.set_style('padding:0;');
  const row=new St.BoxLayout({style:'spacing:8px;',y_align:Clutter.ActorAlign.CENTER});
  if(!imports.searchPath.includes(this.path))imports.searchPath.unshift(this.path);
  const Art=imports.performanceIcons20260911;const dial=new St.DrawingArea({width:30,height:30});dial.connect('repaint',a=>{const c=a.get_context();try{Art.draw(c,'PERFORMANCE',15,15,19);}finally{c.$dispose();}});row.add_child(dial);
  const name=txt('Performance');name.set_style('font-family:Work Sans;font-size:12px;color:#c1dce8;');row.add_child(name);
  this.performanceButton=new St.Button({child:row,width:140,height:36,can_focus:true,accessible_name:'Open performance dashboard',style_class:'quiet-line-button'});this.performanceButton.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);this.performanceButton.set_style('padding:0 8px;border-radius:14px;border:1px solid rgba(165,204,225,0.10);background-gradient-direction:vertical;background-gradient-start:rgba(156,193,215,0.085);background-gradient-end:rgba(24,48,67,0.10);');this.box.add_child(this.performanceButton);
  if(!imports.searchPath.includes(this.path))imports.searchPath.unshift(this.path);
  this.performance=new imports.performancePanelGlassV220260911.PerformancePanel(this,this.performanceButton);
  this.performanceButton.connect('clicked',()=>{if(this.performance.opened)this.performance.close();else this.performance.open();});
  this.set_applet_tooltip('');
 }
 _controls(){
  this.box.set_style('padding:0;spacing:8px;');this._overflow=false;
  this.trayIcon=new St.Icon({gicon:Gio.icon_new_for_string(this.path+'/uicons/tray-left-symbolic.svg'),icon_size:17});
  this.trayButton=this._button(this.trayIcon,'Show / hide background tray icons',()=>this._toggleTray(),36);
  this.box.add_child(this.trayButton);
  this.controlMenu=new Applet.AppletPopupMenu(this,this._orientation);this._menuManager.addMenu(this.controlMenu);
  const quick=new PopupMenu.PopupMenuItem('Quick controls · calendar and settings');quick.connect('activate',()=>this._openControls());this._applet_context_menu.addMenuItem(quick);
 } 
 _toggleTray(){this._overflow=!this._overflow;this._syncTray();}

 _openControls(){
  if(this.controlMenu.isOpen){this.controlMenu.close();return;}this.controlMenu.removeAll();
  const row=(name,fn)=>{const item=new PopupMenu.PopupMenuItem(name,{reactive:!!fn});if(fn)item.connect('activate',fn);else item.label.set_style('color:#c1cfdb;');this.controlMenu.addMenuItem(item);};
  row(GLib.DateTime.new_now_local().format('%A, %d %B · %H:%M'));
  row('System Monitor',()=>Util.spawn(['gnome-system-monitor']));row('System settings',()=>Util.spawn(['cinnamon-settings']));
  row(this._overflow?'Hide background indicators':'Show background indicators',()=>this._toggleTray());
  this.controlMenu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
  row('Lock screen',()=>Util.spawn(['cinnamon-screensaver-command','--lock']));row('Log out…',()=>new imports.misc.gnomeSession.SessionManager().LogoutRemote(0));row('Power off / restart…',()=>new imports.misc.gnomeSession.SessionManager().ShutdownRemote());this.controlMenu.open();
 }
 _syncTray(){
  imports.ui.appletManager.applets['quiet-line@alborz'].trayIndicator20260911.syncIndicator(this);
  for(const d of imports.ui.appletManager.definitions){if(!d.applet)continue;if(d.uuid==='sound@cinnamon.org'){imports.ui.appletManager.applets[UUID].volumeIconGuard20260912.bind(this,d.applet);}if(d.uuid==='notifications@cinnamon.org'){d.applet.set_applet_icon_symbolic_path(this.path+'/uicons/bell-symbolic.svg');}if(d.uuid==='network@cinnamon.org'&&d.applet._applet_icon?.icon_name?.includes('wireless-signal'))d.applet.set_applet_icon_symbolic_path(this.path+'/uicons/wifi-symbolic.svg');
   if(['xapp-status@cinnamon.org','systray@cinnamon.org','keyboard@cinnamon.org','printers@cinnamon.org','removable-drives@cinnamon.org','power@cinnamon.org'].includes(d.uuid)){const a=d.applet.actor;if(!this._vis.some(x=>x[0]===a))this._vis.push([a,a.visible]);a.visible=this._overflow;}}
 }
 _theme(){
  const p=this.panel||Main.panel;this._style(p.actor,'background-color:rgba(5,10,18,0.95);background-gradient-direction:vertical;background-gradient-start:rgba(12,19,30,0.95);background-gradient-end:rgba(4,9,16,0.95);border:0;border-radius:0;box-shadow:none;');
  this._style(p._leftBox,'background:none;border:none;box-shadow:none;margin:0;padding:0 0 0 24px;spacing:18px;');this._style(p._rightBox,'background:none;border:none;box-shadow:none;margin:0;padding:0 24px 0 0;spacing:8px;');
  for(const d of imports.ui.appletManager.definitions){const a=d.applet;if(!a)continue;
   if((d.uuid==='configurable-menu@johndoe8771'||d.uuid==='menu@cinnamon.org')){this._nativeMenu=a;this._style(a.actor,'margin:0;padding:0 8px 0 0;background:none;border:none;box-shadow:none;color:#edf5fa;');if(GLib.file_test('/usr/share/icons/Mint-X/places/scalable/start-here-linux-mint-symbolic.svg',GLib.FileTest.EXISTS))a.set_applet_icon_symbolic_path('/usr/share/icons/Mint-X/places/scalable/start-here-linux-mint-symbolic.svg');if(a._applet_icon)a._applet_icon.set_icon_size(22);}
   if(d.uuid==='calendar@cinnamon.org'){this._style(a.actor,'margin:0;padding:0 18px;background:none;border:none;color:#e2eaf0;');if(a._applet_label)this._style(a._applet_label,'font-family:Work Sans;font-size:15px;font-weight:500;color:#e2eaf0;');}
   if(['network@cinnamon.org','sound@cinnamon.org','notifications@cinnamon.org'].includes(d.uuid))this._style(a.actor,'margin:0;padding:0 6px;background:none;border:none;color:#dfe9f1;');
  }
 }
 on_applet_added_to_panel(){if(this.role==='navigation'){this._theme();this._delayed=Mainloop.timeout_add_seconds(2,()=>{this._delayed=null;if(!this._dead)this._theme();return false;});}if(this.role==='controls'){this._syncTray();this._repeat(3,()=>this._syncTray());}}
 on_applet_removed_from_panel(){
  imports.ui.appletManager.applets[UUID].volumeIconGuard20260912.unbind(this);
  this._dead=true;if(this.performance)this.performance.destroy();if(this._dividerClock){this._dividerClock.stop();this._dividerClock=null;}if(this._divider){this._divider.destroy();this._divider=null;}this._stopAudio();if(this._artCancel)this._artCancel.cancel();for(const id of this._timers)Mainloop.source_remove(id);if(this._delayed)Mainloop.source_remove(this._delayed);for(const [o,id] of this._signals)o.disconnect(id);for(const t of this._tips)t.destroy();
  if(this.role==='center')Main.keybindingManager.removeHotKey('quiet-line-search');if(this.calendarMenu)this.calendarMenu.destroy();if(this.searchMenu)this.searchMenu.destroy();if(this.controlMenu)this.controlMenu.destroy();
  if(this._calendarSource){const a=applet('calendar@cinnamon.org');if(a){a.menu.close();a.menu.sourceActor=this._calendarSource;}}
  for(const [a,s] of this._styles){try{a.set_style(s||'');}catch(e){}}for(const [a,v] of this._vis){try{a.visible=v;}catch(e){}}if(this._nativeMenu)this._nativeMenu._updateIconAndLabel();this.settings.finalize();
 }
}
function main(metadata,orientation,panel_height,instance_id){return new QuietLine(metadata,orientation,panel_height,instance_id);}
