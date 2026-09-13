const {St,Clutter,Gio,GLib}=imports.gi;
const Cairo=imports.cairo;
const Glass=imports.performanceGlass20260911, Icons=imports.performanceIcons20260911;
const Main=imports.ui.main, Mainloop=imports.mainloop, ByteArray=imports.byteArray;
const CYAN=[.24,.82,.92], GOLD=[.94,.76,.43], LILAC=[.68,.63,.95];
function label(parent,text,x,y,size=14,color='#dde8f0',width=0){
 const a=new St.Label({text,style:`font-family:Inter;font-size:${size}px;color:${color};font-weight:normal;`});
 parent.add_child(a);a.set_position(x,y);if(width)a.set_width(width);return a;
}
function pct(v){return v==null?'—':Math.round(v)+'%';}
function bytes(v){if(v==null)return '—';let i=0;const u=['B','KiB','MiB','GiB','TiB'];while(v>=1024&&i<4){v/=1024;i++;}return (i?v.toFixed(1):Math.round(v))+' '+u[i];}
function temperature(v){return v==null?'Temperature unavailable':Math.round(v)+'°C';}
function line(c,x,y,x2,y2,color,alpha,width){c.setSourceRGBA(...color,alpha);c.setLineWidth(width);c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();}

var PerformancePanel=class PerformancePanel {
 constructor(owner,button){
  this.owner=owner;this.button=button;this.opened=false;this.dead=false;this.history=[];this.diskIndex=0;
  this.actor=new St.Widget({reactive:true,can_focus:true,width:940,height:460,visible:false,style:'background:none;border:0;box-shadow:none;'});
  Main.layoutManager.addChrome(this.actor,{affectsInputRegion:true,affectsStruts:false});
  this.addSheen();
  label(this.actor,'P E R F O R M A N C E',24,22,15,'#45e5ff');
  this.status=label(this.actor,'Connecting to your system…',590,25,12,'#9aaebd',310);
  const close=new St.Button({label:'×',width:28,height:28,style:'color:#a7bac9;font-size:22px;border-radius:14px;background:transparent;',can_focus:true});this.actor.add_child(close);close.set_position(893,16);close.connect('clicked',()=>this.close());
  this.cpu=this.processor('CPU',22,68,CYAN);
  this.gpu=this.processor('GPU',390,68,GOLD);
  this.storage=this.card('STORAGE',22,240,218,194,'drive-harddisk-symbolic');
  this.diskRing=this.ring(this.storage,14,48,86,CYAN);
  this.diskUsed=label(this.storage,'—',113,65,15);this.diskTotal=label(this.storage,'of —',113,89,12,'#93a8b9');
  this.diskButton=new St.Button({label:'Reading drives…',width:186,height:29,can_focus:true,style:'font-family:Inter;font-size:11px;color:#b8cedd;background:rgba(93,153,179,0.10);border-radius:9px;'});this.storage.add_child(this.diskButton);this.diskButton.set_position(16,148);
  this.diskButton.connect('clicked',()=>{if(this.data?.disks?.length){this.diskIndex=(this.diskIndex+1)%this.data.disks.length;this.updateDisk();}});
  this.network=this.card('NETWORK',252,240,294,194,'network-transmit-receive-symbolic');
  this.chart=new St.DrawingArea({width:260,height:49});this.network.add_child(this.chart);this.chart.set_position(17,45);this.chart.connect('repaint',a=>this.drawNetwork(a));
  label(this.network,'↓  Download',17,104,12,'#b3c5d2');label(this.network,'↑  Upload',17,129,12,'#b3c5d2');label(this.network,'Interface total',17,161,10,'#7e94a6');
  this.download=label(this.network,'—',155,104,13,'#7cdce8',123);this.upload=label(this.network,'—',155,129,13,'#eacb91',123);this.netTotal=label(this.network,'—',117,160,10,'#a0b5c5',167);
  this.memory=this.card('MEMORY',558,240,198,194,'media-flash-symbolic');this.memoryRing=this.ring(this.memory,51,43,94,LILAC);this.memoryText=label(this.memory,'— / — GiB',15,153,13,'#c6d4df');
  this.battery=this.card('BATTERY',770,68,148,366,'battery-good-symbolic');
  this.battery.set_style(this.battery.get_style()+'background-gradient-direction:vertical;background-gradient-start:rgba(22,38,43,0.22);background-gradient-end:rgba(6,14,22,0.16);');
  this.batteryDrawing=new St.DrawingArea({width:68,height:145});this.battery.add_child(this.batteryDrawing);this.batteryDrawing.set_position(40,76);this.batteryDrawing.connect('repaint',a=>this.drawBattery(a));
  this.batteryPercent=label(this.battery,'—',22,247,32,'#e6f4ed',110);this.batteryStatus=label(this.battery,'Reading…',22,294,13,'#a6c6bf',110);this.batteryDetail=label(this.battery,'',22,319,11,'#819e9e',110);
  this.signals=[];for(const a of [button,this.actor]){this.signals.push([a,a.connect('enter-event',()=>{this.cancelClose();if(a===button)this.scheduleOpen();return Clutter.EVENT_PROPAGATE;})]);this.signals.push([a,a.connect('leave-event',()=>{this.cancelOpen();this.scheduleClose();return Clutter.EVENT_PROPAGATE;})]);}
  this.signals.push([global.stage,global.stage.connect('captured-event',(a,e)=>{if(!this.opened)return Clutter.EVENT_PROPAGATE;if(e.type()===Clutter.EventType.KEY_PRESS&&e.get_key_symbol()===Clutter.KEY_Escape){this.close();return Clutter.EVENT_STOP;}if(e.type()===Clutter.EventType.BUTTON_PRESS&&!this.containsPointer()){this.close();}return Clutter.EVENT_PROPAGATE;})]);
 }
 addSheen(){
  const a=new St.DrawingArea({width:964,height:484,reactive:false});this.actor.add_child(a);a.set_position(-12,-12);
  a.connect('repaint',area=>{const c=area.get_context();try{
   c.translate(12,12);
   // Dark translucent substrate, then the weather card's exact glass recipe.
   c.newSubPath();c.arc(920,20,19,-Math.PI/2,0);c.arc(920,440,19,0,Math.PI/2);c.arc(20,440,19,Math.PI/2,Math.PI);c.arc(20,20,19,Math.PI,Math.PI*1.5);c.closePath();c.setSourceRGBA(.018,.025,.038,.97);c.fill();
   Glass.panel(c,940,460,null,1);
  }finally{c.$dispose();}});
 }
 card(title,x,y,w,h,icon){
  const a=new St.Widget({width:w,height:h,style:'background-color:rgba(15,22,30,0.26);border:1px solid rgba(144,176,199,0.075);border-radius:18px;'});this.actor.add_child(a);a.set_position(x,y);
  const i=new St.DrawingArea({width:48,height:48,reactive:false});a.add_child(i);i.set_position(6,2);i.connect('repaint',area=>{const c=area.get_context();try{Icons.draw(c,title,24,24,23);}finally{c.$dispose();}});label(a,title,51,18,12,'#75dbea');return a;
 }
 processor(title,x,y,color){
  const a=this.card(title,x,y,356,160,title==='CPU'?'computer-symbolic':'video-display-symbolic');
  const name=label(a,'Reading hardware…',18,48,13,'#b4c4d0',232);
  const temp=label(a,'—',18,88,22);const detail=label(a,title==='CPU'?'Processor temperature':'Graphics temperature',18,120,10,'#839bad',205);
  const ring=this.ring(a,263,43,74,color);label(a,'USAGE',278,123,9,'#839bad');
  const bar=new St.DrawingArea({width:216,height:3});a.add_child(bar);bar.set_position(18,146);bar.connect('repaint',area=>{const c=area.get_context();try{line(c,0,1.5,216,1.5,color,.12,3);if(a.tempValue!=null)line(c,0,1.5,216*Math.min(1,a.tempValue/100),1.5,color,.8,3);}finally{c.$dispose();}});
  return {actor:a,name,temp,detail,ring,bar};
 }
 ring(parent,x,y,size,color){
  const group=new St.Widget({width:size,height:size});parent.add_child(group);group.set_position(x,y);const area=new St.DrawingArea({width:size,height:size});group.add_child(area);const value=label(group,'—',0,size/2-14,23,'#e1edf4');value.set_x((size-value.get_preferred_width(-1)[1])/2);group.value=null;
  area.connect('repaint',a=>{const c=a.get_context();try{const r=size/2-5;c.setLineWidth(4);c.setLineCap(1);c.setSourceRGBA(...color,.13);c.arc(size/2,size/2,r,.75*Math.PI,2.25*Math.PI);c.stroke();if(group.value!=null&&group.value>0){c.setSourceRGBA(...color,.9);c.arc(size/2,size/2,r,.75*Math.PI,(.75+1.5*Math.min(group.value,100)/100)*Math.PI);c.stroke();}}finally{c.$dispose();}});
  group.update=v=>{group.value=v;value.set_text(pct(v));value.set_x((size-value.get_preferred_width(-1)[1])/2);area.queue_repaint();};return group;
 }
 drawNetwork(a){const c=a.get_context();try{const [w,h]=a.get_surface_size();line(c,0,h-2,w,h-2,CYAN,.13,1);const points=this.history;const max=Math.max(1024,...points.flat());for(let series=0;series<2;series++){c.setLineWidth(1.5);c.setSourceRGBA(...(series?GOLD:CYAN),.85);points.forEach((p,i)=>{const x=w*(60-points.length+i)/59,y=h-3-(h-7)*p[series]/max;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);});c.stroke();}}finally{c.$dispose();}}
 drawBattery(a){const c=a.get_context();try{Icons.battery(c,this.data?.battery.percent);}finally{c.$dispose();}}
 update(d){
  this.data=d;this.status.set_text('●  LIVE   ·   '+(d.network.interfaces.join(' + ')||'No active connection'));
  for(const [ui,v] of [[this.cpu,d.cpu],[this.gpu,d.gpu]]){ui.name.set_text(v.name.replace('12th Gen ','').replace('Intel(R) ','Intel ').replace('Core(TM) ','Core ').replace('NVIDIA GeForce ','').replace(' Laptop GPU',' Laptop'));ui.temp.set_text(temperature(v.temp));ui.ring.update(v.usage);ui.actor.tempValue=v.temp;ui.bar.queue_repaint();}
  if(d.gpu.total!=null)this.gpu.detail.set_text('VRAM  '+(d.gpu.used/1024).toFixed(1)+' / '+(d.gpu.total/1024).toFixed(0)+' GiB');
  this.memoryRing.update(d.memory.usage);this.memoryText.set_text((d.memory.used/2**30).toFixed(1)+' / '+(d.memory.total/2**30).toFixed(1)+' GiB');
  this.memoryText.set_x((198-this.memoryText.get_preferred_width(-1)[1])/2);
  this.updateDisk();const n=d.network;this.history.push([n.down,n.up]);if(this.history.length>60)this.history.shift();this.chart.queue_repaint();this.download.set_text(bytes(n.down)+'/s');this.upload.set_text(bytes(n.up)+'/s');this.netTotal.set_text('↓ '+bytes(n.received)+'   ↑ '+bytes(n.sent));
  this.batteryPercent.set_text(pct(d.battery.percent));this.batteryStatus.set_text(d.battery.status==='Full'?'Fully charged':d.battery.status);this.batteryDetail.set_text(d.battery.status==='Full'?'On AC power':d.battery.name);this.batteryDrawing.queue_repaint();
 }
 updateDisk(){const ds=this.data?.disks||[];if(!ds.length){this.diskButton.set_label('No mounted drive');return;}this.diskIndex%=ds.length;const d=ds[this.diskIndex];this.diskRing.update(d.usage);this.diskUsed.set_text(bytes(d.used));this.diskTotal.set_text('of '+bytes(d.total));this.diskButton.set_label(d.name+'  ·  '+d.mount+(ds.length>1?'  ▾':''));this.diskButton.accessible_name='Storage: '+d.mount+'. Click to cycle mounted drives';}
 cancelOpen(){if(this.openTimer){Mainloop.source_remove(this.openTimer);this.openTimer=0;}}
 cancelClose(){if(this.closeTimer){Mainloop.source_remove(this.closeTimer);this.closeTimer=0;}}
 scheduleOpen(){this.cancelOpen();if(!this.opened)this.openTimer=Mainloop.timeout_add(120,()=>{this.openTimer=0;this.open();return false;});}
 scheduleClose(){this.cancelClose();this.closeTimer=Mainloop.timeout_add(340,()=>{this.closeTimer=0;if(!this.containsPointer())this.close();return false;});}
 containsPointer(){const [x,y]=global.get_pointer();for(const a of [this.actor,this.button]){if(!a.visible)continue;const [ax,ay]=a.get_transformed_position(),[w,h]=a.get_transformed_size();if(x>=ax&&x<=ax+w&&y>=ay&&y<=ay+h)return true;}return false;}
 open(){
  if(this.dead)return;this.cancelOpen();this.cancelClose();if(this.opened)return;this.opened=true;
  const [bx,by]=this.button.get_transformed_position();const mon=Main.layoutManager.monitors.find(m=>bx>=m.x&&bx<m.x+m.width)||Main.layoutManager.primaryMonitor;const scale=Math.min(1,(mon.width-32)/940);this.actor.set_scale(scale,scale);this.actor.set_position(Math.max(mon.x+16,Math.min(bx+this.button.width/2-470*scale,mon.x+mon.width-940*scale-16)),by+this.button.height+12);
  this.actor.remove_all_transitions();this.actor.opacity=0;this.actor.translation_y=-16;this.actor.show();this.modal=Main.pushModal(this.actor);global.stage.set_key_focus(this.actor);this.actor.ease({opacity:255,translation_y:0,duration:300,mode:Clutter.AnimationMode.EASE_OUT_CUBIC});this.button.add_style_pseudo_class('active');this.start();
 }
 close(){this.cancelOpen();this.cancelClose();if(!this.opened)return;this.opened=false;if(this.modal){Main.popModal(this.actor);this.modal=false;}this.button.remove_style_pseudo_class('active');this.actor.remove_all_transitions();this.actor.ease({opacity:0,translation_y:-10,duration:180,mode:Clutter.AnimationMode.EASE_IN_OUT_QUAD,onComplete:()=>{if(!this.opened){this.actor.hide();this.stop();}}});}
 start(){
  if(this.process)return;this.status.set_text('Connecting to your system…');this.history=[];
  try{const p=Gio.Subprocess.new(['/usr/bin/python3',this.owner.path+'/performance-worker.py'],Gio.SubprocessFlags.STDOUT_PIPE|Gio.SubprocessFlags.STDERR_SILENCE);this.process=p;const cancel=new Gio.Cancellable();this.cancel=cancel;const stream=new Gio.DataInputStream({base_stream:p.get_stdout_pipe()});
   const next=()=>stream.read_line_async(0,cancel,(s,res)=>{if(this.dead||this.process!==p)return;try{const [v]=s.read_line_finish(res);if(!v){this.status.set_text('Readings unavailable · reopen to retry');return;}this.update(JSON.parse(ByteArray.toString(v)));next();}catch(e){if(!cancel.is_cancelled()){this.status.set_text('Readings unavailable');global.logError(e,'Performance dashboard');}}});next();p.wait_async(null,(proc,res)=>{try{proc.wait_finish(res);}catch(e){}if(this.process===p){this.process=null;cancel.cancel();}});
  }catch(e){this.status.set_text('Unable to read system sensors');global.logError(e);}
 }
 stop(){if(this.cancel){this.cancel.cancel();this.cancel=null;}if(this.process){const p=this.process;this.process=null;try{p.send_signal(15);}catch(e){}}}
 destroy(){if(this.dead)return;this.dead=true;if(this.modal){Main.popModal(this.actor);this.modal=false;}this.cancelOpen();this.cancelClose();this.stop();for(const [a,id] of this.signals)a.disconnect(id);this.actor.remove_all_transitions();Main.layoutManager.removeChrome(this.actor);this.actor.destroy();}
};
