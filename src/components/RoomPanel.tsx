'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, CheckCheck, Copy, Crown, Eye, EyeOff, Flag, Globe2, KeyRound, Link, LoaderCircle, LockKeyhole, LogOut, Plus, RefreshCw, ShieldCheck, UserRound, UserRoundPlus, Users, Wifi, WifiOff } from 'lucide-react';
import { api, copyText } from '@/lib/client';
import { cars, getCar, type Car } from '@/lib/cars';
import { tracks, getTrack } from '@/lib/tracks';
import type { Membership, PublicRoom, RaceConfig, RoomSnapshot } from '@/lib/multiplayer';
import TrackMap from '@/components/TrackMap';

type Props = { membership: Membership | null; onMembership: (membership: Membership | null) => void; car: Car; playerName: string; autoThrottle: boolean; sound: boolean; initialCode: string; onStart: (config: RaceConfig) => void; onToast: (message: string) => void };
export default function RoomPanel({ membership, onMembership, car, playerName, autoThrottle, sound, initialCode, onStart, onToast }: Props) {
  const [tab, setTab] = useState(initialCode ? 'join' : 'create');
  const [name, setName] = useState('Midnight runners');
  const [driver, setDriver] = useState(playerName);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(initialCode);
  const [showPassword, setShowPassword] = useState(false);
  const [track, setTrack] = useState('coastal');
  const [laps, setLaps] = useState(3);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState('');
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [connected, setConnected] = useState(true);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState('');
  const [revision, setRevision] = useState(0);
  const launched = useRef<number | null>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refreshRooms = useCallback(async () => {
    setRoomsLoading(true); setRoomsError('');
    try { const data = await api<{ rooms: PublicRoom[] }>('/api/rooms'); if (alive.current) setPublicRooms(data.rooms); }
    catch (err) { if (alive.current) setRoomsError((err as Error).message); }
    finally { if (alive.current) setRoomsLoading(false); }
  }, []);
  useEffect(() => { if (!membership) { void refreshRooms(); const timer = setInterval(() => void refreshRooms(), 12000); return () => clearInterval(timer); } }, [membership, refreshRooms]);
  useEffect(() => {
    if (!membership) { setSnapshot(null); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let count = 0;
    const controller = new AbortController();
    const poll = async () => {
      try {
        if (count++ % 7 === 0) await api(`/api/rooms/${membership.code}`, { method: 'POST', body: { action: 'heartbeat' }, membership, signal: controller.signal });
        const data = await api<RoomSnapshot>(`/api/rooms/${membership.code}`, { membership, signal: controller.signal });
        if (stopped) return;
        setSnapshot(data); setConnected(true);
        timer = setTimeout(poll, data.room.status === 'waiting' ? 1000 : 600);
      } catch (err) {
        if (stopped || (err as Error).name === 'AbortError') return;
        const status = (err as { status?: number }).status;
        if (status === 401 || status === 404) { onMembership(null); onToast((err as Error).message); return; }
        setConnected(false); timer = setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [membership, onMembership, onToast, revision]);
  useEffect(() => {
    if (!snapshot || !membership) return;
    if (snapshot.room.status === 'waiting') launched.current = null;
    if (snapshot.room.status === 'racing' && snapshot.room.startAt && launched.current !== snapshot.room.startAt) {
      launched.current = snapshot.room.startAt;
      const player = snapshot.players.find(item => item.id === membership.playerId);
      if (player) onStart({ carId: player.carId, color: player.color, track: snapshot.room.track, laps: snapshot.room.laps, mode: 'multiplayer', playerName: player.name, ai: false, autoThrottle, sound, membership, initialRoom: snapshot });
    }
  }, [snapshot, membership, onStart, autoThrottle, sound]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await api<{ membership: Membership }>(tab === 'create' ? '/api/rooms' : '/api/rooms/join', { method: 'POST', body: tab === 'create' ? { name, password, playerName: driver, carId: car.id, color: car.color, track, laps } : { code, password, playerName: driver, carId: car.id, color: car.color } });
      setPassword(''); onMembership(data.membership); onToast(tab === 'create' ? 'Your grid is open. Invite your people.' : 'You’re on the grid. Get ready to race.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const action = async (body: Record<string, unknown>, leave = false) => {
    if (!membership) return;
    setActionBusy(true);
    try {
      const data = await api<RoomSnapshot & { left?: boolean }>(`/api/rooms/${membership.code}`, { method: 'POST', body, membership });
      if (leave) { onMembership(null); setSnapshot(null); onToast('You’ve left the grid. See you on the road.'); }
      else setSnapshot(data);
    } catch (err) { onToast((err as Error).message); if ((err as { status?: number }).status === 404) onMembership(null); }
    finally { setActionBusy(false); }
  };
  const copy = async (invite = false) => {
    if (!snapshot) return;
    const url = new URL(window.location.href); url.search = `?room=${snapshot.room.code}`; url.hash = '';
    try { await copyText(invite ? url.toString() : snapshot.room.code); onToast(invite ? 'Invite link copied. Share the password privately.' : 'Room code copied. Get your crew together.'); } catch (err) { onToast((err as Error).message); }
  };
  if (membership && snapshot) {
    const me = snapshot.players.find(player => player.id === membership.playerId);
    const host = snapshot.room.hostId === membership.playerId;
    const allReady = snapshot.players.every(player => player.ready);
    return <div className="room-lobby page-enter"><div className="section-page-heading"><div><p className="eyebrow orange"><LockKeyhole size={12} /> YOUR PRIVATE PADDOCK</p><h1>{snapshot.room.name}</h1><p>Good company. Great racing. Everyone ready?</p></div><button className="button secondary small" onClick={() => void action({ action: 'leave' }, true)} disabled={actionBusy}><LogOut size={14} /> Leave room</button></div>
      <div className={`connection-banner ${connected ? '' : 'reconnecting'}`}>{connected ? <Wifi size={14} /> : <WifiOff size={14} />}<span>{connected ? 'Live connection · Race progress syncs across devices' : 'Reconnecting to the grid… Keep this window open.'}</span><b>{snapshot.players.length} / 3 DRIVERS</b></div>
      <div className="lobby-layout"><div><div className="player-slots">{[0,1,2].map(index => { const player = snapshot.players[index]; return <div className={`player-slot ${player ? '' : 'empty'}`} key={player?.id ?? index}>
        {player ? <><div className="player-avatar" style={{ '--player-color': player.color } as React.CSSProperties}>{player.name.slice(0,2).toUpperCase()}{player.id === snapshot.room.hostId && <span><Crown size={11} /></span>}</div><div className="player-info"><span className="eyebrow">{player.id === snapshot.room.hostId ? 'ROOM HOST' : 'DRIVER'} {player.id === me?.id && <em>YOU</em>}</span><h3>{player.name}</h3><p>{getCar(player.carId).name}</p></div><span className={`ready-badge ${player.ready ? 'ready' : ''}`}>{player.finishTime ? <><Flag size={12} /> Finished</> : player.ready ? <><Check size={12} /> Ready</> : 'Getting ready'}</span></> : <><div className="empty-avatar"><UserRoundPlus size={24} /></div><div className="player-info"><span className="eyebrow">OPEN SEAT</span><h3>Your friend goes here.</h3><p>Share the code. Make it a rivalry.</p></div><button className="icon-button" onClick={() => void copy(true)} aria-label="Copy invite for open seat"><Link size={17} /></button></>}
      </div>; })}</div>
      <div className="lobby-car-setup"><label>Your machine<select className="field" value={me?.carId ?? car.id} disabled={snapshot.room.status !== 'waiting' || actionBusy} onChange={event => { const chosen = getCar(event.target.value); void action({ action: 'customize', carId: chosen.id, color: chosen.color }); }}>{cars.map(item => <option key={item.id} value={item.id}>{item.name} · {item.edition}</option>)}</select></label><div className="lobby-track-map"><TrackMap track={snapshot.room.track} /><div><span className="eyebrow">THE CIRCUIT</span><h3>{getTrack(snapshot.room.track).name}</h3><p>{snapshot.room.laps} laps · {getTrack(snapshot.room.track).distance} km per lap</p></div></div></div>
      {snapshot.room.status === 'finished' && <div className="notice success"><Flag size={17} /><span>That’s a wrap. Your finish times are on the leaderboard.</span></div>}
      <div className="lobby-actions"><button className={`button ${me?.ready ? 'secondary' : 'primary'}`} disabled={actionBusy || snapshot.room.status !== 'waiting'} onClick={() => void action({ action: 'ready', ready: !me?.ready })}><CheckCheck size={17} />{me?.ready ? 'Ready to roll' : 'I’m ready'}</button>{host ? <button className="button primary" disabled={!allReady || actionBusy || snapshot.room.status === 'racing'} onClick={() => void action({ action: snapshot.room.status === 'finished' ? 'restart' : 'start' })}><Flag size={17} />{snapshot.room.status === 'finished' ? 'Open a new grid' : snapshot.room.status === 'racing' ? 'Race in progress' : `Start race · ${snapshot.players.length}/3`}<ArrowRight size={17} /></button> : <span className="waiting-host"><LoaderCircle size={16} className="spin" />{snapshot.room.status === 'finished' ? 'Waiting for the host to reopen the grid' : 'The host starts when everyone is ready'}</span>}</div><p className="setup-footnote">1–3 drivers per room. The host can launch with any number of ready drivers.</p>
      </div><aside className="invite-panel"><span className="eyebrow orange">GET YOUR CREW IN HERE</span><h2>One code.<br />A shared starting line.</h2><p>Friends can join from their own phone or computer. No account needed.</p><label>ROOM CODE</label><button className="room-code-display" onClick={() => void copy()} title="Copy room code">{snapshot.room.code}<Copy size={18} /></button><button className="button secondary" onClick={() => void copy(true)}><Link size={15} /> Copy invite link</button><div className="notice"><ShieldCheck size={17} /><span>Share the invite link and password separately. Only people with both can join.</span></div>
      {host && snapshot.room.status === 'waiting' && <div className="host-settings"><span className="eyebrow">HOST SETTINGS</span><label>Circuit<select className="field" value={snapshot.room.track} disabled={actionBusy} onChange={event => void action({ action: 'setup', track: event.target.value, laps: snapshot.room.laps })}>{tracks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Laps<select className="field" value={snapshot.room.laps} disabled={actionBusy} onChange={event => void action({ action: 'setup', track: snapshot.room.track, laps: Number(event.target.value) })}>{[1,3,5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'lap' : 'laps'}</option>)}</select></label></div>}
      </aside></div></div>;
  }
  if (membership) return <div className="loading-state room-loading"><LoaderCircle className="spin" size={26} /><span>Reconnecting to your paddock…</span><button className="text-button" onClick={() => { onMembership(null); }}>Back to rooms</button></div>;
  return <div className="multiplayer-page page-enter"><div className="section-page-heading"><div><p className="eyebrow orange">BETTER WITH YOUR PEOPLE</p><h1>Your crew. Your grid.</h1><p>Make a private room, send the code, and settle it on the track.</p></div><span className="count-label"><Users size={16} /> Up to 3 friends per room</span></div>
    <div className="multiplayer-layout"><div className="room-form-panel"><div className="room-tabs"><button className={tab === 'create' ? 'active' : ''} onClick={() => { setTab('create'); setError(''); }}><Plus size={16} /> Create a room</button><button className={tab === 'join' ? 'active' : ''} onClick={() => { setTab('join'); setError(''); }}><KeyRound size={16} /> Join a room</button></div>
      <form onSubmit={submit} className="room-form"><h2>{tab === 'create' ? 'Save a place for your rivals.' : 'Got an invite? Take your seat.'}</h2><p>{tab === 'create' ? 'You call the shots. They bring the competition.' : 'Enter your friend’s room code and private password.'}</p>
        <label>Driver name<input className="field" value={driver} onChange={event => setDriver(event.target.value)} minLength={2} maxLength={24} required placeholder="What should we call you?" autoComplete="nickname" /></label>
        {tab === 'create' ? <label>Room name<input className="field" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={24} required placeholder="Midnight runners" /></label> : <label>Room code<input ref={passwordInput} className="field code-input" value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} minLength={6} maxLength={6} required placeholder="ABC123" autoComplete="off" spellCheck={false} /></label>}
        <label>Room password <span className="label-hint">{tab === 'create' ? 'Only share with your friends' : 'Ask your friend for this'}</span><div className="password-field"><LockKeyhole size={16} /><input value={password} onChange={event => setPassword(event.target.value)} type={showPassword ? 'text' : 'password'} minLength={4} maxLength={64} required placeholder={tab === 'create' ? 'Create a password (4+ characters)' : 'Enter the room password'} autoComplete="off" /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
        {tab === 'create' && <div className="form-two-col"><label>Circuit<select className="field" value={track} onChange={event => setTrack(event.target.value)}>{tracks.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Race distance<select className="field" value={laps} onChange={event => setLaps(Number(event.target.value))}>{[1,3,5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'lap' : 'laps'}</option>)}</select></label></div>}
        <div className="form-selected-car"><img src={car.image} alt="" /><div><span className="eyebrow">YOU’RE DRIVING</span><b>{car.name}</b></div><span className={`tiny-class class-${car.class.toLowerCase()}`}>{car.class} {car.rating}</span></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button primary full-width" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : tab === 'create' ? <Plus size={17} /> : <KeyRound size={17} />}{busy ? 'Opening the paddock…' : tab === 'create' ? 'Create private room' : 'Join the grid'}<ArrowRight size={17} /></button><p className="secure-note"><ShieldCheck size={13} /> Password protected. No sign-up. Just racing.</p>
      </form></div>
      <aside className="friends-promo"><div className="friends-art"><div className="friend-road" /><span className="friend-avatar one"><UserRound size={31} /></span><span className="friend-connector" /><span className="friend-avatar two"><UserRound size={37} /></span><span className="friend-connector second" /><span className="friend-avatar three"><UserRound size={31} /></span><span className="friends-live"><span className="status-dot" /> SAME GRID. ANYWHERE.</span></div><div className="friends-promo-copy"><p className="eyebrow orange">DISTANCE ISN’T A LIMIT</p><h2>GOOD DRIVES.<br />BETTER COMPANY.</h2><p>Local or a world apart. If your friends have a browser, they have a place on your starting line.</p><ol><li><span>01</span><div><b>Make it private</b><p>Create a room with your own password.</p></div></li><li><span>02</span><div><b>Call your crew</b><p>Share the code. Everyone picks a ride.</p></div></li><li><span>03</span><div><b>Light up the starting line</b><p>Ready up. The host starts the race.</p></div></li></ol><div className="friends-platforms"><Globe2 size={16} /><span>PC & mobile · Live multiplayer · 3 drivers</span></div></div></aside>
    </div>
    <section className="open-rooms"><div className="section-title-row"><div><p className="eyebrow">FIND YOUR NEXT RIVALRY</p><h2>Open grids</h2></div><button className="text-button" onClick={() => void refreshRooms()} disabled={roomsLoading}><RefreshCw size={14} className={roomsLoading ? 'spin' : ''} /> Refresh</button></div>{roomsLoading && !publicRooms.length ? <div className="loading-state"><LoaderCircle className="spin" size={18} /> Looking for open grids…</div> : roomsError ? <div className="notice">{roomsError}<button className="text-button" onClick={() => void refreshRooms()}>Retry</button></div> : publicRooms.length ? <div className="public-room-list">{publicRooms.map(room => <div className="public-room" key={room.code}><div className="public-room-icon"><Flag size={19} /></div><div><h3>{room.name}</h3><p>{getTrack(room.track).name} · {room.laps} laps</p></div><span className="public-room-count"><Users size={14} /> {room.playerCount}/3</span><span className="private-label"><LockKeyhole size={12} /> Password protected</span><button className="button secondary small" onClick={() => { setTab('join'); setCode(room.code); setError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => passwordInput.current?.focus(), 100); }}>Join room <ArrowRight size={13} /></button></div>)}</div> : <div className="no-rooms"><Users size={24} /><div><h3>The next grid could be yours.</h3><p>No open rooms right now. Create one and bring your friends.</p></div><button className="text-button orange" onClick={() => { setTab('create'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Open a grid <ArrowRight size={14} /></button></div>}</section>
  </div>;
}
