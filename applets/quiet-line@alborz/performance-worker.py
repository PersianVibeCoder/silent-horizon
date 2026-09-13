#!/usr/bin/python3
"""Local-only telemetry. Runs only while the performance popover is open."""
import json, os, re, shutil, subprocess, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

def read(path, default=''):
    try: return Path(path).read_text().strip()
    except OSError: return default

def number(value):
    try: return float(value)
    except (TypeError, ValueError): return None

def cpu_ticks():
    v=list(map(int,read('/proc/stat').splitlines()[0].split()[1:9]))
    return sum(v),v[3]+v[4]

def temperature():
    for hw in Path('/sys/class/hwmon').glob('hwmon*'):
        if read(hw/'name')=='coretemp':
            v=number(read(hw/'temp1_input'))
            if v is not None: return v/1000
    return None

def gpu():
    if not shutil.which('nvidia-smi'): return dict(name='GPU sensor unavailable',usage=None,temp=None)
    try:
        s=subprocess.check_output(['nvidia-smi','--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total','--format=csv,noheader,nounits'],timeout=3,text=True,stderr=subprocess.DEVNULL).splitlines()[0]
        name,usage,temp,used,total=[v.strip() for v in s.split(',')]
        return dict(name=name,usage=number(usage),temp=number(temp),used=number(used),total=number(total))
    except (OSError,subprocess.SubprocessError,ValueError,IndexError): return dict(name='NVIDIA · sensor unavailable',usage=None,temp=None)

def disks():
    result=[];seen=set()
    for line in read('/proc/mounts').splitlines():
        parts=line.split()
        if len(parts)<3: continue
        dev,mount,fs=parts[:3];mount=re.sub(r'\\([0-7]{3})',lambda m:chr(int(m[1],8)),mount)
        if not dev.startswith('/dev/') or dev.startswith('/dev/loop') or fs in ('squashfs',) or dev in seen: continue
        try:
            s=os.statvfs(mount);total=s.f_blocks*s.f_frsize;used=(s.f_blocks-s.f_bfree)*s.f_frsize
            if total: result.append(dict(name=Path(dev).name,mount=mount,total=total,used=used,usage=100*used/total));seen.add(dev)
        except OSError: pass
    return sorted(result,key=lambda v:v['mount']!='/')

def network():
    # Physical links only: avoid counting traffic twice through VPN/bridge interfaces.
    names=[p.name for p in Path('/sys/class/net').glob('*') if (p/'device').exists() and read(p/'operstate')=='up']
    totals=[0,0]
    for n in names:
        for i,k in enumerate(('rx_bytes','tx_bytes')): totals[i]+=int(read('/sys/class/net/'+n+'/statistics/'+k,'0'))
    return names,totals

def battery():
    for p in Path('/sys/class/power_supply').glob('*'):
        if read(p/'type')=='Battery' and read(p/'scope')!='Device':
            return dict(percent=number(read(p/'capacity')),status=read(p/'status'),name=p.name)
    return dict(percent=None,status='AC power',name='No system battery')

def main():
    model=next((s.split(':',1)[1].strip() for s in read('/proc/cpuinfo').splitlines() if s.startswith('model name')),'CPU')
    previous_cpu=cpu_ticks();previous_time=time.monotonic();previous_names,previous_net=network()
    cached_gpu=dict(name='NVIDIA · reading sensor…',usage=None,temp=None);cached_disks=[];iteration=0
    pool=ThreadPoolExecutor(max_workers=1);gpu_future=pool.submit(gpu)
    while True:
        time.sleep(.25 if iteration==0 else 1)
        now=time.monotonic();elapsed=now-previous_time;ticks=cpu_ticks();delta=ticks[0]-previous_cpu[0]
        usage=max(0,min(100,100*(1-(ticks[1]-previous_cpu[1])/delta))) if delta>0 else None
        names,net=network();rates=[max(0,(net[i]-previous_net[i])/elapsed) if names==previous_names else 0 for i in range(2)]
        mem={k:int(v.split()[0])*1024 for k,v in (s.split(':',1) for s in read('/proc/meminfo').splitlines())}
        total=mem.get('MemTotal',0);used=total-mem.get('MemAvailable',0)
        if gpu_future.done():
            cached_gpu=gpu_future.result();gpu_future=pool.submit(gpu) if iteration%2==0 else gpu_future
        if iteration%5==0: cached_disks=disks()
        data=dict(cpu=dict(name=model,usage=usage,temp=temperature()),gpu=cached_gpu,memory=dict(total=total,used=used,usage=100*used/total if total else None),disks=cached_disks,network=dict(interfaces=names,down=rates[0],up=rates[1],received=net[0],sent=net[1]),battery=battery())
        print(json.dumps(data,allow_nan=False),flush=True)
        previous_cpu=ticks;previous_time=now;previous_names=names;previous_net=net;iteration+=1

if __name__=='__main__':
    try: main()
    except (BrokenPipeError,KeyboardInterrupt): pass
