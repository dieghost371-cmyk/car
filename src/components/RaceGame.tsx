'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, ChevronRight, ChevronsUp, CirclePause, Flag, Gauge, Keyboard, LoaderCircle, LogOut, Octagon, Play, RotateCcw, ShieldCheck, Trophy, Users, Wifi, WifiOff, Zap } from 'lucide-react';
import type { RaceEngine, RaceResult, Telemetry, Control } from '@/game/engine';
import { api, readStored, store } from '@/lib/client';
import { getCar } from '@/lib/cars';
import { getTrack, formatTime } from '@/lib/tracks';
import { trackDistance } from '@/lib/track-distance';
import type { RaceConfig, RoomSnapshot } from '@/lib/multiplayer';
import { mapPath } from '@/components/TrackMap';
import Modal from '@/components/Modal';

type Props = { config: RaceConfig; onExit: (leftRoom?: boolean) => void };
const initialTelemetry: Telemetry = { speed:0,progress:0,lane:0,lap:1,position:1,elapsed:0,nitro:100,countdown:3,finished:false,offroad:false,boosting:false,gear:1,standings:[],mapPosition:[0,0] };
export default function RaceGame({ config, onExit }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const engine = useRef<RaceEngine | null>(null);
  const [telemetry,setTelemetry] = useState(initialTelemetry);
  const telemetryRef = useRef(telemetry); telemetryRef.current=telemetry;
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [paused,setPaused] = useState(false);
  const [quitConfirm,setQuitConfirm] = useState(false);
  const [result,setResult] = useState<RaceResult | null>(null);
  const resultRef = useRef(result); resultRef.current=result;
  const [session,setSession] = useState(0);
  const [camera,setCamera] = useState('Chase');
  const [connection,setConnection] = useState(true);
  const [liveRoom,setLiveRoom] = useState<RoomSnapshot | null>(null);
  const [saveStatus,setSaveStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [leaving,setLeaving] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const pausedRef = useRef(paused); pausedRef.current=paused;
  const track=getTrack(config.track), car=getCar(config.carId);
  const saveSolo = useCallback(async (finished: RaceResult) => {
    setSaveStatus('saving');
    try {
      await api('/api/results',{method:'POST',body:{playerName:config.playerName,carId:config.carId,track:config.track,laps:config.laps,timeMs:finished.timeMs,position:finished.position}});
      setSaveStatus('saved');
      const history=readStored<{track:string;timeMs:number;carId:string;date:string}[]>('history',[]);
      store('history',[{track:config.track,timeMs:finished.timeMs,carId:config.carId,date:new Date().toISOString()},...history].slice(0,30));
    } catch { setSaveStatus('error'); }
  },[config]);
  useEffect(()=>{
    let disposed=false;let interval:ReturnType<typeof setInterval>|undefined;
    let instance:RaceEngine|null=null;
    setLoading(true);setError('');setResult(null);setPaused(false);setTelemetry(initialTelemetry);
    const initialize=async()=>{
      try {
        const {RaceEngine:Engine}=await import('@/game/engine');
        if(disposed||!container.current)return;
        instance=new Engine(container.current,config,{
          onUpdate:data=>{if(!disposed){setTelemetry(data);telemetryRef.current=data;}},
          onFinish:finished=>{
            if(disposed)return;setResult(finished);resultRef.current=finished;
            if(config.mode==='solo')void saveSolo(finished);
            else if(config.membership)void api(`/api/rooms/${config.membership.code}`,{method:'POST',membership:config.membership,body:{action:'state',progress:telemetryRef.current.progress,lane:telemetryRef.current.lane,speed:telemetryRef.current.speed/3.6}}).catch(()=>{});
          },
        });
        engine.current=instance;
        if(config.initialRoom)instance.setRemotePlayers(config.initialRoom.players,config.initialRoom.serverTime);
        setLoading(false);
        if(config.mode==='multiplayer'&&config.membership){
          let failures=0;let syncing=false;
          interval=setInterval(async()=>{
            if(disposed||syncing)return;syncing=true;
            const data=instance!.getTelemetry();
            try{const snapshot=await api<RoomSnapshot>(`/api/rooms/${config.membership!.code}`,{method:'POST',membership:config.membership,body:{action:'state',progress:data.progress,lane:data.lane,speed:data.speed/3.6},signal:AbortSignal.timeout(4000)});
              if(!disposed){instance!.setRemotePlayers(snapshot.players,snapshot.serverTime);setLiveRoom(snapshot);setConnection(true);failures=0;}
            }catch(err){if(!disposed){failures++;if(failures>=3)setConnection(false);if((err as {status?:number}).status===404){setError('This room has closed. Return to the paddock to create a new grid.');instance!.setPaused(true);if(interval)clearInterval(interval);}}}finally{syncing=false;}
          },220);
        }
      }catch(err){if(!disposed){console.error('Race initialization:',err);setError('Your browser couldn’t start the 3D engine. Enable hardware acceleration or try a recent version of Chrome, Safari, or Firefox.');setLoading(false);}}
    };
    void initialize();
    return()=>{disposed=true;if(interval)clearInterval(interval);instance?.dispose();engine.current=null;};
  },[config,session,saveSolo]);
  useEffect(()=>{engine.current?.setPaused(paused);},[paused]);
  useEffect(()=>{
    const controls:Record<string,Control>={a:'left',arrowleft:'left',d:'right',arrowright:'right',w:'gas',arrowup:'gas',s:'brake',arrowdown:'brake',shift:'nitro',' ':'handbrake'};
    const down=(event:KeyboardEvent)=>{
      const key=event.key.toLowerCase();
      if(resultRef.current)return;
      if(key==='escape'){event.preventDefault();if(!event.repeat)setPaused(value=>!value);return;}
      if(controls[key]){event.preventDefault();if(!pausedRef.current)engine.current?.setControl(controls[key],true);}
      if(!event.repeat&&!pausedRef.current){if(key==='c'&&engine.current)setCamera(engine.current.toggleCamera());if(key==='r')engine.current?.resetCar();}
    };
    const up=(event:KeyboardEvent)=>{const control=controls[event.key.toLowerCase()];if(control){event.preventDefault();engine.current?.setControl(control,false);}};
    const blur=()=>engine.current?.releaseControls();
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);document.body.style.overflow=overflow;};
  },[]);
  useEffect(()=>{
    const path=pathRef.current,dot=dotRef.current;if(!path||!dot)return;
    const fraction=(telemetry.progress%trackDistance(config.track))/trackDistance(config.track);
    const point=path.getPointAtLength(path.getTotalLength()*fraction);dot.setAttribute('cx',String(point.x));dot.setAttribute('cy',String(point.y));
  },[telemetry.progress,config.track,loading]);
  const restart=()=>{setResult(null);resultRef.current=null;setPaused(false);setQuitConfirm(false);setSession(value=>value+1);setCamera('Chase');};
  const leave=async()=>{
    setLeaving(true);
    if(config.mode==='multiplayer'&&config.membership&&!result){try{await api(`/api/rooms/${config.membership.code}`,{method:'POST',membership:config.membership,body:{action:'leave'}});}catch{/* A closed room is already left. */}onExit(true);}else onExit(false);
  };
  const touch=(control:Control)=>({
    onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);if(!paused&&!result)engine.current?.setControl(control,true);},
    onPointerUp:()=>engine.current?.setControl(control,false),
    onPointerCancel:()=>engine.current?.setControl(control,false),
    onLostPointerCapture:()=>engine.current?.setControl(control,false),
    onContextMenu:(event:React.MouseEvent)=>event.preventDefault(),
  });
  const multiStandings=liveRoom?.players.map(player=>({id:player.id,name:player.name,carId:player.carId,color:player.color,ai:false,timeMs:player.finishTime,progress:player.progress})).sort((a,b)=>a.timeMs!==null&&b.timeMs!==null?a.timeMs-b.timeMs:a.timeMs!==null?-1:b.timeMs!==null?1:b.progress-a.progress);
  const finalStandings=config.mode==='multiplayer'&&multiStandings?.length?multiStandings:result?.standings??[];
  const finalPosition=config.mode==='multiplayer'?Math.max(1,finalStandings.findIndex(player=>player.id===config.membership?.playerId)+1):result?.position??1;
  const finalTime=config.mode==='multiplayer'?multiStandings?.find(player=>player.id===config.membership?.playerId)?.timeMs??result?.timeMs??0:result?.timeMs??0;
  return <div className={`race-game ${telemetry.boosting?'is-boosting':''}`}>
    <div className="race-canvas" ref={container}/>
    <div className="race-vignette"/>
    <header className="race-topbar"><div className="race-brand">APEX<span>LIVE DRIVE</span></div><div className="race-track-title"><Flag size={15}/><div><b>{track.name}</b><span>{config.mode==='solo'?(config.ai?'SOLO · AI RIVALS':'SOLO · TIME TRIAL'):`MULTIPLAYER · ${config.membership?.code}`}</span></div></div><div className="race-top-actions">{config.mode==='multiplayer'&&<span className={`race-connection ${connection?'':'disconnected'}`}>{connection?<Wifi size={15}/>:<WifiOff size={15}/>}<span>{connection?'Live sync':'Reconnecting'}</span></span>}<button className="race-icon" onClick={()=>{if(engine.current)setCamera(engine.current.toggleCamera());}} title="Change camera (C)" aria-label="Change camera"><Camera size={18}/><small>{camera}</small></button><button className="race-icon" onClick={()=>setPaused(true)} aria-label="Pause race" disabled={!!result}><CirclePause size={20}/></button><button className="race-icon" onClick={()=>{setPaused(true);setQuitConfirm(true);}} aria-label="Exit race"><LogOut size={18}/></button></div></header>
    {!loading&&!error&&<><div className="race-position hud-panel"><div><span>POSITION</span><strong>{telemetry.position}<small> / {telemetry.standings.length}</small></strong></div><div><span>LAP</span><strong>{telemetry.lap}<small> / {config.laps}</small></strong></div><div className="race-clock"><span>RACE TIME</span><b>{formatTime(telemetry.elapsed)}</b></div></div>
    <div className="race-standings">{telemetry.standings.slice(0,4).map((player,index)=><div className={player.id==='you'||player.id===config.membership?.playerId?'is-you':''} key={player.id}><span>{index+1}</span><i style={{background:player.color}}/><b>{player.name}</b>{player.ai&&<small>AI</small>}{player.timeMs!==null?<Flag size={12}/>:player.id==='you'||player.id===config.membership?.playerId?<small>YOU</small>:null}</div>)}</div>
    <div className="race-minimap hud-panel"><span>{track.name}<small>{track.distance} KM</small></span><svg viewBox="0 0 180 120" fill="none"><path ref={pathRef} d={mapPath(config.track)} stroke="#ffffff45" strokeWidth="4" strokeLinejoin="round"/><circle ref={dotRef} r="5" fill="#ff8844" stroke="white" strokeWidth="2"/></svg><div><span className="status-dot"/>{config.autoThrottle?'AUTO THROTTLE':'MANUAL THROTTLE'}</div></div>
    <div className={`speedometer ${telemetry.boosting?'boosting':''}`}><div className="speed-revs">{Array.from({length:24},(_,index)=><i key={index} className={index<telemetry.speed/car.topSpeed*24?'lit':''}/>)}</div><div className="speed-value"><span className="gear">{telemetry.gear}<small>GEAR</small></span><strong>{telemetry.speed.toString().padStart(3,'0')}</strong><span className="speed-unit">KM/H</span></div><div className="nitro-label"><span><Zap size={12}/> NITRO</span><kbd>SHIFT</kbd></div><div className="nitro-track"><span style={{width:`${telemetry.nitro}%`}}/></div></div>
    <div className="desktop-controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Drive</span><span><kbd>SPACE</kbd> Drift</span><span><kbd>SHIFT</kbd> Nitro</span><span><kbd>C</kbd> Camera</span><span><kbd>R</kbd> Reset</span></div>
    <div className="touch-controls"><div className="touch-steering"><button {...touch('left')} aria-label="Steer left"><ChevronLeft size={32}/></button><button {...touch('right')} aria-label="Steer right"><ChevronRight size={32}/></button><button className="touch-drift" {...touch('handbrake')} aria-label="Handbrake drift">DRIFT</button></div><div className="touch-pedals"><button className="touch-nitro" {...touch('nitro')} aria-label="Use nitro boost"><Zap size={23}/></button><button {...touch('brake')} aria-label="Brake"><Octagon size={26}/><small>BRAKE</small></button><button className="touch-gas" {...touch('gas')} aria-label="Accelerate"><ChevronsUp size={31}/><small>GAS</small></button></div></div>
    {telemetry.offroad&&!result&&<div className="offroad-warning"><Gauge size={16}/> OFF TRACK · EASE BACK ONTO THE ASPHALT</div>}
    {telemetry.countdown>0&&!paused&&!result&&<div className="race-countdown"><span>MAKE EVERY CORNER COUNT.</span><div className="start-lights">{[3,2,1].map(value=><i key={value} className={telemetry.countdown<=value?'on':''}/>)}</div><strong key={telemetry.countdown}>{telemetry.countdown}</strong><p>GET READY</p><small>{config.autoThrottle?'Auto throttle is on. Steer with A / D or touch.':'Hold W / ↑ or touch GAS to accelerate.'}</small></div>}
    {telemetry.countdown===0&&telemetry.elapsed<950&&!paused&&!result&&<div className="go-message">GO<span>MAKE IT COUNT.</span></div>}
    </>}
    {loading&&<div className="race-loading"><div className="brand-word">APEX<span>.</span></div><LoaderCircle size={26} className="spin"/><h2>Building your starting line.</h2><p>A little horsepower. A whole lot of possibility.</p></div>}
    {error&&<div className="race-error"><Gauge size={38}/><h2>A quick pit stop.</h2><p>{error}</p><button className="button primary" onClick={()=>onExit(config.mode==='multiplayer')}>Back to the paddock <ArrowLeft size={16}/></button></div>}
    {paused&&!result&&!error&&<Modal title={quitConfirm?'Leave the starting line?':'Take a breather.'} eyebrow={quitConfirm?'EXIT RACE':'RACE PAUSED'} onClose={()=>{setPaused(false);setQuitConfirm(false);}}>
      {quitConfirm?<><p className="modal-description">{config.mode==='multiplayer'?'You’ll leave this room for your friends. Your unfinished race won’t be recorded.':'Your unfinished race won’t be saved. The road will be here when you’re ready.'}</p><div className="modal-actions"><button className="button secondary" onClick={()=>{setQuitConfirm(false);setPaused(false);}}>Keep racing</button><button className="button primary" onClick={()=>void leave()} disabled={leaving}>{leaving?<LoaderCircle size={16} className="spin"/>:<LogOut size={16}/>}Leave race</button></div></>:<><p className="modal-description">{config.mode==='multiplayer'?'Your online rivals keep racing while this menu is open. Get back out there.':'Stretch your fingers. Find your focus. The next corner is yours.'}</p><div className="pause-options"><button className="button primary" onClick={()=>setPaused(false)}><Play size={17}/>Back to the race<ArrowRight size={17}/></button>{config.mode==='solo'&&<button className="button secondary" onClick={restart}><RotateCcw size={16}/>Restart race</button>}<button className="button secondary" onClick={()=>setQuitConfirm(true)}><LogOut size={16}/>Return to paddock</button></div><div className="pause-tip"><Keyboard size={17}/><span>WASD / arrows to drive · Shift for nitro<br/>Space to drift · C for camera · R to reset</span></div></>}
    </Modal>}
    {result&&!error&&<div className="results-overlay" role="dialog" aria-modal="true" aria-label="Race results"><div className="results-card"><div className="finish-emblem"><Trophy size={32}/></div><p className="eyebrow orange">CHEQUERED FLAG. WELL EARNED.</p><h1>{finalPosition===1?'That’s your kind of finish.':'Every finish is a new beginning.'}</h1><p className="results-subtitle">{track.name} · {config.laps} {config.laps===1?'lap':'laps'} · {car.name}</p><div className="result-numbers"><div><span>YOUR POSITION</span><strong>{finalPosition}<small> / {finalStandings.length}</small></strong></div><div><span>RACE TIME</span><strong className="result-time">{formatTime(finalTime)}</strong></div></div><div className="result-table">{finalStandings.map((player,index)=><div className={player.id==='you'||player.id===config.membership?.playerId?'is-you':''} key={player.id}><b>{String(index+1).padStart(2,'0')}</b><i style={{background:player.color}}/><span>{player.name}{player.ai&&<small>AI</small>}{(player.id==='you'||player.id===config.membership?.playerId)&&<em>YOU</em>}</span><strong>{player.timeMs!==null?formatTime(player.timeMs):'Still racing'}</strong></div>)}</div><div className="result-save-status">{config.mode==='solo'?saveStatus==='saved'?<><ShieldCheck size={14}/>Saved to the global leaderboard</>:saveStatus==='saving'?<><LoaderCircle size={14} className="spin"/>Saving your finish…</>:<><span>Your time couldn’t be saved.</span><button className="text-button" onClick={()=>void saveSolo(result)}>Retry</button></>:<><Users size={14}/>Live finish times · Shared with your room</>}</div><div className="modal-actions"><button className="button secondary" onClick={()=>void leave()} disabled={leaving}><ArrowLeft size={16}/>Back to {config.mode==='solo'?'garage':'room'}</button>{config.mode==='solo'?<button className="button primary" onClick={restart}><RotateCcw size={16}/>Race again<ArrowRight size={16}/></button>:<span className="waiting-host"><LoaderCircle size={15} className="spin"/>Waiting for the other drivers</span>}</div></div></div>}
    <div className="race-mobile-landscape-hint"><Check size={12}/> Landscape feels even better</div>
  </div>;
}
