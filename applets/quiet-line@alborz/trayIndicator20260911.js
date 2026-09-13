const {St,Clutter,Gio}=imports.gi;
var syncIndicator=function(a){
    if(!a._horizontalTrayIcons)a._horizontalTrayIcons={
        left:Gio.icon_new_for_string(a.path+'/uicons/tray-left-symbolic.svg'),
        right:Gio.icon_new_for_string(a.path+'/uicons/tray-right-symbolic.svg')
    };
    a.trayIcon.rotation_angle_z=0;
    a.trayIcon.x_align=Clutter.ActorAlign.CENTER;
    a.trayIcon.y_align=Clutter.ActorAlign.CENTER;
    a.trayIcon.icon_type=St.IconType.SYMBOLIC;
    a.trayIcon.gicon=a._overflow?a._horizontalTrayIcons.right:a._horizontalTrayIcons.left;
    a.trayButton.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
    a.trayButton.accessible_name=a._overflow?'Collapse background tray icons':'Expand background tray icons';
    a.trayButton.set_style('padding:0;'+(a._overflow?'color:#37d5e6;background-color:rgba(50,150,190,0.10);':''));
};
