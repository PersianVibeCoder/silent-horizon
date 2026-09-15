const Cairo=imports.cairo;
const Pango=imports.gi.Pango;
const PangoCairo=imports.gi.PangoCairo;
const GdkPixbuf=imports.gi.GdkPixbuf;
imports.gi.versions.Gdk='3.0';
const Gdk=imports.gi.Gdk;
const TAU=Math.PI*2;
const Data=imports.quietHorizonData20260911;
const WHITE=[.96,.97,1], CYAN=[.27,.9,1], BLUE=[.24,.55,1], GOLD=[1,.79,.28], MUTED=[.71,.75,.83];
var SIZES={clock:[600,360],dashboard:[344,634],music:[344,244]};
function color(cr,c,a=1){cr.setSourceRGBA(...c,a);}
function circle(cr,x,y,r,c,a=1){cr.newPath();cr.arc(x,y,r,0,TAU);color(cr,c,a);cr.fill();}
function line(cr,x,y,xx,yy,c=WHITE,a=1,w=1){cr.newPath();cr.moveTo(x,y);cr.lineTo(xx,yy);color(cr,c,a);cr.setLineWidth(w);cr.stroke();}
function round(cr,x,y,w,h,r){cr.newPath();cr.arc(x+w-r,y+r,r,-Math.PI/2,0);cr.arc(x+w-r,y+h-r,r,0,Math.PI/2);cr.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);cr.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);cr.closePath();}
function text(cr,t,x,y,size=13,c=WHITE,spacing=0,font='Inter Regular',width=0,align='left'){
    const p=PangoCairo.create_layout(cr), f=Pango.FontDescription.from_string(font);
    f.set_absolute_size(size*Pango.SCALE);p.set_font_description(f);p.set_text(String(t),-1);
    const attrs=new Pango.AttrList();attrs.insert(Pango.attr_letter_spacing_new(Math.round(spacing*Pango.SCALE)));p.set_attributes(attrs);
    if(width){p.set_width(width*Pango.SCALE);p.set_ellipsize(Pango.EllipsizeMode.END);p.set_single_paragraph_mode(true);}
    const [w,h]=p.get_pixel_size();cr.moveTo(align==='center'?x-w/2:align==='right'?x-w:x,y-h/2);color(cr,c);PangoCairo.show_layout(cr,p);
    return w;
}
function heading(cr,t,x,y){text(cr,t,x,y,11,CYAN,2.6,'Inter Medium');}
function panel(cr,w,h,backdrop,scale){
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
    let seed=7;for(let i=0;i<7000;i++){seed=(seed*1664525+1013904223)>>>0;let x=(seed%100000)/100000*w;seed=(seed*1664525+1013904223)>>>0;let y=(seed%100000)/100000*h;circle(cr,x,y,.22,WHITE,.015);}
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

function dots(cr,x,y){for(let i=0;i<3;i++)circle(cr,x+i*6,y,1.35,WHITE);}
function pin(cr,x,y){cr.save();cr.translate(x,y);color(cr,WHITE);cr.moveTo(0,7);cr.curveTo(-1,4,-5,0,-5,-2);cr.arc(0,-2,5,Math.PI,0);cr.curveTo(5,0,1,4,0,7);cr.fill();circle(cr,0,-2,2,[.03,.04,.08]);cr.restore();}
function sun(cr,x,y,r=16,night=false){
    if(night){circle(cr,x,y,r,WHITE);circle(cr,x+7,y-5,r,[.02,.035,.07]);return;}
    let g=new Cairo.RadialGradient(x,y,2,x,y,r*2.2);g.addColorStopRGBA(0,1,.67,.15,.3);g.addColorStopRGBA(1,1,.65,.1,0);cr.setSource(g);cr.arc(x,y,r*2.2,0,TAU);cr.fill();
    for(let i=0;i<8;i++){let a=i*TAU/8;line(cr,x+Math.cos(a)*(r+6),y+Math.sin(a)*(r+6),x+Math.cos(a)*(r+15),y+Math.sin(a)*(r+15),GOLD,1,2.6);}
    let sg=new Cairo.LinearGradient(x-r,y-r,x+r,y+r);sg.addColorStopRGB(0,1,.88,.4);sg.addColorStopRGB(1,1,.7,.22);cr.setSource(sg);cr.arc(x,y,r,0,TAU);cr.fill();
}
function sunrise(cr,x,y){
    cr.newPath();cr.arc(x,y+5,12,Math.PI,TAU);cr.setLineWidth(1.5);color(cr,GOLD);cr.stroke();
    for(let i=0;i<5;i++){let a=Math.PI+i*Math.PI/4;line(cr,x+Math.cos(a)*18,y+5+Math.sin(a)*18,x+Math.cos(a)*23,y+5+Math.sin(a)*23,GOLD,.95,1.4);}
    line(cr,x-20,y+8,x+20,y+8,GOLD,1,1.4);line(cr,x-13,y+12,x+13,y+12,GOLD,.8,1);
}
function weatherName(code,day){
    if(code===0)return day?'Clear':'Clear night';if([56,57].includes(code))return 'Freezing drizzle';if([66,67].includes(code))return 'Freezing rain';if([96,99].includes(code))return 'Storm / hail';if(code<=2)return 'Partly cloudy';if(code===3)return 'Overcast';if(code<=48)return 'Fog';if(code<=57)return 'Drizzle';if(code<=67)return 'Rain';if(code<=77)return 'Snow';if(code<=82)return 'Showers';if(code<=86)return 'Snow showers';return 'Thunderstorms';
}
function weatherIcon(cr,x,y,code,day){
    if(code===0){sun(cr,x,y,16,!day);return;}
    if(code<=2)sun(cr,x-8,y-6,12,!day);
    for(let [xx,yy,r] of [[-16,6,11],[0,-1,16],[17,7,12]])circle(cr,x+xx,y+yy,r,[.72,.83,.93]);
    round(cr,x-24,y+6,48,13,6);color(cr,[.72,.83,.93]);cr.fill();
    if(code>=51)for(let i=-1;i<=1;i++)line(cr,x+i*12+2,y+25,x+i*12-2,y+32,CYAN,.9,1.7);
}
function lightBall(cr,x,y,r){
    let halo=new Cairo.RadialGradient(x,y,0,x,y,r*4);
    halo.addColorStopRGBA(0,1,.91,.55,.7);halo.addColorStopRGBA(.24,1,.74,.21,.34);halo.addColorStopRGBA(.56,1,.57,.14,.09);halo.addColorStopRGBA(1,1,.5,.08,0);
    cr.setSource(halo);cr.rectangle(x-r*4,y-r*4,r*8,r*8);cr.fill();
    let core=new Cairo.RadialGradient(x-r*.2,y-r*.2,0,x,y,r);
    core.addColorStopRGB(0,1,1,.90);core.addColorStopRGB(.64,1,.92,.55);core.addColorStopRGBA(1,1,.72,.22,.9);cr.setSource(core);cr.arc(x,y,r,0,TAU);cr.fill();
}
function softWeather(cr,x,y,code,day,scale=1,windKmh=0){
    imports.weatherLights20260910.draw(cr,x,y,imports.weatherLights20260910.classify(code,windKmh),!!day,scale);
}
function fmt(seconds){if(!Number.isFinite(seconds))return '—';seconds=Math.max(0,Math.floor(seconds));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}

var horizonY=function(x){const t=(x-836)/836;return 941*(0.7812960045424109+0.5881040938892211*t*t+0.16133100934979638*Math.pow(t,4)+0.193304772081001*Math.pow(t,6))-70-480;};
var skyPalette=function(alt){
    const stops=[
        [-18,[.015,.025,.055],[.055,.18,.42],[.022,.055,.15],[.006,.012,.027]],
        [-6,[.045,.07,.18],[.36,.25,.44],[.08,.10,.20],[.025,.035,.075]],
        [0,[.12,.24,.43],[.88,.52,.29],[.18,.20,.29],[.065,.085,.14]],
        [12,[.08,.30,.58],[.45,.67,.81],[.17,.30,.42],[.045,.12,.20]],
        [60,[.06,.28,.56],[.42,.67,.85],[.15,.29,.40],[.035,.10,.18]]
    ];
    let a=stops[0],b=a;for(let i=1;i<stops.length;i++){b=stops[i];if(alt<=b[0])break;a=b;}
    const t=a===b?0:Math.max(0,Math.min(1,(alt-a[0])/(b[0]-a[0])));
    const mix=i=>a[i].map((v,j)=>v+(b[i][j]-v)*t);
    return {top:mix(1),bottom:mix(2),far:mix(3),near:mix(4),stars:Math.max(0,Math.min(1,(-alt-5)/10)),day:Math.max(0,Math.min(1,(alt+6)/18))};
};
var drawEdge=function(cr,scale,width,height,phase){
    cr.save();cr.scale(scale,scale);cr.translate(12,12);
    const w=width/scale-24,h=height/scale-24,perimeter=2*(w+h),d=phase*perimeter;
    let x,y;if(d<w){x=d;y=1;}else if(d<w+h){x=w-1;y=d-w;}else if(d<2*w+h){x=2*w+h-d;y=h-1;}else{x=1;y=perimeter-d;}
    for(const [thick,opacity] of [[7,.025],[3,.06],[.9,.28]]){
        const g=new Cairo.RadialGradient(x,y,0,x,y,66);g.addColorStopRGBA(0,.64,.86,1,opacity);g.addColorStopRGBA(.4,.45,.72,1,opacity*.5);g.addColorStopRGBA(1,.40,.65,1,0);
        round(cr,1.4,1.4,w-2.8,h-2.8,20);cr.setSource(g);cr.setLineWidth(thick);cr.stroke();
    }
    cr.restore();
};
var Renderer=class Renderer {
    constructor(path){this.path=path;this.texture=null;this.art=null;this.artPath='';this._moonKey='';}
    image(cr,path,x,y,w,h,r=6){
        try{
            if(this.artPath!==path){this.art=GdkPixbuf.Pixbuf.new_from_file(path);this.artPath=path;}
            let p=this.art, scale=Math.max(w/p.width,h/p.height);
            cr.save();round(cr,x,y,w,h,r);cr.clip();cr.translate(x+(w-p.width*scale)/2,y+(h-p.height*scale)/2);cr.scale(scale,scale);Gdk.cairo_set_source_pixbuf(cr,p,0,0);cr.paint();cr.restore();
        }catch(e){this.artPath='';}
    }
    moon(cr,moon,x,y,d,scale){
        if(!moon)return;
        if(!this.texture){this.texture=GdkPixbuf.Pixbuf.new_from_file(this.path+'/assets/lroc-color.jpg');this.texturePixels=this.texture.get_pixels();}
        this._paintMoon(cr,moon,scale,x,y,d);
    }
    draw(cr,scale,state){cr.save();cr.scale(scale,scale);cr.setLineCap(Cairo.LineCap.ROUND);
        if(state.role==='clock')this.clock(cr,state);
        else {cr.translate(12,12);if(state.role==='music')this.music(cr,state,scale);else this.dashboard(cr,state,scale);}
        cr.restore();
    }
    clock(cr,s){
        // Horizon Verse: align visible letterforms rather than font line boxes.
        // Use the fonts' native proportions and spacing; never squeeze digit outlines.
        const ivory=[.965,.953,.91],blue=[.43,.69,.86],periodBlue=[.52,.68,.78];
        const label=(value,x,y,size,font,ink,maxWidth,spacing=0,align='left',tabular=false)=>{
            const p=PangoCairo.create_layout(cr),f=Pango.FontDescription.from_string(font);
            f.set_absolute_size(size*Pango.SCALE);p.set_font_description(f);
            p.set_text(String(value),-1);p.set_single_paragraph_mode(true);
            const attrs=new Pango.AttrList();
            attrs.insert(Pango.attr_letter_spacing_new(Math.round(spacing*Pango.SCALE)));
            if(tabular)attrs.insert(Pango.attr_font_features_new('lnum=1,pnum=1'));
            p.set_attributes(attrs);
            const [bounds]=p.get_pixel_extents();
            const fit=Math.min(1,maxWidth/Math.max(1,bounds.width));
            const left=align==='center'?x-bounds.width*fit/2:align==='right'?x-bounds.width*fit:x;
            cr.save();cr.translate(left,y);cr.scale(fit,fit);
            cr.moveTo(-bounds.x,-bounds.y);color(cr,ink);PangoCairo.show_layout(cr,p);cr.restore();
            return bounds.width*fit;
        };
        let quote=String(s.headline||'A quieter today').trim().replace(/\s+/g,' ');
        if(quote.toUpperCase()==='A QUIETER TODAY')quote='A quieter today';
        const split=quote.lastIndexOf(' ');
        const lead=split<0?'':quote.slice(0,split),last=split<0?quote:quote.slice(split+1);
        label(lead,92,46,32,'Silent Horizon Lead',ivory,155);
        label(last,90,81,60,'Silent Horizon Today Italic',ivory,155);
        const timeWidth=label(s.time,382,39,114,'Silent Horizon Time',ivory,300,-4,'center',true);
        if(s.period)label(s.period,382+timeWidth/2,127,20,'Silent Horizon Time',periodBlue,52,1,'right');
        label(s.day+' / '+s.date,300,174,10,'Silent Horizon Date',blue,400,3.2,'center');
    }
    glass(cr,s,scale,height){
        const spec=s.backdrop,key=JSON.stringify([scale,spec,height]);
        if(!this._glass||this._glassKey!==key){
            this._glassKey=key;let backdrop=null;
            if(spec&&spec.path){try{if(this._backdropPath!==spec.path){this._backdropPixbuf=GdkPixbuf.Pixbuf.new_from_file(spec.path);this._backdropPath=spec.path;}backdrop=Object.assign({},spec,{pixbuf:this._backdropPixbuf});}catch(e){}}
            this._glass=new Cairo.ImageSurface(Cairo.Format.ARGB32,Math.ceil(344*scale),Math.ceil((height+24)*scale));
            const gc=new Cairo.Context(this._glass);gc.scale(scale,scale);gc.translate(12,12);panel(gc,320,height,backdrop,scale);gc.$dispose();
        }
        cr.save();cr.scale(1/scale,1/scale);cr.setSourceSurface(this._glass,-12*scale,-12*scale);cr.paint();cr.restore();
    }
    music(cr,s,scale){
        this.glass(cr,s,scale,s.media?220:88);
        if(!s.media){heading(cr,'NOW PLAYING',24,30);text(cr,'Play something in your browser',24,59,12,MUTED);return;}
        const m=s.media;
        cr.save();cr.translate(0,-810);
        if(m&&s.artAccent){
            cr.save();round(cr,3,813,314,214,18);cr.clip();
            let glow=new Cairo.RadialGradient(77,898,5,77,898,120);glow.addColorStopRGBA(0,...s.artAccent,m.status==='Playing'?.12:.04);glow.addColorStopRGBA(.55,...s.artAccent,.028);glow.addColorStopRGBA(1,...s.artAccent,0);cr.setSource(glow);cr.paint();cr.restore();
        }
        heading(cr,'NOW PLAYING',23,842);text(cr,'•••',296,842,12,MUTED,1,'Inter Regular',0,'right');
        if(m&&s.artPath)this.image(cr,s.artPath,24,861,62,62,5);
        else{round(cr,24,861,62,62,5);color(cr,[.02,.06,.12],.8);cr.fill();text(cr,'♫',55,892,25,CYAN,0,'Inter Light',0,'center');}
        text(cr,m?m.title:'Room for music',102,876,13.5,WHITE,0,'Inter Regular',193);
        text(cr,m?(m.artist||m.browser):'Play in your browser',102,897,10.5,MUTED,0,'Inter Regular',193);

        text(cr,m&&m.status==='Paused'?'Paused':'',102,916,10,MUTED);
        const pos=m?s.position:0,f=m&&m.duration?Math.max(0,Math.min(1,pos/m.duration)):0;
        line(cr,24,939,296,939,[.32,.47,.60],.8,2);if(f)line(cr,24,939,24+272*f,939,CYAN,1,2);
        text(cr,m&&m.duration?fmt(pos):'—',24,954,10,MUTED);text(cr,m&&m.duration?fmt(m.duration):'—',296,954,10,MUTED,0,'Inter Regular',0,'right');
        for(const [x,dir,enabled] of [[57,-1,m&&m.canPrevious],[173,1,m&&m.canNext]]){cr.save();cr.translate(x,984);cr.scale(dir,1);cr.moveTo(-4,-5);cr.lineTo(4,0);cr.lineTo(-4,5);cr.closePath();color(cr,WHITE,enabled?1:.25);cr.fill();line(cr,5,-5,5,5,WHITE,enabled?1:.25,1.2);cr.restore();}
        cr.newPath();cr.arc(115,984,18,0,TAU);color(cr,CYAN,m?.9:.25);cr.setLineWidth(.85);cr.stroke();
        if(m&&m.status==='Playing'){line(cr,112,978,112,990,WHITE,1,2);line(cr,118,978,118,990,WHITE,1,2);}
        else{cr.moveTo(111,978);cr.lineTo(121,984);cr.lineTo(111,990);cr.closePath();color(cr,WHITE,m?1:.25);cr.fill();}
        cr.restore();
    }
    dashboard(cr,s,scale){
        this.glass(cr,s,scale,550);
        const val=(n,suffix='')=>Data.valid(n)?Math.round(n)+suffix:'—';
        const w=s.weather,c=w&&w.current;
        const today=w&&w.daily?w.daily.time.findIndex(t=>new Date(t*1000).toDateString()===new Date().toDateString()):-1;
        pin(cr,105,32);text(cr,s.city,117,32,12,WHITE,0,'Inter Medium',177);
        text(cr,c?weatherName(c.weather_code,s.isDay):'Loading…',101,53,11,MUTED,.35,'Inter Regular',196);
        softWeather(cr,53,76,c?c.weather_code:null,s.isDay?1:0,.90,c?(c.wind_speed_10m||0)*(s.fahrenheit?1.609344:1):0);
        text(cr,c?val(c.temperature_2m,'°')+(s.fahrenheit?'F':'C'):'—',101,90,33,WHITE,-.8,'Inter Medium');
        text(cr,w&&today>=0?'H '+val(w.daily.temperature_2m_max[today],'°')+'  L '+val(w.daily.temperature_2m_min[today],'°'):'—',296,83,10,MUTED,0,'Inter Regular',0,'right');
        text(cr,'Feels like '+val(c&&c.apparent_temperature,'°'),296,103,10,MUTED,0,'Inter Regular',0,'right');
        const forecast=s.forecast,points=forecast&&forecast.points||[];
        cr.save();cr.translate(0,-144);
        const aq=s.air&&s.air.aqi,uv=forecast&&forecast.uv;
        const uvName=!Data.valid(uv)?'Unavailable':uv<3?'Low':uv<6?'Moderate':uv<8?'High':uv<11?'Very high':'Extreme';
        line(cr,24,272,296,272,MUTED,.16,.6);
        line(cr,113,282,113,312,MUTED,.23,.6);line(cr,213,282,213,312,MUTED,.23,.6);
        // Leaf, small sun and water drop: three equal-status weather readings.
        cr.save();cr.translate(34,296);cr.newPath();cr.moveTo(-7,5);cr.curveTo(-9,-4,-2,-7,8,-8);cr.curveTo(8,1,1,8,-7,5);color(cr,[.55,.76,.36]);cr.fill();line(cr,-8,9,4,-3,[.70,.86,.48],.85,.8);cr.restore();
        text(cr,'AQI '+val(aq),51,288,10.5,WHITE);
        const airName=Data.aqiLabel(aq).toLowerCase();text(cr,airName[0].toUpperCase()+airName.slice(1),51,306,10,MUTED,0,'Inter Regular',60);
        cr.save();cr.translate(133,296);cr.scale(.28,.28);sun(cr,0,0,16);cr.restore();
        text(cr,'UV '+(Data.valid(uv)?uv.toFixed(1):'—'),150,288,10.5,WHITE);
        text(cr,uvName,150,306,10,MUTED,0,'Inter Regular',60);
        cr.save();cr.translate(233,296);cr.newPath();cr.moveTo(0,-8);cr.curveTo(-2,-3,-6,1,-6,4);cr.curveTo(-6,12,6,12,6,4);cr.curveTo(6,1,2,-3,0,-8);color(cr,CYAN,.85);cr.fill();cr.restore();
        text(cr,'Humidity',250,288,9.5,MUTED);
        text(cr,c?val(c.relative_humidity_2m,'%'):'—',250,306,11,WHITE);
        cr.restore();
        line(cr,24,183,296,183,MUTED,.18,.6);
        const hours=points.slice(1,4),hourly=w&&w.hourly;
        hours.forEach((p,i)=>{const x=57+i*103,idx=hourly?hourly.time.findIndex(t=>t>=p.epoch):-1,code=idx>=0&&hourly.weather_code?hourly.weather_code[idx]:null;
            text(cr,p.label,x,204,10,MUTED,0,'Inter Regular',0,'center');
            const date=new Date(p.epoch*1000),o=new imports.vendor.astronomy.Astronomy.Observer(s.latitude ?? 0,s.longitude ?? 0,s.elevation ?? 0);
            const A=imports.vendor.astronomy.Astronomy,e=A.Equator('Sun',date,o,true,true),day=A.Horizon(date,o,e.ra,e.dec,'normal').altitude>0;
            softWeather(cr,x,226,code,day,.29);text(cr,val(p.value,'°'),x,250,13,WHITE,0,'Inter Regular',0,'center');
        });
        line(cr,24,270,296,270,MUTED,.16,.6);
        for(let j=0;j<5;j++){
            const k=Math.max(0,today)+j,d=w&&w.daily,x=39+j*61;
            text(cr,d&&d.time[k]?new Date(d.time[k]*1000).toLocaleDateString('en-US',{weekday:'short'}):'—',x,289,10,MUTED,0,'Inter Regular',0,'center');
            softWeather(cr,x,312,d&&d.weather_code?d.weather_code[k]:null,1,.27);
            text(cr,d?val(d.temperature_2m_max[k],'°')+'/'+val(d.temperature_2m_min[k],'°'):'—',x,336,10,WHITE,0,'Inter Regular',0,'center');
        }
        line(cr,24,357,296,357,MUTED,.16,.6);
        this.skyView(cr,s,scale);
        heading(cr,'TONIGHT',24,380);
        const night=s.tonight,best=night&&night.best,moon=s.moonTonight||s.moon;
        const range=best?Data.rangeLabel(best.start,best.end):'—';
        text(cr,'Best sky '+range,24,404,12,WHITE,0,'Inter Regular',218);
        const local=t=>t?Data.hourLabel(t):'—';
        text(cr,'Sunset '+local(night&&night.sunset)+' · Dark '+local(night&&night.dark),24,426,9,MUTED,0,'Inter Regular',263);
        this.moon(cr,moon,265,371,26,scale);text(cr,moon?(moon.fraction*100).toFixed(1)+'%':'—',278,410,10,MUTED,0,'Inter Regular',0,'center');
        cr.save();round(cr,1,1,318,548,20);cr.clip();
        const bloom=new Cairo.RadialGradient(312,542,0,312,542,52);
        for(const [t,a] of [[0,.57],[.16,.25],[.45,.065],[1,0]])bloom.addColorStopRGBA(t,.76,.9,1,a);
        cr.setSource(bloom);cr.paint();cr.restore();
        for(const [width,alpha] of [[7,.08],[3,.22],[1.1,.95]]){
            const rim=new Cairo.RadialGradient(312,542,0,312,542,62);
            rim.addColorStopRGBA(0,.98,1,1,alpha);rim.addColorStopRGBA(.27,.85,.96,1,alpha*.75);rim.addColorStopRGBA(.66,.58,.80,1,alpha*.15);rim.addColorStopRGBA(1,.45,.65,.85,0);
            round(cr,1.4,1.4,317.2,547.2,20);cr.setSource(rim);cr.setLineWidth(width);cr.stroke();
        }
        this.systemCard(cr,s,scale);
    }
    systemCard(cr,s,scale){
        const h=s.systemExpanded?204:44;
        if(!this._systemGlass||this._systemGlassKey!==h+':'+scale){
            this._systemGlassKey=h+':'+scale;this._systemGlass=new Cairo.ImageSurface(Cairo.Format.ARGB32,Math.ceil(344*scale),Math.ceil((h+24)*scale));
            const c=new Cairo.Context(this._systemGlass);c.scale(scale,scale);c.translate(12,12);round(c,1,1,318,h-2,20);color(c,[.015,.025,.045],.78);c.fill();panel(c,320,h,null,scale);c.$dispose();
        }
        cr.save();cr.translate(0,566);cr.save();cr.scale(1/scale,1/scale);cr.setSourceSurface(this._systemGlass,-12*scale,-12*scale);cr.paint();cr.restore();
        imports.performanceIcons20260911.draw(cr,'PERFORMANCE',29,22,19);text(cr,'System',51,22,11,WHITE);
        const sign=s.systemExpanded?-1:1;line(cr,289,21-sign*2,293,21+sign*2,MUTED,.95,1);line(cr,293,21+sign*2,297,21-sign*2,MUTED,.95,1);
        if(!s.systemExpanded){cr.restore();return;}
        const d=s.systemData,percent=n=>Data.valid(n)?Math.round(n)+'%':'—';
        const icons=imports.performanceIcons20260911;
        const metrics=[['CPU','CPU',d&&d.cpu],['GPU','GPU',d&&d.gpu],['RAM','MEMORY',d&&d.memory]];
        metrics.forEach(([name,icon,v],i)=>{const x=58+i*102;icons.draw(cr,icon,x,59,24);text(cr,name,x,83,9,MUTED,0,'Inter Regular',0,'center');text(cr,percent(v&&v.usage),x,101,16,WHITE,0,'Inter Regular',0,'center');text(cr,v?(name==='RAM'?(v.used/2**30).toFixed(1)+' / '+(v.total/2**30).toFixed(1)+' GiB':Data.valid(v.temp)?Math.round(v.temp)+'°C':'—'):'Reading…',x,119,9,MUTED,0,'Inter Regular',0,'center');});
        line(cr,23,133,297,133,MUTED,.14,.6);
        const disk=d&&d.disks&&d.disks[s.systemDisk||0],net=d&&d.network,bat=d&&d.battery;
        icons.draw(cr,'STORAGE',29,153,19);text(cr,'Storage',47,146,9,MUTED);text(cr,disk?(disk.used/2**30).toFixed(0)+' / '+(disk.total/2**30).toFixed(0)+' GiB':'—',47,162,10,WHITE);
        icons.draw(cr,'BATTERY',197,153,19);text(cr,'Battery',215,146,9,MUTED);text(cr,bat?percent(bat.percent)+' · '+bat.status:'—',215,162,10,WHITE,0,'Inter Regular',80);
        const rate=n=>n>=1024**2?(n/1024**2).toFixed(1)+' MiB/s':n>=1024?(n/1024).toFixed(1)+' KiB/s':Math.round(n)+' B/s';
        icons.draw(cr,'NETWORK',29,186,17);text(cr,net?'↓ '+rate(net.down)+'   ↑ '+rate(net.up):'Reading network…',47,186,9,MUTED,0,'Inter Regular',189);
        text(cr,'Details ›',297,186,9,MUTED,0,'Inter Regular',0,'right');
        cr.restore();
    }
    planet(cr,name,x,y,magnitude){
        if(name==='Sun'){lightBall(cr,x,y,6);return;}
        // Apparent magnitude drives a restrained, compressed display scale.
        // Faint planets retain a visible floor; these are markers, not visibility predictions.
        const mag=Number.isFinite(magnitude)?magnitude:1;
        const power=Math.max(0,Math.min(1,(7-mag)/12));
        const radius=name==='Moon'?3.2:1.1+1.65*power;
        const hues={Mars:[1,.53,.33],Saturn:[1,.88,.60],Venus:[1,.95,.78],Jupiter:[1,.94,.82],Mercury:[1,.91,.77],Uranus:[.76,.92,1],Neptune:[.69,.82,1],Moon:[.91,.95,1]};
        const tint=hues[name]||WHITE,halo=radius*(3.3+power);
        const glow=new Cairo.RadialGradient(x,y,0,x,y,halo);
        glow.addColorStopRGBA(0,...tint,.65);glow.addColorStopRGBA(.22,...tint,.32);glow.addColorStopRGBA(.52,...tint,.085);glow.addColorStopRGBA(1,...tint,0);
        cr.setSource(glow);cr.rectangle(x-halo,y-halo,halo*2,halo*2);cr.fill();
        const core=new Cairo.RadialGradient(x,y,0,x,y,radius);
        core.addColorStopRGBA(0,1,1,1,1);core.addColorStopRGBA(.38,1,.99,.94,1);core.addColorStopRGBA(1,...tint,.45);
        cr.setSource(core);cr.arc(x,y,radius,0,TAU);cr.fill();
    }
    landscape(cr,kind,alpha){
        if(alpha<=0)return;
        if(!this._landscapes)this._landscapes={};
        if(!this._landscapes[kind]){
            const p=GdkPixbuf.Pixbuf.new_from_file(this.path+'/assets/horizon-'+kind+'.png');
            const surface=new Cairo.ImageSurface(Cairo.Format.ARGB32,960,540),c=new Cairo.Context(surface);
            c.scale(960/p.width,540/p.height);Gdk.cairo_set_source_pixbuf(c,p,0,0);
            // Continuous alpha mask eliminates the old 90-strip banding.
            const fade=new Cairo.LinearGradient(0,0,0,p.height);
            for(const [t,a] of [[0,0],[.04,.005],[.10,.025],[.18,.10],[.27,.29],[.36,.58],[.45,.83],[.54,.97],[.60,1],[.82,1],[.90,.97],[.96,.88],[1,.72]])fade.addColorStopRGBA(t,1,1,1,a);
            c.mask(fade);
            c.$dispose();this._landscapes[kind]=surface;
        }
        // Carry the landscape past the lower edge and clip to the glass interior.
        // Previously it ended 11px early, leaving a dark horizontal shelf.
        cr.save();round(cr,1.5,1.5,317,547,19);cr.clip();cr.translate(0,430);cr.scale(1/3,124/540);cr.setSourceSurface(this._landscapes[kind],0,0);cr.paintWithAlpha(alpha);cr.restore();
    }
    skyView(cr,s,scale){
        const cx=160,base=506,r=136,left=cx-r,alt=Number.isFinite(s.sunAltitude)?s.sunAltitude:-18;
        let a,b,t;
        if(alt>=6){a='day';b=a;t=0;}else if(alt>=-4){a='twilight';b='day';t=(alt+4)/10;}else if(alt>=-14){a='night';b='twilight';t=(alt+14)/10;}else {a='night';b=a;t=0;}
        this.landscape(cr,a,1);if(a!==b)this.landscape(cr,b,t);
        // The artwork is decorative, not a local terrain mask. Zero altitude sits
        // above its highest ridge; actual altitude and azimuth determine placement.
        const bodies=(s.bodies||[]).filter(b=>Number.isFinite(b.altitude)&&b.altitude>0&&b.name!=='Sun'&&(b.name!=='Moon'||alt<=0)).map(b=>{const x=left+7+b.azimuth/360*(r*2-14);return {...b,x,y:base-b.altitude/90*45};});
        const occupied=bodies.map(b=>[b.x-9,b.y-9,b.x+9,b.y+9]);
        const overlaps=(box,p)=>box[0]<p[2]+3&&box[2]>p[0]-3&&box[1]<p[3]+2&&box[3]>p[1]-2;
        for(const b of bodies){
            const c=b.name==='Moon'?WHITE:b.name==='Mars'?[1,.47,.26]:b.name==='Neptune'?[.35,.58,1]:b.name==='Uranus'?[.5,.85,.92]:GOLD;
            cr.save();cr.rectangle(8,445,304,103);cr.clip();this.planet(cr,b.name,b.x,b.y,b.magnitude);cr.restore();
            if(!s.skyHover)continue;
            const w=b.name.length*5.1;let choice=null;
            for(const [dx,dy] of [[9,-6],[9,9],[-w-9,-6],[-w-9,10],[-w/2,-17],[-w/2,19],[9,-29],[-w-9,-29],[-w/2,-43]]){
                const x=Math.max(25,Math.min(295-w,b.x+dx)),y=Math.max(452,Math.min(505,b.y+dy)),box=[x,y-6,x+w,y+6];
                if(!occupied.some(p=>overlaps(box,p))){choice={x,y,box};break;}
            }
            if(!choice){const x=Math.max(25,Math.min(295-w,b.x-w/2));choice={x,y:455,box:[x,449,x+w,461]};}
            occupied.push(choice.box);
            if(Math.abs(choice.y-b.y)>22)line(cr,b.x,b.y-5,choice.x+w/2,choice.y+6,MUTED,.20,.5);
            const labelColor=alt>=6&&choice.y>=493?[.035,.075,.11]:WHITE;
            text(cr,b.name,choice.x,choice.y,9,labelColor);
        }
    }

    twilight(cr,x,y,w,h,night){
        // Small cached background: soft twilight glow and a deterministic starfield.
        if(!this._twilight){
            this._twilight=new Cairo.ImageSurface(Cairo.Format.ARGB32,548,150);const c=new Cairo.Context(this._twilight);c.scale(2,2);
            let sky=new Cairo.LinearGradient(0,0,0,h);sky.addColorStopRGBA(0,.015,.035,.09,0);sky.addColorStopRGBA(.45,.025,.10,.34,.35);sky.addColorStopRGBA(1,.035,.27,.75,.7);c.setSource(sky);c.paint();
            let gold=new Cairo.RadialGradient(0,h,0,0,h,105);gold.addColorStopRGBA(0,1,.78,.31,.88);gold.addColorStopRGBA(.18,1,.47,.23,.6);gold.addColorStopRGBA(.5,.38,.32,.64,.3);gold.addColorStopRGBA(1,.1,.2,.4,0);c.setSource(gold);c.paint();
            let seed=91;for(let i=0;i<115;i++){seed=(seed*1664525+1013904223)>>>0;let xx=seed%274;seed=(seed*1664525+1013904223)>>>0;let yy=seed%67;circle(c,xx,yy,(i%13===0)?.8:.35,WHITE,(xx/274)*.65+.1);}
            line(c,0,h-1,w,h-1,CYAN,.75,.55);c.$dispose();
        }
        cr.save();cr.translate(x,y);cr.scale(.5,.5);cr.setSourceSurface(this._twilight,0,0);cr.paint();cr.restore();
        // Hours run from today's sunset to local midnight; a fine highlight marks
        // astronomical darkness and the selected low-cloud viewing window.
        if(night&&night.sunset){let midnight=new Date(night.sunset*1000);midnight.setHours(24,0,0,0);const end=midnight.getTime()/1000;
            const px=t=>x+Math.max(0,Math.min(1,(t-night.sunset)/(end-night.sunset)))*w;
            if(night.dark)line(cr,px(night.dark),y+h-9,px(night.dark),y+h,WHITE,.35,.6);
            if(night.best&&night.best.start<end)line(cr,px(night.best.start),y+h,px(night.best.end),y+h,CYAN,.8,1.4);
        }
    }
    horizon(cr,s){
        const y=horizonY;
        const alpha=s.details?1:.62;
        cr.newPath();for(let x=375;x<=1297;x+=3){if(x===375)cr.moveTo(x,y(x));else cr.lineTo(x,y(x));}color(cr,WHITE,.40);cr.setLineWidth(.65);cr.stroke();
        for(let x=375;x<=1297;x+=7)circle(cr,x,y(x),.85,WHITE,.38);
        for(let deg=0;deg<=360;deg+=10){let x=410+deg/360*852;
            if(deg%90===0){line(cr,x,y(x)+3,x,y(x)+13,WHITE,.85,.8);}
            else if(s.details)line(cr,x,y(x)+3,x,y(x)+7,CYAN,.35,.6);
        }
        for(let [name,deg] of [['N',0],['E',90],['S',180],['W',270],['N',360]]){const x=410+deg/360*852;
            if(y(x)>365)continue;
            text(cr,name,x,y(x)+26,12,WHITE,1,'Inter Regular',0,'center');
            text(cr,deg+'°',x,y(x)+42,9,WHITE,0,'Inter Regular',0,'center');
        }
        let occupied=[];
        for(let b of s.bodies||[]){
            const x=410+b.azimuth/360*852,base=y(x),top=base-20-90*b.altitude/90;
            if(base>440)continue;
            const c=b.name==='Mars'?[1,.52,.24]:b.name==='Moon'?WHITE:GOLD;
            line(cr,x,base-4,x,top+7,WHITE,.14,.65);
            circle(cr,x,top,11,c,.04);circle(cr,x,top,6,c,.12);circle(cr,x,top,3.2,c,.98);
            let ly=top-16;while(occupied.some(p=>Math.abs(p[0]-x)<76&&Math.abs(p[1]-ly)<16))ly-=17;
            if(ly<top-16)line(cr,x,top-5,x,ly+7,WHITE,.22,.55);
            occupied.push([x,ly]);text(cr,b.name,x,ly,11,WHITE,0,'Inter Regular',0,'center');
            if(s.details)text(cr,b.altitude.toFixed(0)+'° alt',x,ly-15,8,CYAN,0,'Inter Regular',0,'center');
        }
    }
    _paintMoon(cr,moon,scale,x,y,d,earthshine=0.16) {
        if(!moon) return;
        const size=Math.max(112,Math.ceil(d*scale*1.5));
        const key=moon.timestamp+':'+size+':'+earthshine+':'+JSON.stringify(moon.light);
        if(key!==this._moonKey) {
            this._moonKey=key;
            this._moonSurface=new Cairo.ImageSurface(Cairo.Format.ARGB32,size,size);
            const mc=new Cairo.Context(this._moonSurface);
            mc.setAntialias(Cairo.Antialias.NONE);
            const tw=this.texture.get_width(), th=this.texture.get_height();
            const stride=this.texture.get_rowstride(), channels=this.texture.get_n_channels();
            const project=(v,x,y,z)=>v[0]*x+v[1]*y+v[2]*z;
            for(let iy=0;iy<size;iy++) for(let ix=0;ix<size;ix++) {
                let x=(ix+0.5-size/2)/(size/2),y=(iy+0.5-size/2)/(size/2);
                let r2=x*x+y*y;
                if(r2>=1) continue;
                let z=Math.sqrt(1-r2);
                let lon=moon.longitude+Math.atan2(project(moon.east,x,y,z),project(moon.centralMeridian,x,y,z));
                let lat=Math.asin(Math.max(-1,Math.min(1,project(moon.north,x,y,z))));
                let u=((lon/TAU+0.5)%1+1)%1, v=0.5-lat/Math.PI;
                let tx=Math.min(tw-1,Math.floor(u*tw)),ty=Math.min(th-1,Math.max(0,Math.floor(v*th)));
                let index=ty*stride+tx*channels;
                let incidence=project(moon.light,x,y,z);
                // Lunar scattering brightens the limb; a very faint unlit disk
                // preserves the design's earthshine silhouette near new moon.
                let brightness=incidence>0 ? 0.035+0.965*Math.pow(incidence/(incidence+z),0.45)*1.35 : earthshine;
                let alpha=Math.min(1,(1-Math.sqrt(r2))*size/2);
                mc.setSourceRGBA(Math.min(1,this.texturePixels[index]/255*brightness*1.25),
                    Math.min(1,this.texturePixels[index+1]/255*brightness*1.23),
                    Math.min(1,this.texturePixels[index+2]/255*brightness*1.18),alpha);
                mc.rectangle(ix,iy,1,1); mc.fill();
            }
            mc.$dispose();
        }
        cr.save(); cr.translate(x,y); cr.scale(d/size,d/size);
        cr.setSourceSurface(this._moonSurface,0,0); cr.paint(); cr.restore();
    }

};
