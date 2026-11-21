'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Flag, Globe2, RefreshCw, Trophy } from 'lucide-react';
import { api } from '@/lib/client';
import { getCar } from '@/lib/cars';
import { tracks, formatTime } from '@/lib/tracks';
import TrackMap from '@/components/TrackMap';
type Result = { id: string; playerName: string; carId: string; timeMs: number; mode: string; createdAt: string };
export default function Leaderboard({ onSolo }: { onSolo: () => void }) {
  const [track, setTrack] = useState('coastal');
  const [laps, setLaps] = useState(3);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api<{ results: Result[] }>(`/api/leaderboard?track=${track}&laps=${laps}`, { signal: controller.signal }).then(data => { setResults(data.results); setLoading(false); }).catch(err => { if (err.name !== 'AbortError') { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, [track, laps, refresh]);
  const current = tracks.find(item => item.id === track)!;
  return <div className="leaderboard-page page-enter"><div className="section-page-heading"><div><p className="eyebrow orange">LEAVE YOUR MARK</p><h1>Fast is a feeling. A record is forever.</h1><p>The fastest drivers on every circuit. Real races. Real times.</p></div><span className="count-label"><Globe2 size={15} /> Global leaderboard</span></div>
    <div className="leaderboard-toolbar"><div className="filter-tabs">{tracks.map(item => <button className={track === item.id ? 'active' : ''} key={item.id} onClick={() => setTrack(item.id)}>{item.name}</button>)}</div><div className="flex items-center gap-3"><select className="field compact-field" aria-label="Leaderboard race distance" value={laps} onChange={event => setLaps(Number(event.target.value))}>{[1,3,5].map(value => <option key={value} value={value}>{value} {value === 1 ? 'lap' : 'laps'}</option>)}</select><button className="icon-button" aria-label="Refresh leaderboard" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button></div></div>
    <div className="leaderboard-banner"><div><span className="eyebrow">{current.location}</span><h2>{current.name}</h2><p>{current.distance} km · {current.turns} corners · {laps} {laps === 1 ? 'lap' : 'laps'}</p>{results[0] && <span className="record-holder"><Trophy size={14} /> {results[0].playerName} holds the record · {formatTime(results[0].timeMs)}</span>}</div><TrackMap track={track} /></div>
    <div className="leaderboard-table-wrap"><table className="leaderboard-table"><thead><tr><th>RANK</th><th>DRIVER</th><th>MACHINE</th><th>RACE TIME</th><th>GAP</th><th>SESSION</th></tr></thead><tbody>{results.map((result, index) => <tr key={result.id}><td><span className={`rank rank-${index + 1}`}>{index === 0 ? <Trophy size={17} /> : String(index + 1).padStart(2,'0')}</span></td><td><span className="table-avatar">{result.playerName.slice(0,2).toUpperCase()}</span><b>{result.playerName}</b></td><td>{getCar(result.carId).name}<small>{getCar(result.carId).edition}</small></td><td className="time-cell">{formatTime(result.timeMs)}</td><td className="muted">{index ? `+${((result.timeMs - results[0].timeMs) / 1000).toFixed(2)}s` : 'LEADER'}</td><td><span className="session-badge">{result.mode === 'solo' ? 'Solo' : 'Multiplayer'}</span></td></tr>)}</tbody></table>
    {loading ? <div className="loading-state"><RefreshCw className="spin" size={23} /> Timing the grid…</div> : error ? <div className="empty-state"><p>{error}</p><button className="button secondary" onClick={() => setRefresh(value => value + 1)}>Try again</button></div> : !results.length && <div className="empty-state"><div className="empty-icon"><Flag size={30} /></div><h3>The first record is yours to set.</h3><p>No finished races on this grid yet. Take a car out and make some history.</p><button className="button primary" onClick={onSolo}>Set the first time <ArrowRight size={16} /></button></div>}
    </div><p className="garage-disclaimer">Rankings match circuit and race distance. Solo and multiplayer finishes are identified separately.</p>
  </div>;
}
