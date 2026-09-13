// Quiet Sky / Luminous Weather. Resolution-independent Cairo artwork.
const Cairo=imports.cairo;
const TAU=Math.PI*2;
function circle(c,x,y,r){c.newPath();c.arc(x,y,r,0,TAU);}
function glow(c,x,y,r,rgb,alpha=.35){
 const g=new Cairo.RadialGradient(x,y,0,x,y,r);
 g.addColorStopRGBA(0,...rgb,alpha);g.addColorStopRGBA(.3,...rgb,alpha*.52);g.addColorStopRGBA(.65,...rgb,alpha*.14);g.addColorStopRGBA(1,...rgb,0);
 c.setSource(g);c.rectangle(x-r,y-r,2*r,2*r);c.fill();
}
function stroke(c,rgb,width=1.8,alpha=1){c.setSourceRGBA(...rgb,alpha);c.setLineWidth(width);c.setLineCap(Cairo.LineCap.ROUND);c.stroke();}
function sun(c,x,y,r){
 const halo=new Cairo.RadialGradient(x,y,0,x,y,r*4);
 halo.addColorStopRGBA(0,1,.91,.55,.7);halo.addColorStopRGBA(.24,1,.74,.21,.34);halo.addColorStopRGBA(.56,1,.57,.14,.09);halo.addColorStopRGBA(1,1,.5,.08,0);
 c.setSource(halo);c.rectangle(x-r*4,y-r*4,r*8,r*8);c.fill();
 const core=new Cairo.RadialGradient(x-r*.2,y-r*.2,0,x,y,r);
 core.addColorStopRGB(0,1,1,.90);core.addColorStopRGB(.64,1,.92,.55);core.addColorStopRGBA(1,1,.72,.22,.9);c.setSource(core);circle(c,x,y,r);c.fill();
}
function moon(c,x,y,r){
 glow(c,x-4,y+2,r*3.7,[.47,.65,1],.42);
 // A true transparent crescent: the cutout never paints a dark disc over glass.
 c.pushGroup();const g=new Cairo.RadialGradient(x-r*.5,y-r*.4,0,x,y,r*1.4);
 g.addColorStopRGB(0,1,1,1);g.addColorStopRGB(.42,.85,.94,1);g.addColorStopRGB(1,.40,.62,1);
 c.setSource(g);circle(c,x,y,r);c.fill();
 c.setOperator(Cairo.Operator.CLEAR);circle(c,x+r*.49,y-r*.32,r*.94);c.fill();
 c.setOperator(Cairo.Operator.OVER);c.popGroupToSource();c.paint();
 glow(c,x-r*.6,y+r*.12,r*.75,[.72,.85,1],.17);
}
function cloud(c,x,y,heavy=false){
 glow(c,x,y+8,47,[.30,.48,1],heavy?.23:.35);
 // One continuous silhouette avoids the stacked bubble look.
 c.newPath();c.moveTo(x-23,y+17);c.curveTo(x-41,y+15,x-36,y-9,x-19,y-8);
 c.curveTo(x-13,y-31,x+17,y-27,x+21,y-8);c.curveTo(x+42,y-9,x+43,y+17,x+23,y+18);c.closePath();
 const g=new Cairo.LinearGradient(x-12,y-25,x+12,y+24);
 g.addColorStopRGB(0,...(heavy?[.70,.79,.92]:[.99,.99,1]));
 g.addColorStopRGB(.4,...(heavy?[.40,.53,.72]:[.73,.85,1]));g.addColorStopRGB(1,...(heavy?[.19,.28,.46]:[.28,.46,.88]));c.setSource(g);c.fillPreserve();
 stroke(c,[.78,.88,1],.65,.30);
}
function rain(c,kind){
 const count=kind==='drizzle'?3:5;
 glow(c,0,30,25,[.20,.70,1],.14);
 for(let i=0;i<count;i++){const x=(i-(count-1)/2)*10,y=25+(i%2)*4;
 c.newPath();c.moveTo(x+2,y);c.lineTo(x-1,y+(kind==='drizzle'?4:9));stroke(c,[.40,.81,1],kind==='drizzle'?1.25:1.8,.9);}
}
function snow(c,sleet=false){
 for(const x of [-19,0,19]){const y=30+(x===0?5:0);glow(c,x,y,9,[.58,.81,1],.22);
 if(sleet&&x===0){c.newPath();c.moveTo(x+2,y-4);c.lineTo(x-2,y+4);stroke(c,[.4,.8,1],1.7);continue;}
 for(let i=0;i<3;i++){const a=i*Math.PI/3;c.newPath();c.moveTo(x-4*Math.cos(a),y-4*Math.sin(a));c.lineTo(x+4*Math.cos(a),y+4*Math.sin(a));stroke(c,[.84,.94,1],1.2);}}
}
function wind(c){
 glow(c,6,22,38,[.57,.77,1],.13);
 for(const [x,y,w] of [[-27,15,47],[-21,24,59],[-30,33,38]]){
 c.newPath();c.moveTo(x,y);c.curveTo(x+w*.35,y-1,x+w*.75,y+2,x+w,y);c.curveTo(x+w+9,y-2,x+w+5,y-10,x+w-1,y-7);stroke(c,[.72,.87,1],1.6,.85);}
}
var classify=function(code,windKmh=0){
 if(!Number.isFinite(code))return 'unknown';
 if(code===0)return windKmh>=25?'wind':'clear';
 if(code===1||code===2)return windKmh>=25?'wind-cloud':'partly';
 if(code===3)return windKmh>=25?'wind-overcast':'cloud';
 if(code===45||code===48)return 'fog';
 if([56,57,66,67].includes(code))return 'sleet';
 if([51,53,55].includes(code))return 'drizzle';
 if([61,63,65,80,81,82].includes(code))return 'rain';
 if([71,73,75,77,85,86].includes(code))return 'snow';
 if(code===95)return 'storm';if(code===96||code===99)return 'hail';
 return 'unknown';
};
var draw=function(c,x,y,kind,day=true,scale=1){
 c.save();c.translate(x,y);c.scale(scale,scale);
 if(kind==='clear'){if(day)sun(c,0,0,20);else moon(c,0,0,20);}
 else if(kind==='wind'){if(day)sun(c,-5,-10,17);else moon(c,-5,-10,18);wind(c);}
 else if(kind==='unknown'){
  c.setSourceRGBA(.71,.8,.9,.6);circle(c,0,0,3);c.fill();
 }else{
  if(['partly','wind-cloud'].includes(kind)){if(day)sun(c,-12,-13,18);else moon(c,-12,-13,19);}
  if(kind==='fog'){
   cloud(c,0,-7,false);
   for(let i=0;i<3;i++){const y=16+i*8;c.newPath();c.moveTo(-27+i*3,y);c.lineTo(28-i*3,y);stroke(c,[.74,.84,.96],2,.64-i*.1);}
  }else{
   cloud(c,0,kind==='cloud'||kind==='partly'?-1:-7,['storm','hail','rain','sleet'].includes(kind));
   if(kind==='rain'||kind==='drizzle')rain(c,kind);
   if(kind==='snow'||kind==='sleet')snow(c,kind==='sleet');
   if(kind==='wind-cloud'||kind==='wind-overcast')wind(c);
   if(kind==='storm'||kind==='hail'){
    glow(c,1,23,23,[1,.76,.35],.30);
    c.newPath();c.moveTo(1,9);c.lineTo(-8,25);c.lineTo(0,25);c.lineTo(-4,39);c.lineTo(13,18);c.lineTo(4,18);c.lineTo(8,9);c.closePath();
    const g=new Cairo.LinearGradient(0,9,0,39);g.addColorStopRGB(0,1,.98,.76);g.addColorStopRGB(1,1,.66,.20);c.setSource(g);c.fill();
    if(kind==='hail')for(const x of [-22,23]){glow(c,x,29,9,[.65,.85,1],.24);circle(c,x,29,2.7);c.setSourceRGB(.85,.94,1);c.fill();}
   }
  }
 }
 c.restore();
};
