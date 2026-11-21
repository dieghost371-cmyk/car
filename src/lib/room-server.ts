import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { cars } from '@/lib/cars';
import { tracks } from '@/lib/tracks';
import type { RoomSnapshot } from '@/lib/multiplayer';

const scrypt = promisify(scryptCallback);
export class ApiError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const key = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export function cleanName(value: unknown, label = 'Driver name') {
  if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 24) throw new ApiError(`${label} must be between 2 and 24 characters.`);
  return value.trim().replace(/[\x00-\x1f]/g, '');
}
export function validCar(value: unknown) {
  if (!cars.some(car => car.id === value)) throw new ApiError('Please select a valid car.');
  return value as string;
}
export function validColor(value: unknown) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new ApiError('Please select a valid paint color.');
  return value;
}
export function validTrack(value: unknown) {
  if (!tracks.some(track => track.id === value)) throw new ApiError('Please select a valid circuit.');
  return value as string;
}
export function validLaps(value: unknown) {
  if (![1, 3, 5].includes(Number(value))) throw new ApiError('Choose 1, 3, or 5 laps.');
  return Number(value);
}
export function validPassword(value: unknown) {
  if (typeof value !== 'string' || value.length < 4 || value.length > 64) throw new ApiError('Room password must be between 4 and 64 characters.');
  return value;
}
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (text.length > 8192) throw new ApiError('Request is too large.', 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('Please send a valid JSON request.'); }
}
export async function jsonError(handler: () => Promise<Response>) {
  try { return await handler(); } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    console.error('APEX API error:', error);
    return Response.json({ error: 'The paddock is temporarily unavailable. Please try again.' }, { status: 500 });
  }
}
export const noStore = { headers: { 'Cache-Control': 'no-store, max-age=0' } };
export async function snapshot(code: string): Promise<RoomSnapshot> {
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room) throw new ApiError('This room no longer exists. Create a new one to get back on track.', 404);
  const racers = await db.select().from(players).where(eq(players.roomId, room.id)).orderBy(players.joinedAt);
  return {
    room: { id: room.id, code: room.code, name: room.name, track: room.track, laps: room.laps, status: room.status as RoomSnapshot['room']['status'], hostId: room.hostId, startAt: room.startAt?.getTime() ?? null },
    players: racers.map(player => ({ id: player.id, name: player.name, carId: player.carId, color: player.color, ready: player.ready, progress: player.progress, lane: player.lane, speed: player.speed, lap: player.lap, finishTime: player.finishedAt && room.startAt ? player.finishedAt.getTime() - room.startAt.getTime() : null })),
    serverTime: Date.now(),
  };
}
export async function authenticate(request: Request, code: string) {
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token || token.length > 128) throw new ApiError('Join this room to take the wheel.', 401);
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()));
  if (!room) throw new ApiError('Room not found. Check the code or create a new room.', 404);
  const [player] = await db.select().from(players).where(and(eq(players.roomId, room.id), eq(players.tokenHash, hashToken(token))));
  if (!player) throw new ApiError('Your room session expired. Please rejoin with the room password.', 401);
  return { room, player };
}
export function newMembership(code: string, playerId: string) {
  const token = randomBytes(32).toString('hex');
  return { membership: { code, playerId, token }, tokenHash: hashToken(token) };
}
export const newId = randomUUID;
