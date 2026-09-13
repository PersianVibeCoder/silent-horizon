/* Offline observer-based lunar geometry, Astronomy Engine 2.1.19. */
const A = imports.vendor.astronomy.Astronomy;
const RAD = Math.PI / 180;
function xyz(v) { return [v.x,v.y,v.z]; }
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function sub(a,b) { return a.map((v,i)=>v-b[i]); }
function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function unit(a) { let n=Math.hypot(...a); return a.map(v=>v/n); }
function neg(a) { return a.map(v=>-v); }
function phaseName(degrees) {
    if(degrees<2 || degrees>358) return 'New Moon';
    if(Math.abs(degrees-90)<2) return 'First Quarter';
    if(Math.abs(degrees-180)<2) return 'Full Moon';
    if(Math.abs(degrees-270)<2) return 'Last Quarter';
    return degrees<90?'Waxing Crescent':degrees<180?'Waxing Gibbous':degrees<270?'Waning Gibbous':'Waning Crescent';
}

var calculate = function(date,latitude,longitude,elevation,orientation) {
    const t=A.MakeTime(date);
    const observer=new A.Observer(latitude,longitude,elevation);
    const moon=xyz(A.GeoVector('Moon',t,true));
    const sun=xyz(A.GeoVector('Sun',t,true));
    const eye=xyz(A.ObserverVector(t,observer,false));
    const sight=unit(sub(moon,eye));
    const towardEye=neg(sight);
    const light=unit(sub(sun,moon));
    const celestialNorth=xyz(A.RotateVector(A.Rotation_EQD_EQJ(t),new A.Vector(0,0,1,t)));
    const zenith=xyz(A.RotateVector(A.Rotation_HOR_EQJ(t,observer),new A.Vector(0,0,1,t)));
    let referenceUp=orientation==='north-up'?celestialNorth:zenith;
    // Exactly at zenith/nadir, roll has no unique definition. Use north-up.
    let right=cross(sight,referenceUp);
    if(Math.hypot(...right)<1e-8) right=cross(sight,celestialNorth);
    right=unit(right);
    const up=unit(cross(right,sight));
    const down=neg(up);
    const north=unit(xyz(A.RotationAxis('Moon',t).north));
    const earthDirection=unit(neg(moon));
    const east=unit(cross(north,earthDirection));
    const centralMeridian=unit(cross(east,north));
    const projected=v=>[dot(v,right),dot(v,down),dot(v,towardEye)];
    const fraction=(1+dot(light,towardEye))/2;
    const eq=A.Equator('Moon',t,observer,true,true);
    const horizon=A.Horizon(t,observer,eq.ra,eq.dec,'normal');
    const libration=A.Libration(t);
    const phase=A.MoonPhase(t);
    return {
        timestamp:date.toISOString(), name:phaseName(phase), phase,
        fraction:Math.max(0,Math.min(1,fraction)),
        geocentricFraction:A.Illumination('Moon',t).phase_fraction,
        altitude:horizon.altitude, azimuth:horizon.azimuth,
        light:projected(light), east:projected(east), north:projected(north),
        centralMeridian:projected(centralMeridian), longitude:libration.elon*RAD
    };
};

var satelliteAngle = function(hour,minute,second) {
    // 24 at bottom, 06 left, 12 top, 18 right: one clockwise turn per day.
    return 90+(hour+minute/60+second/3600)*15;
};

var alignmentPosition = function(monitor,width,height,alignment,margin,offsetX,offsetY) {
    let x=monitor.x+(monitor.width-width)/2;
    let y=monitor.y+(monitor.height-height)/2;
    if(alignment.includes('left')) x=monitor.x+margin;
    if(alignment.includes('right')) x=monitor.x+monitor.width-width-margin;
    if(alignment.includes('top')) y=monitor.y+margin;
    if(alignment.includes('bottom')) y=monitor.y+monitor.height-height-margin;
    // If a display is smaller than the widget, keep its upper-left reachable.
    return [Math.round(Math.max(monitor.x,x)+offsetX),Math.round(Math.max(monitor.y,y)+offsetY)];
};
