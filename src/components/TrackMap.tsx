import { getTrack } from '@/lib/tracks';
export function mapPath(id: string, width = 180, height = 120) {
  const points = getTrack(id).points;
  const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const scale = Math.min((width - 30) / (maxX - minX), (height - 24) / (maxZ - minZ));
  return points.map((p, index) => `${index ? 'L' : 'M'} ${(15 + (p[0] - minX) * scale + (width - 30 - (maxX - minX) * scale) / 2).toFixed(1)} ${(12 + (p[1] - minZ) * scale).toFixed(1)}`).join(' ') + ' Z';
}
export default function TrackMap({ track, className = '' }: { track: string; className?: string }) {
  const path = mapPath(track);
  return <svg viewBox="0 0 180 120" className={`track-map ${className}`} fill="none" aria-label={`${getTrack(track).name} circuit layout`} role="img">
    <path d={path} stroke="currentColor" strokeWidth="11" opacity=".07" strokeLinejoin="round" />
    <path d={path} stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    <circle cx={path.split(' ')[1]} cy={path.split(' ')[2]} r="4" fill="#f47735" stroke="#17191c" strokeWidth="2" />
  </svg>;
}
