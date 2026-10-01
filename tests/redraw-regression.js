// Exercise the production tick with controlled time and Cinnamon adapters.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
let now=Date.parse('2026-09-30T12:00:10Z');
class Clock extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const imports={ui:{desklet:{Desklet:class{}},main:{layoutManager:{primaryMonitor:{x:0,y:0,width:1920,height:1080}}}},gi:{GLib:{DateTime:{new_now_local:()=>({format:()=>''})}}}};
const context=vm.createContext({imports,Date:Clock});
vm.runInContext(fs.readFileSync('desklets/silent-horizon@alborz/desklet.js','utf8'),context);
const Desklet=vm.runInContext('SilentDesklet',context),d=Object.create(Desklet.prototype);
let paints=0;
Object.assign(d,{role:'dashboard',scale:1,_state:{weather:{updated:1},air:{},media:{status:'Playing',position:0,sampled:now/1000,rate:1}},_artPaths:{},_artAccents:{},actor:{get_position:()=>[0,0]},_area:{queue_repaint:()=>paints++},_sunriseMs:0,_sunsetMs:Infinity,_lastMinute:Math.floor(now/60000),_forecastKey:Math.floor(now/60000)+':1',_skyKey:Math.floor(now/600000)+':1'});
d._tick();assert.equal(paints,1);
now+=1000;d._state.media={...d._state.media,sampled:now/1000,position:1};d._tick();assert.equal(paints,1,'Music updates must not repaint weather');
d._state.air={aqi:12};d._tick();assert.equal(paints,2,'New air data must repaint weather');
d.role='music';d._root={height:244};d._spectrum={};d._buttons=[];d.actor.mapped=false;d._stopAudio=()=>{};
d._tick();now+=1000;d._tick();assert.equal(paints,4,'Music progress must keep repainting');
console.log('PASS: weather ignores playback updates, retains data updates, and music progress remains live.');
