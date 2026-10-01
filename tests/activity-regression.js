// Run under dbus-run-session: no calls to the real desktop screensaver.
const {Gio,GLib}=imports.gi;imports.searchPath.unshift(ARGV[0]+'/desklets/silent-horizon@alborz');
const Activity=imports.quietActivity.ActivityMonitor,bus=Gio.DBus.session;
const xml='<node><interface name="org.cinnamon.ScreenSaver"><method name="GetActive"><arg type="b" direction="out"/></method><signal name="ActiveChanged"><arg type="b"/></signal></interface></node>';
let invocation;
const service=Gio.DBusExportedObject.wrapJSObject(xml,{GetActiveAsync(_params,inv){invocation=inv;}});
service.export(bus,'/org/cinnamon/ScreenSaver');
bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','RequestName',new GLib.Variant('(su)',['org.cinnamon.ScreenSaver',0]),null,Gio.DBusCallFlags.NONE,1000,null);
let actorCallback,updates=0;
const actor={mapped:true,connect(_name,fn){actorCallback=fn;return 1;},disconnect(){actorCallback=null;}};
const monitor=new Activity(actor,()=>updates++),loop=new GLib.MainLoop(null,false);
function check(value,message){if(!value)throw Error(message);}
function waitFor(predicate){return new Promise((resolve,reject)=>{const deadline=GLib.get_monotonic_time()+3000000;GLib.timeout_add(0,10,()=>{if(predicate()){resolve();return false;}if(GLib.get_monotonic_time()>deadline){reject(Error('Timed out'));return false;}return true;});});}
let failed=false;
(async()=>{
 await waitFor(()=>invocation);
 service.emit_signal('ActiveChanged',new GLib.Variant('(b)',[true]));await waitFor(()=>monitor.locked);
 check(!monitor.active,'Lock pauses visual work');
 invocation.return_value(new GLib.Variant('(b)',[false]));
 await new Promise(resolve=>GLib.timeout_add(0,100,()=>{resolve();return false;}));
 check(!monitor.active,'Late initial reply cannot override a newer lock signal');
 service.emit_signal('ActiveChanged',new GLib.Variant('(b)',[false]));await waitFor(()=>monitor.active);
 actor.mapped=false;actorCallback();check(!monitor.active,'Unmapped actor is inactive');
 actor.mapped=true;actorCallback();check(monitor.active,'Mapped actor resumes');
 service.emit_signal('ActiveChanged',new GLib.Variant('(b)',[true]));await waitFor(()=>monitor.locked);
 bus.call_sync('org.freedesktop.DBus','/org/freedesktop/DBus','org.freedesktop.DBus','ReleaseName',new GLib.Variant('(s)',['org.cinnamon.ScreenSaver']),null,0,1000,null);
 await waitFor(()=>monitor.active);
 monitor.destroy();const previous=updates;check(!monitor.active&&!actorCallback,'Disposal disconnects mapping and deactivates');
 service.emit_signal('ActiveChanged',new GLib.Variant('(b)',[false]));
 await new Promise(resolve=>GLib.timeout_add(0,100,()=>{resolve();return false;}));check(updates===previous,'Disposed subscription is silent');
 print('PASS: real D-Bus lock/unlock, stale initial reply, mapping, service exit and disposal.');
})().catch(e=>{printerr(e.stack);failed=true;}).finally(()=>{service.unexport();loop.quit();});
loop.run();if(failed)imports.system.exit(1);
