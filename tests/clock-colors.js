const GLib=imports.gi.GLib,Cairo=imports.cairo;
const root=ARGV[0],out=ARGV[1];imports.searchPath.unshift(root+'/desklets/silent-horizon@alborz');
const Art=imports.quietHorizonPolish20260911;
function assert(v,m){if(!v)throw Error(m);}
let ink=Art.clockInk('rgb(255, 0, 128)',[0,0,0]);assert(ink[0]===1&&ink[1]===0&&Math.abs(ink[2]-128/255)<.001,'RGB picker syntax');
assert(Art.clockInk('#00ff00',[0,0,0])[1]===1,'Hex picker syntax');
assert(Art.clockInk('invalid',[.1,.2,.3])[0]===.1,'Invalid setting fallback');
assert(Art.clockInk(undefined,[.1,.2,.3])[1]===.2,'Old configuration fallback');
const renderer=new Art.Renderer(root+'/desklets/silent-horizon@alborz');
for(const custom of [false,true]){
 const surface=new Cairo.ImageSurface(Cairo.Format.ARGB32,600,240),cr=new Cairo.Context(surface);
 cr.setSourceRGB(0,0,0);cr.paint();
 const state={headline:'A quieter today',time:'09:35',period:'AM',day:'WEDNESDAY',date:'09.16.26'};
 if(custom)Object.assign(state,{clockHeadlineColor:'#ff0000',clockTimeColor:'#00ff00',clockDateColor:'#ffff00',clockPeriodColor:'#ff00ff'});
 renderer.clock(cr,state);surface.writeToPNG(out+'/'+(custom?'clock-custom':'clock-default')+'.png');cr.$dispose();
}
print('PASS: color parsing and fallback; rendered default and all four custom clock colors');
