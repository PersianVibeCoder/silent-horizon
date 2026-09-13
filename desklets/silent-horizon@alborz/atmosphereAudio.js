/* A separate small Cairo surface keeps spectrum animation inexpensive. */
const Cairo=imports.cairo;
var draw=function(cr,width,height,bands,gain,maxHeight) {
    cr.save();cr.scale(width/252,height/88);
    cr.setLineCap(Cairo.LineCap.ROUND);
    const middle=42, left=12, right=240;
    const peak=Math.max(0,...bands);
    let baseline=new Cairo.LinearGradient(left,0,right,0);
    baseline.addColorStopRGBA(0,0.25,0.60,1,0);
    baseline.addColorStopRGBA(0.35,0.42,0.72,1,0.16);
    baseline.addColorStopRGBA(0.5,1,0.81,0.45,0.40);
    baseline.addColorStopRGBA(0.65,0.42,0.72,1,0.16);
    baseline.addColorStopRGBA(1,0.25,0.60,1,0);
    cr.setSource(baseline);cr.setLineWidth(0.65);cr.moveTo(left,middle);cr.lineTo(right,middle);cr.stroke();
    if(peak>0.003) {
        const count=16;
        for(let i=0;i<count;i++) {
            const distance=Math.abs(i-(count-1)/2)/((count-1)/2);
            const source=distance*(bands.length-1);
            const lo=Math.floor(source),hi=Math.min(bands.length-1,lo+1),f=source-lo;
            const value=Math.min(1,((bands[lo]||0)*(1-f)+(bands[hi]||0)*f)*gain);
            const taper=0.45+0.55*Math.pow(1-distance,0.4);
            const half=0.65+Math.pow(value,0.8)*maxHeight/2*taper;
            const x=left+i*(right-left)/(count-1);
            const warm=Math.pow(1-distance,9);
            const col=[0.27+0.73*warm,0.66+0.17*warm,1-0.51*warm];
            for(const [w,a] of [[5.5,0.03+value*0.035],[2.8,0.08+value*0.09],[1.45,0.42+value*0.5]]) {
                cr.setSourceRGBA(...col,a);cr.setLineWidth(w);cr.moveTo(x,middle-half);cr.lineTo(x,middle+half);cr.stroke();
            }
        }
    } else {
        cr.setSourceRGBA(1,0.84,0.53,0.42);cr.arc(126,middle,1,0,2*Math.PI);cr.fill();
    }
    cr.restore();
};
