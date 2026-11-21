'use client';
import { useState } from 'react';
import { ArrowRight, Check, ChevronRight, Flag, Gauge, MapPin, MonitorSmartphone, Route, Sparkles } from 'lucide-react';
import { tracks, type TrackId } from '@/lib/tracks';
import type { Car } from '@/lib/cars';
import TrackMap from '@/components/TrackMap';
export type SetupOptions = { track: TrackId; laps: number; ai: boolean };
export default function RaceSetup({ car, onGarage, onStart, autoThrottle }: { car: Car; onGarage: () => void; onStart: (options: SetupOptions) => void; autoThrottle: boolean }) {
  const [track, setTrack] = useState<TrackId>('coastal');
  const [laps, setLaps] = useState(3);
  const [ai, setAi] = useState(true);
  return <div className="race-setup">
    <div className="setup-circuits"><div className="small-section-title"><Route size={15} /><h3>Choose your circuit</h3><span>03 LOCATIONS</span></div>
      {tracks.map(item => <button key={item.id} className={`circuit-option ${track === item.id ? 'active' : ''}`} onClick={() => setTrack(item.id)} aria-pressed={track === item.id}>
        <div className={`circuit-map-wrap ${item.id}`}><TrackMap track={item.id} /></div><div className="circuit-info"><span className="eyebrow">{item.location}</span><h4>{item.name}</h4><p>{item.subtitle}</p><div><span>{item.distance} km</span><span>{item.turns} corners</span><span>{item.difficulty}</span></div></div><span className="radio-check">{track === item.id && <Check size={12} />}</span>
      </button>)}
      <div className="setup-hint"><MonitorSmartphone size={17} /><span>One road. Any screen.<br /><small>Keyboard and touch controls are built in.</small></span></div>
    </div>
    <div className="setup-settings"><div className="small-section-title"><Flag size={15} /><h3>Make it your race</h3></div>
      <div className="setup-car"><img src={car.image} alt={car.name} style={{ filter: car.filter }} /><div><span className="eyebrow">YOUR SELECTED RIDE</span><h4>{car.name}</h4><p>{car.edition}</p></div><button className="text-button" onClick={onGarage}>Change <ChevronRight size={13} /></button></div>
      <div className="setting-block"><label>Race distance <span>{laps} {laps === 1 ? 'lap' : 'laps'}</span></label><div className="segmented">{[1,3,5].map(value => <button key={value} className={laps === value ? 'active' : ''} onClick={() => setLaps(value)}>{value} {value === 1 ? 'lap' : 'laps'}{value === 3 && <small>THE CLASSIC</small>}</button>)}</div></div>
      <div className="toggle-setting"><div><h4><Sparkles size={15} /> AI rivals</h4><p>{ai ? 'Three computer-controlled drivers. One finish line.' : 'Just you and the clock. Set a new personal best.'}</p></div><button className={`toggle ${ai ? 'on' : ''}`} role="switch" aria-checked={ai} aria-label="Race against AI rivals" onClick={() => setAi(!ai)}><span /></button></div>
      <div className="setup-summary"><span><MapPin size={14} /> {tracks.find(item => item.id === track)?.name}</span><span><Gauge size={14} /> {autoThrottle ? 'Auto throttle on' : 'Manual throttle'}</span></div>
      <button className="button primary start-race-button" onClick={() => onStart({ track, laps, ai })}><Flag size={17} /> LET’S DRIVE <ArrowRight size={18} /></button>
      <p className="setup-footnote">No downloads. No waiting. See you at the finish line.</p>
    </div>
  </div>;
}
