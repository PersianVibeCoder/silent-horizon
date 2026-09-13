const Base=imports.quietHorizonPolish20260911,Cairo=imports.cairo;
imports.gi.versions.Gdk='3.0';const Gdk=imports.gi.Gdk;
const {color,circle,round}=Base;const WHITE=[.96,.97,1];
function faintPanel(cr,w,h,backdrop,scale){
    const collapsed=h<=44, strength=collapsed?.75:1;
    // The two corner blooms sit outside the glass; its long edges stay quiet.
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        let glow=new Cairo.RadialGradient(x,y,0,x,y,24);
        glow.addColorStopRGBA(0,.68,.88,1,.22*strength);glow.addColorStopRGBA(.45,.48,.76,1,.08*strength);glow.addColorStopRGBA(1,.38,.68,1,0);
        cr.setSource(glow);cr.rectangle(x-24,y-24,48,48);cr.fill();
    }
    cr.save();round(cr,1,1,w-2,h-2,20);cr.clip();
    if(backdrop&&backdrop.pixbuf){
        cr.save();cr.translate(-backdrop.x/scale,-backdrop.y/scale);
        cr.scale(backdrop.width/backdrop.pixbuf.width/scale,backdrop.height/backdrop.pixbuf.height/scale);
        Gdk.cairo_set_source_pixbuf(cr,backdrop.pixbuf,0,0);cr.paint();cr.restore();
    }
    let tint=new Cairo.LinearGradient(0,0,0,h);
    tint.addColorStopRGBA(0,.06,.075,.09,.76);tint.addColorStopRGBA(.5,.022,.03,.045,.60);tint.addColorStopRGBA(1,.08,.13,.21,.44);
    cr.setSource(tint);cr.paint();
    // A broad neutral reflection at the head, blue transmitted from wallpaper below.
    let sheen=new Cairo.LinearGradient(0,0,w*.65,190);
    sheen.addColorStopRGBA(0,.82,.90,.98,.12);sheen.addColorStopRGBA(.35,.70,.80,.93,.055);sheen.addColorStopRGBA(1,.50,.65,.8,0);cr.setSource(sheen);cr.paint();
    let seed=7;for(let i=0;i<7000;i++){seed=(seed*1664525+1013904223)>>>0;let x=(seed%100000)/100000*w;seed=(seed*1664525+1013904223)>>>0;let y=(seed%100000)/100000*h;circle(cr,x,y,.22,WHITE,.015);}
    cr.restore();
    // Barely visible silver boundary. Bright specular arcs fade around two corners.
    round(cr,1,1,w-2,h-2,20);color(cr,[.63,.74,.86],.04);cr.setLineWidth(.65);cr.stroke();
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        for(const [width,alpha] of [[7,.012],[3,.033],[1.1,.1425]]){
            let edge=new Cairo.RadialGradient(x,y,0,x,y,collapsed?42:62);
            edge.addColorStopRGBA(0,.98,1,1,alpha*strength);edge.addColorStopRGBA(.27,.85,.96,1,alpha*.75*strength);edge.addColorStopRGBA(.66,.58,.80,1,alpha*.15*strength);edge.addColorStopRGBA(1,.45,.65,.85,0);
            round(cr,1.4,1.4,w-2.8,h-2.8,20);cr.setSource(edge);cr.setLineWidth(width);cr.stroke();
        }
    }
}

var apply=function(a){
 if(a.role!=='dashboard'||a._cornerSurfaceFixed)return;
 a._faintEdges=true;a._cornerRestored=true;a._cornerSurfaceFixed=true;Base.panel=faintPanel;
 a._renderer._glass=null;a._renderer._systemGlass=null;
 const St=imports.gi.St,GLib=imports.gi.GLib,Art=a._cardArt||imports.cardRefresh20260913;
 const old=a._glassOverlay;const [w,h]=old.get_size();old.destroy();
 a._glassOverlay=new St.DrawingArea({reactive:false,width:w,height:h});a._root.add_child(a._glassOverlay);
 a._glassOverlay.connect('repaint',area=>{const c=area.get_context();try{c.scale(a.scale,a.scale);c.translate(Art.PAD,Art.PAD);const l=Art.layout(a._state),phase=(GLib.get_monotonic_time()/1e6/48)%1;
 const draw=(h,p)=>{c.pushGroup();c.pushGroup();Art.foreground(c,320,h);c.popGroupToSource();c.paintWithAlpha(.15);corners(c,320,h);Art.animatedEdge(c,h,p);c.popGroupToSource();c.paintWithAlpha(h<=44?.75:1);};
 draw(l.card,phase);c.translate(0,l.system);draw(a._state.systemExpanded?204:44,(phase+.35)%1);
 }finally{c.$dispose();}});
 a._area.queue_repaint();a._glassOverlay.queue_repaint();
};

function corners(cr,w,h){
 // The full light bloom belongs above scenery and the planet footer, not in cached glass.
 cr.save();round(cr,1,1,w-2,h-2,20);cr.clip();
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        let light=new Cairo.RadialGradient(x,y,0,x,y,h<=44?38:52);
        light.addColorStopRGBA(0,.88,.96,1,.57);light.addColorStopRGBA(.16,.76,.9,1,.25);light.addColorStopRGBA(.45,.52,.72,.9,.065);light.addColorStopRGBA(1,.35,.6,.8,0);
        cr.setSource(light);cr.paint();
    }
 cr.restore();
 for(const [x,y]of [[8,8],[w-8,h-8]])for(const [width,alpha]of [[7,.06],[3,.18],[1.1,.8]]){const g=new Cairo.RadialGradient(x,y,0,x,y,h<=44?40:55);g.addColorStopRGBA(0,.98,1,1,alpha);g.addColorStopRGBA(.27,.85,.96,1,alpha*.7);g.addColorStopRGBA(.66,.58,.80,1,alpha*.12);g.addColorStopRGBA(1,.45,.65,.85,0);round(cr,1.4,1.4,w-2.8,h-2.8,20);cr.setSource(g);cr.setLineWidth(width);cr.stroke();}
}
var cornerHighlights=corners;
