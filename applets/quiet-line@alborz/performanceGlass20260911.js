const Cairo=imports.cairo;const TAU=Math.PI*2;const WHITE=[.96,.97,1];
function color(cr,c,a=1){cr.setSourceRGBA(...c,a);}
function circle(cr,x,y,r,c,a=1){cr.newPath();cr.arc(x,y,r,0,TAU);color(cr,c,a);cr.fill();}
function line(cr,x,y,xx,yy,c=WHITE,a=1,w=1){cr.newPath();cr.moveTo(x,y);cr.lineTo(xx,yy);color(cr,c,a);cr.setLineWidth(w);cr.stroke();}
function round(cr,x,y,w,h,r){cr.newPath();cr.arc(x+w-r,y+r,r,-Math.PI/2,0);cr.arc(x+w-r,y+h-r,r,0,Math.PI/2);cr.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);cr.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);cr.closePath();}
var panel=function(cr,w,h,backdrop,scale){
    // The two corner blooms sit outside the glass; its long edges stay quiet.
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        let glow=new Cairo.RadialGradient(x,y,0,x,y,24);
        glow.addColorStopRGBA(0,.68,.88,1,.22);glow.addColorStopRGBA(.45,.48,.76,1,.08);glow.addColorStopRGBA(1,.38,.68,1,0);
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
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        let light=new Cairo.RadialGradient(x,y,0,x,y,52);
        light.addColorStopRGBA(0,.88,.96,1,.57);light.addColorStopRGBA(.16,.76,.9,1,.25);light.addColorStopRGBA(.45,.52,.72,.9,.065);light.addColorStopRGBA(1,.35,.6,.8,0);
        cr.setSource(light);cr.paint();
    }
    let seed=7;for(let i=0;i<2200;i++){seed=(seed*1664525+1013904223)>>>0;let x=(seed%100000)/100000*w;seed=(seed*1664525+1013904223)>>>0;let y=(seed%100000)/100000*h;circle(cr,x,y,.22,WHITE,.015);}
    cr.restore();
    // Barely visible silver boundary. Bright specular arcs fade around two corners.
    round(cr,1,1,w-2,h-2,20);color(cr,[.63,.74,.86],.19);cr.setLineWidth(.65);cr.stroke();
    for(const [x,y] of [[8,8],[w-8,h-8]]){
        for(const [width,alpha] of [[7,.08],[3,.22],[1.1,.95]]){
            let edge=new Cairo.RadialGradient(x,y,0,x,y,62);
            edge.addColorStopRGBA(0,.98,1,1,alpha);edge.addColorStopRGBA(.27,.85,.96,1,alpha*.75);edge.addColorStopRGBA(.66,.58,.80,1,alpha*.15);edge.addColorStopRGBA(1,.45,.65,.85,0);
            round(cr,1.4,1.4,w-2.8,h-2.8,20);cr.setSource(edge);cr.setLineWidth(width);cr.stroke();
        }
    }
}
;
