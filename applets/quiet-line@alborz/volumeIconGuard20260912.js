const Mainloop=imports.mainloop;
// Player controls may update media metadata, but this separate panel icon reports output state only.
var bind=function(owner,applet){
 if(!applet._quietVolumeOriginal){
  applet._quietVolumeOriginal=applet.setIcon;
  applet.setIcon=function(icon,source){
   if(this._iconTimeoutId){Mainloop.source_remove(this._iconTimeoutId);this._iconTimeoutId=0;}
   if(source==='output')this._outputIcon=icon;
   else if(source)this._playerIcon=[icon,source==='player-path'];
   const muted=!this._output||this._output.is_muted||this._output.volume===0;
   const path=this._quietVolumeOwner.path+(muted?'/volume-muted-symbolic.svg':'/uicons/volume-symbolic.svg');
   this.set_applet_icon_symbolic_path(path);
  };
 }
 applet._quietVolumeOwner=owner;owner._volumeGuardedApplet=applet;applet.setIcon();
};
var unbind=function(owner){
 const a=owner._volumeGuardedApplet;
 if(a&&a._quietVolumeOwner===owner&&a._quietVolumeOriginal){a.setIcon=a._quietVolumeOriginal;delete a._quietVolumeOriginal;delete a._quietVolumeOwner;a.setIcon();}
 owner._volumeGuardedApplet=null;
};
