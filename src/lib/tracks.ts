export type TrackId = 'coastal' | 'alpine' | 'neon';
export type Track = { id: TrackId; name: string; location: string; subtitle: string; distance: string; turns: number; difficulty: string; accent: string; points: [number, number][]; };
export const tracks: Track[] = [
  { id: 'coastal', name: 'Coastal Run', location: 'THE PACIFIC COAST', subtitle: 'Ocean air. Open throttle.', distance: '1.4', turns: 8, difficulty: 'Balanced', accent: '#eab485', points: [[0,0],[150,-40],[245,-185],[215,-355],[70,-445],[-100,-400],[-215,-240],[-185,-70]] },
  { id: 'alpine', name: 'Alpine Pass', location: 'THE NORTHERN ALPS', subtitle: 'Find your line. Own the climb.', distance: '1.6', turns: 10, difficulty: 'Technical', accent: '#a6c9d7', points: [[0,0],[170,-30],[260,-160],[140,-230],[250,-365],[80,-475],[-90,-400],[-40,-270],[-220,-230],[-200,-65]] },
  { id: 'neon', name: 'Neon District', location: 'DOWNTOWN · AFTER HOURS', subtitle: 'The city is your starting line.', distance: '1.3', turns: 8, difficulty: 'Fast', accent: '#9299ec', points: [[0,0],[200,0],[260,-130],[220,-320],[60,-380],[-130,-360],[-220,-220],[-180,-60]] },
];
export const getTrack = (id: string) => tracks.find(track => track.id === id) ?? tracks[0];
export const formatTime = (ms: number) => {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor(ms / 1000) % 60;
  const hundredths = Math.floor(ms / 10) % 100;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
};
