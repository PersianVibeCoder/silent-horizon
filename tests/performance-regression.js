// Offline CJS checks: Cairo output, real async decoding, and solar-cache boundaries.
// cjs tests/performance-regression.js /absolute/project /temporary/output-directory
const {GLib,Gio}=imports.gi,Cairo=imports.cairo,ByteArray=imports.byteArray;
const root=ARGV[0],out=ARGV[1],folder=root+'/desklets/silent-horizon@alborz';
imports.searchPath.unshift(folder);
const Base=imports.quietHorizonPolish20260911,Art=imports.cardRefresh20260913;
function check(value,message){if(!value)throw Error(message);}
const source=ByteArray.toString(GLib.file_get_contents(folder+'/cardGlowAligned20260913.js')[1]);
let now=123456789000;
class Area {
 constructor(props={}){Object.assign(this,props);}
 get_size(){return [this.width,this.height];}
 connect(_name,fn){this.repaint=fn;}
 get_context(){return new Cairo.Context(this.surface);}
 queue_repaint(){}
 destroy(){}
}
const fake={quietHorizonPolish20260911:Base,cairo:Cairo,gi:{versions:{},Gdk:imports.gi.Gdk,St:{DrawingArea:Area},GLib:{get_monotonic_time:()=>now}}};
const glow=new Function('imports',source+';return {apply,cornerHighlights};')(fake);
let cases=0;
for(const scale of [1,1.1,1.53])for(const expanded of [false,true])for(const systemExpanded of [false,true]){
 const state={weatherExpanded:expanded,systemExpanded},l=Art.layout(state);
 const w=Math.ceil((320+Art.PAD*2)*scale),h=Math.ceil(l.height*scale);
 const a={role:'dashboard',scale,_state:state,_renderer:{},_cardArt:Art,_glassOverlay:new Area({width:w,height:h}),_root:{add_child(){}},_area:{queue_repaint(){}}};
 glow.apply(a);
 for(let frame=0;frame<2;frame++){
  now+=170000;const phase=(now/1e6/48)%1;
  const expected=new Cairo.ImageSurface(Cairo.Format.ARGB32,w,h),c=new Cairo.Context(expected);
  c.scale(scale,scale);c.translate(Art.PAD,Art.PAD);
  const draw=(height,p)=>{c.pushGroup();c.pushGroup();Art.foreground(c,320,height);c.popGroupToSource();c.paintWithAlpha(.15);glow.cornerHighlights(c,320,height);Art.animatedEdge(c,height,p);c.popGroupToSource();c.paintWithAlpha(height<=44?.75:1);};
  draw(l.card,phase);c.translate(0,l.system);draw(systemExpanded?204:44,(phase+.35)%1);c.$dispose();
  a._glassOverlay.surface=new Cairo.ImageSurface(Cairo.Format.ARGB32,w,h);
  a._glassOverlay.repaint(a._glassOverlay);
  expected.writeToPNG(out+'/expected-'+cases+'.png');a._glassOverlay.surface.writeToPNG(out+'/actual-'+cases+'.png');cases++;
 }
}
print('Rendered '+cases+' original/cached glow comparisons, including fractional scales and cache reuse.');
const A=imports.vendor.astronomy.Astronomy;
const cardSource=ByteArray.toString(GLib.file_get_contents(folder+'/cardRefresh20260913.js')[1]);
const cacheFunction=cardSource.slice(cardSource.indexOf('function cachedSolarEvents'),cardSource.indexOf('var solarEvents=function'));
const cached=new Function('solarEvents',cacheFunction+';return cachedSolarEvents;')(Art.solarEvents);
for(const [latitude,longitude] of [[51.5,-.1],[0,0],[80,0]]){
 const a={A,latitude,longitude,elevation:0,_state:{sunAltitude:10}};
 const start=new Date('2026-09-30T12:00:00Z');
 const first=cached(a,start),cache=a._solarCache;
 const later=new Date(start.getTime()+60000),second=cached(a,later),fresh=Art.solarEvents(A,later,latitude,longitude,0);
 check(a._solarCache===cache,'Minute update should reuse event searches');
 for(const name of ['sunrise','sunset','dark','dawn'])check(second[name]===null&&fresh[name]===null||Math.abs(second[name]-fresh[name])<2,'Event accuracy: '+name);
 cached(a,new Date(cache.until+1000));check(a._solarCache!==cache,'Event expiry');
 const after=a._solarCache;cached(a,start);check(a._solarCache!==after,'Clock rollback');
 const old=a._solarCache;a.latitude-=1;cached(a,start);check(a._solarCache!==old,'Location invalidation');
}
print('PASS: real astronomy cache accuracy, expiry, polar conditions, rollback and location changes.');
const renderer=new Base.Renderer(folder),path=folder+'/assets/horizon-day.png';
const loop=new GLib.MainLoop(null,false);let ready=0,timedOut=false;
renderer.onImageReady=()=>{ready++;loop.quit();};
check(renderer._image(path)===null,'Image load must not block');
check(renderer._image(path)===null&&renderer._images.size===1,'Pending requests coalesce');
const timeout=GLib.timeout_add(GLib.PRIORITY_DEFAULT,5000,()=>{timedOut=true;loop.quit();return false;});loop.run();
if(!timedOut)GLib.source_remove(timeout);
check(!timedOut&&ready===1&&renderer._image(path).width>0,'Async decode completes and caches');
renderer.destroy();check(renderer._image(path)===null,'Disposed renderer cannot restart IO');
print('PASS: real asynchronous image decoding, coalescing, caching and disposal.');
