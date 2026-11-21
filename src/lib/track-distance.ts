import { getTrack } from '@/lib/tracks';
export const trackDistance = (id: string) => Math.round(Number(getTrack(id).distance) * 1000);
