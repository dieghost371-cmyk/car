export type RoomPlayer = {
  id: string; name: string; carId: string; color: string; ready: boolean;
  progress: number; lane: number; speed: number; lap: number; finishTime: number | null;
};
export type RoomSnapshot = {
  room: { id: string; code: string; name: string; track: string; laps: number; status: 'waiting' | 'racing' | 'finished'; hostId: string; startAt: number | null };
  players: RoomPlayer[];
  serverTime: number;
};
export type Membership = { code: string; playerId: string; token: string };
export type PublicRoom = { code: string; name: string; track: string; laps: number; playerCount: number; createdAt: string };
export type RaceConfig = { carId: string; color: string; track: string; laps: number; mode: 'solo' | 'multiplayer'; playerName: string; ai: boolean; autoThrottle: boolean; sound: boolean; quality?: 'high' | 'balanced'; membership?: Membership; initialRoom?: RoomSnapshot };
