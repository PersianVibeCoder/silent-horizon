// Native vector icons: the same luminous gradients and soft halos as Quiet Sky weather.
const Cairo=imports.cairo,TAU=Math.PI*2;
function round(c,x,y,w,h,r){c.newPath();c.arc(x+w-r,y+r,r,-Math.PI/2,0);c.arc(x+w-r,y+h-r,r,0,Math.PI/2);c.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);c.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);c.closePath();}
function glow(c,x,y,r,col,a=.30){const g=new Cairo.RadialGradient(x,y,0,x,y,r);g.addColorStopRGBA(0,...col,a);g.addColorStopRGBA(.3,...col,a*.52);g.addColorStopRGBA(.65,...col,a*.14);g.addColorStopRGBA(1,...col,0);c.setSource(g);c.rectangle(x-r,y-r,2*r,2*r);c.fill();}
function paint(c,col){const g=new Cairo.LinearGradient(-8,-10,8,11);g.addColorStopRGB(0,Math.min(1,col[0]+.35),Math.min(1,col[1]+.3),Math.min(1,col[2]+.3));g.addColorStopRGB(.45,...col);g.addColorStopRGB(1,...col.map(v=>v*.53));c.setSource(g);c.fillPreserve();c.setSourceRGBA(.85,.95,1,.4);c.setLineWidth(.6);c.stroke();}
function stroke(c,col,w=1.4,a=.95){c.setSourceRGBA(...col,a);c.setLineWidth(w);c.setLineCap(1);c.stroke();}
var draw=function(c,name,x,y,size=28){
 const colors={CPU:[1,.78,.31],GPU:[.49,.71,1],STORAGE:[.70,.65,1],MEMORY:[.28,.85,.92],NETWORK:[.47,.86,.7],BATTERY:[.49,.88,.74],PERFORMANCE:[.58,.79,1]};const col=colors[name]||colors.PERFORMANCE;
 c.save();c.translate(x,y);c.scale(size/28,size/28);glow(c,0,0,23,col,.32);
 if(name==='CPU'){
  for(const v of [-6,0,6]){c.moveTo(v,-13);c.lineTo(v,-10);c.moveTo(v,10);c.lineTo(v,13);c.moveTo(-13,v);c.lineTo(-10,v);c.moveTo(10,v);c.lineTo(13,v);}stroke(c,col,1.3);
  round(c,-10,-10,20,20,4);paint(c,col);round(c,-5,-5,10,10,2);c.setSourceRGBA(.16,.12,.06,.63);c.fill();c.moveTo(-3,-3);c.lineTo(2,-3);stroke(c,[1,.96,.72],.8,.8);
 }else if(name==='GPU'){
  round(c,-13,-8,26,17,3);paint(c,col);for(const x of [-6,6]){c.arc(x,0,4.7,0,TAU);c.setSourceRGBA(.05,.11,.23,.68);c.fill();for(let i=0;i<4;i++){const a=i*Math.PI/2;c.moveTo(x,0);c.lineTo(x+3*Math.cos(a),3*Math.sin(a));}stroke(c,[.75,.88,1],.8);}
  c.moveTo(-9,11);c.lineTo(7,11);stroke(c,[.88,.78,.43],1.8);
 }else if(name==='STORAGE'){
  round(c,-10,-12,20,24,4);paint(c,col);c.arc(0,-2,6,0,TAU);c.setSourceRGBA(.07,.10,.23,.53);c.fill();c.arc(0,-2,2,0,TAU);c.setSourceRGBA(.82,.85,1,.96);c.fill();c.moveTo(0,-2);c.lineTo(6,4);stroke(c,[.91,.93,1],1.5);c.moveTo(-5,8);c.lineTo(5,8);stroke(c,[.88,.82,.53],1.2);
 }else if(name==='MEMORY'){
  round(c,-13,-7,26,15,2.5);paint(c,col);for(const x of [-8,-2,4]){round(c,x,-4,4,7,1);c.setSourceRGBA(.04,.16,.19,.66);c.fill();}for(const x of [-9,-5,-1,3,7]){c.moveTo(x,9);c.lineTo(x,12);}stroke(c,[.95,.81,.49],1.3);
 }else if(name==='PERFORMANCE'){
  c.arc(0,0,10,0,TAU);paint(c,col);c.arc(0,0,7.6,0,TAU);c.setSourceRGBA(.025,.08,.14,.88);c.fill();c.arc(0,0,7,-Math.PI,-Math.PI*.25);stroke(c,[.61,.86,1],1.3);c.moveTo(0,1);c.lineTo(4,-5);stroke(c,[1,.85,.48],1.6);c.arc(0,1,1.4,0,TAU);c.setSourceRGB(1,.91,.65);c.fill();
 }else if(name==='NETWORK'){
  for(const [r,alpha,w] of [[12,.64,2],[8,.84,2.4]]){c.newPath();c.arc(0,6,r,1.2*Math.PI,1.8*Math.PI);stroke(c,col,w,alpha);}c.newPath();c.arc(0,6,2.6,0,TAU);paint(c,col);
  if(name==='PERFORMANCE'){c.newPath();c.arc(0,1,11,.1*Math.PI,.9*Math.PI);stroke(c,col,1.2,.55);c.moveTo(0,2);c.lineTo(5,-6);stroke(c,[.97,.88,.62],1.5);}
 }else if(name==='BATTERY'){
  round(c,-7,-10,14,22,3);paint(c,col);round(c,-3,-13,6,3,1);c.setSourceRGBA(...col,.9);c.fill();c.moveTo(1,-6);c.lineTo(-3,1);c.lineTo(1,1);c.lineTo(-1,7);c.lineTo(4,-1);c.lineTo(0,-1);c.closePath();c.setSourceRGBA(.92,1,.92,.95);c.fill();
 }
 c.restore();
};
var battery=function(c,percent){
 glow(c,34,74,64,[.36,.77,.87],.19);
 round(c,9,10,50,126,13);const shell=new Cairo.LinearGradient(9,10,59,136);shell.addColorStopRGBA(0,.72,.91,1,.65);shell.addColorStopRGBA(.35,.29,.46,.58,.20);shell.addColorStopRGBA(1,.49,.81,.89,.52);c.setSource(shell);c.setLineWidth(1.4);c.stroke();
 round(c,25,4,18,5,2);c.setSourceRGBA(.62,.82,.88,.7);c.fill();
 if(percent!=null){c.save();round(c,14,15,40,116,9);c.clip();const h=116*Math.max(0,Math.min(percent,100))/100;const g=new Cairo.LinearGradient(14,131-h,53,131);g.addColorStopRGBA(0,.69,.98,.88,.88);g.addColorStopRGBA(.3,.33,.83,.76,.75);g.addColorStopRGBA(1,.12,.43,.56,.65);c.setSource(g);c.rectangle(14,131-h,40,h);c.fill();c.restore();}
};
