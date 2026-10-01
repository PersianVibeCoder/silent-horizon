// Pause visual work when unmapped or Cinnamon's screensaver is active.
// Being mapped does not imply freedom from window occlusion; do not guess at it.
const Gio=imports.gi.Gio,GLib=imports.gi.GLib;
var ActivityMonitor=class ActivityMonitor {
 constructor(actor,changed){
  this.actor=actor;this.changed=changed;this.locked=false;this.dead=false;this.serial=0;
  this.cancel=new Gio.Cancellable();
  this.mappedSignal=actor.connect('notify::mapped',()=>this.changed());
  this.subscription=Gio.DBus.session.signal_subscribe('org.cinnamon.ScreenSaver','org.cinnamon.ScreenSaver','ActiveChanged','/org/cinnamon/ScreenSaver',null,Gio.DBusSignalFlags.NONE,(_c,_s,_p,_i,_n,args)=>{
   this.serial++;this.locked=args.deep_unpack()[0];this.changed();
  });
  this.ownerSubscription=Gio.DBus.session.signal_subscribe('org.freedesktop.DBus','org.freedesktop.DBus','NameOwnerChanged','/org/freedesktop/DBus','org.cinnamon.ScreenSaver',Gio.DBusSignalFlags.NONE,(_c,_s,_p,_i,_n,args)=>{
   this.serial++;this.locked=false;this.changed();if(args.deep_unpack()[2])this._query();
  });
  this._query();
 }
 _query(){
  const serial=this.serial;
  Gio.DBus.session.call('org.cinnamon.ScreenSaver','/org/cinnamon/ScreenSaver','org.cinnamon.ScreenSaver','GetActive',null,new GLib.VariantType('(b)'),Gio.DBusCallFlags.NO_AUTO_START,2000,this.cancel,(connection,result)=>{
   try{const value=connection.call_finish(result);if(!this.dead&&serial===this.serial){this.locked=value.deep_unpack()[0];this.changed();}}catch(e){}
  });
 }
 get active(){return !this.dead&&this.actor.mapped&&!this.locked;}
 destroy(){this.dead=true;this.cancel.cancel();this.actor.disconnect(this.mappedSignal);Gio.DBus.session.signal_unsubscribe(this.subscription);Gio.DBus.session.signal_unsubscribe(this.ownerSubscription);}
};
