/* Forecast interpretation kept independent from drawing and network IO. */
var valid=n=>typeof n==='number'&&Number.isFinite(n);
var hourLabel=function(epoch){let d=new Date(epoch*1000),h=d.getHours();return (h%12||12)+(d.getMinutes()?':'+String(d.getMinutes()).padStart(2,'0'):'')+' '+(h<12?'AM':'PM');};
var rangeLabel=function(start,end){const a=hourLabel(start),b=hourLabel(end);return (a.slice(-2)===b.slice(-2)?a.replace(/ (AM|PM)$/,''):a)+'–'+b;};
var timeLabel=function(epoch){if(!valid(epoch))return '—';let d=new Date(epoch*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
var sample=function(hourly,key,epoch){
    if(!hourly||!hourly.time||!hourly[key])return null;
    const ts=hourly.time,vs=hourly[key];
    if(epoch<ts[0]||epoch>ts[ts.length-1])return null;
    let i=ts.findIndex(t=>t>=epoch);
    if(i<0||!valid(vs[i]))return null;
    if(ts[i]===epoch||i===0)return vs[i];
    if(!valid(vs[i-1]))return null;
    const f=(epoch-ts[i-1])/(ts[i]-ts[i-1]);return vs[i-1]+f*(vs[i]-vs[i-1]);
};
var forecast=function(weather,now){
    const epoch=now.getTime()/1000,h=weather&&weather.hourly;
    const points=[0,2,4,6].map((offset,i)=>{let t=i?Math.floor(epoch/3600)*3600+offset*3600:epoch;return {epoch:t,label:i?hourLabel(t):'NOW',value:i?sample(h,'temperature_2m',t):weather&&valid(weather.current.temperature_2m)?weather.current.temperature_2m:sample(h,'temperature_2m',t)};});
    const hours=[epoch,...Array.from({length:6},(_,i)=>Math.ceil(epoch/3600)*3600+i*3600)];
    const rains=hours.map(t=>sample(h,'precipitation_probability',t)).filter(valid);
    const temps=hours.map(t=>({epoch:t,value:sample(h,'temperature_2m',t)})).filter(p=>valid(p.value));
    const peak=temps.reduce((a,b)=>!a||b.value>a.value?b:a,null);
    return {points,rain:rains.length?Math.max(...rains):null,peak,uv:sample(h,'uv_index',epoch)};
};
var aqiLabel=function(n){return !valid(n)?'UNAVAILABLE':n<=50?'GOOD':n<=100?'MODERATE':n<=150?'SENSITIVE':n<=200?'UNHEALTHY':n<=300?'VERY HIGH':'HAZARDOUS';};
var tonight=function(A,weather,now,latitude,longitude,elevation){
    const observer=new A.Observer(latitude,longitude,elevation);
    const start=new Date(now);start.setHours(12,0,0,0);if(now.getHours()<6)start.setDate(start.getDate()-1);
    const epoch=t=>t?t.date.getTime()/1000:null;
    const sunset=epoch(A.SearchRiseSet('Sun',observer,-1,start,1));
    const dark=epoch(A.SearchAltitude('Sun',observer,-1,start,1,-18));
    const dawn=dark?epoch(A.SearchAltitude('Sun',observer,1,new Date((dark+60)*1000),1,-18)):null;
    let best=null;
    if(dark&&dawn){
        for(let t=Math.ceil(Math.max(dark,now.getTime()/1000)/3600)*3600;t+7200<=dawn;t+=3600){
            const clouds=[.5,1,1.5].map(h=>sample(weather&&weather.hourly,'cloud_cover',t+h*3600));
            if(clouds.some(c=>!valid(c)))continue;
            const cloud=clouds.reduce((a,b)=>a+b)/clouds.length,date=new Date((t+3600)*1000);
            const e=A.Equator('Moon',date,observer,true,true),alt=A.Horizon(date,observer,e.ra,e.dec,'normal').altitude;
            const fraction=A.Illumination('Moon',date).phase_fraction;
            const score=cloud+Math.max(0,Math.sin(alt*Math.PI/180))*fraction*25;
            if(!best||score<best.score-.5)best={start:t,end:t+7200,cloud,score};
        }
    }
    let subtitle=!best?'Forecast unavailable':best.cloud<20?'Mostly clear after dusk':best.cloud<50?'Some clouds in the best window':best.cloud<75?'Clouds may limit the view':'Heavy cloud cover tonight';
    const range=best?rangeLabel(best.start,best.end):null;
    return {sunset,dark,dawn,best,subtitle,title:best?'Best sky · '+range:'Tonight’s sky',moonEpoch:best?(best.start+best.end)/2:dark||start.getTime()/1000};
};
