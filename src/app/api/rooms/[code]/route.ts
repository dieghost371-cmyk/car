import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { players, raceResults, rooms } from '@/db/schema';
import { ApiError, authenticate, jsonError, noStore, readBody, snapshot, validCar, validColor, validLaps, validTrack } from '@/lib/room-server';
import { getCar } from '@/lib/cars';
import { trackDistance } from '@/lib/track-distance';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) {
  return jsonError(async () => {
    const { code } = await context.params;
    await authenticate(request, code);
    return Response.json(await snapshot(code.toUpperCase()), noStore);
  });
}
export async function POST(request: Request, context: Context) {
  return jsonError(async () => {
    const { code: rawCode } = await context.params;
    const code = rawCode.toUpperCase();
    const { room, player } = await authenticate(request, code);
    const body = await readBody(request);
    const now = new Date();
    if (body.action === 'leave') {
      await db.transaction(async tx => {
        await tx.delete(players).where(eq(players.id, player.id));
        const remaining = await tx.select().from(players).where(eq(players.roomId, room.id)).orderBy(players.joinedAt);
        if (!remaining.length) { await tx.delete(rooms).where(eq(rooms.id, room.id)); return; }
        const unfinished = remaining.some(p => !p.finishedAt);
        await tx.update(rooms).set({ hostId: remaining.some(p => p.id === room.hostId) ? room.hostId : remaining[0].id, status: room.status === 'racing' && !unfinished ? 'finished' : room.status, updatedAt: now }).where(eq(rooms.id, room.id));
      });
      return Response.json({ left: true });
    }
    if (body.action === 'heartbeat') {
      await db.update(players).set({ lastSeen: now }).where(eq(players.id, player.id));
      return Response.json(await snapshot(code), noStore);
    }
    if (body.action === 'ready') {
      if (room.status !== 'waiting') throw new ApiError('The race is already underway.');
      if (typeof body.ready !== 'boolean') throw new ApiError('Invalid ready state.');
      await db.update(players).set({ ready: body.ready, lastSeen: now }).where(eq(players.id, player.id));
    } else if (body.action === 'customize') {
      if (room.status !== 'waiting') throw new ApiError('You can change cars between races.');
      await db.update(players).set({ carId: validCar(body.carId), color: validColor(body.color), lastSeen: now }).where(eq(players.id, player.id));
    } else if (body.action === 'setup') {
      if (room.hostId !== player.id) throw new ApiError('Only the host can change the circuit.', 403);
      if (room.status !== 'waiting') throw new ApiError('Wait until the race has finished.');
      await db.update(rooms).set({ track: validTrack(body.track), laps: validLaps(body.laps), updatedAt: now }).where(eq(rooms.id, room.id));
    } else if (body.action === 'start' || body.action === 'restart') {
      if (room.hostId !== player.id) throw new ApiError('Only the host can start the race.', 403);
      if (body.action === 'start' && room.status !== 'waiting') throw new ApiError('This race has already started.', 409);
      if (body.action === 'restart' && room.status !== 'finished') throw new ApiError('Finish this race before opening a new grid.', 409);
      await db.transaction(async tx => {
        const occupants = await tx.select().from(players).where(eq(players.roomId, room.id));
        if (!occupants.length || occupants.some(p => !p.ready)) throw new ApiError('Every driver needs to be ready before the lights go out.', 409);
        await tx.update(players).set({ progress: 0, lane: 0, speed: 0, lap: 1, finishedAt: null, lastStateAt: now, lastSeen: now }).where(eq(players.roomId, room.id));
        await tx.update(rooms).set({ status: 'racing', startAt: new Date(Date.now() + 5000), updatedAt: now }).where(eq(rooms.id, room.id));
      });
    } else if (body.action === 'state') {
      if (room.status !== 'racing' || !room.startAt) throw new ApiError('Waiting for the host to start.', 409);
      if (player.finishedAt || Date.now() < room.startAt.getTime()) return Response.json(await snapshot(code), noStore);
      if (![body.progress, body.lane, body.speed].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 100000)) throw new ApiError('Invalid race telemetry.');
      const total = trackDistance(room.track) * room.laps;
      const elapsed = Math.min(2, Math.max(0.05, (now.getTime() - player.lastStateAt.getTime()) / 1000));
      const maxSpeed = getCar(player.carId).topSpeed / 3.6 * 1.16;
      const progress = Math.min(total, Math.max(player.progress, Math.min(Number(body.progress), player.progress + maxSpeed * elapsed + 2)));
      const speed = Math.min(maxSpeed, Number(body.speed));
      const lane = Math.min(5.2, Number(body.lane));
      const lap = Math.min(room.laps, Math.floor(progress / trackDistance(room.track)) + 1);
      const finished = progress >= total;
      const raceStart = room.startAt.getTime();
      await db.transaction(async tx => {
        // Serialize finish writes for this room, then guard on the individual player.
        await tx.update(rooms).set({ updatedAt: now }).where(eq(rooms.id, room.id));
        const [updated] = await tx.update(players).set({ progress, speed, lane, lap, lastSeen: now, lastStateAt: now, finishedAt: finished ? now : null }).where(and(eq(players.id, player.id), isNull(players.finishedAt))).returning();
        if (updated && finished) {
          const finishers = await tx.select({ id: players.id }).from(players).where(and(eq(players.roomId, room.id), isNotNull(players.finishedAt)));
          await tx.insert(raceResults).values({ roomId: room.id, playerId: player.id, playerName: player.name, carId: player.carId, track: room.track, laps: room.laps, timeMs: Math.max(1, now.getTime() - raceStart), position: finishers.length, mode: 'multiplayer' });
          const occupants = await tx.select({ id: players.id, finishedAt: players.finishedAt }).from(players).where(eq(players.roomId, room.id));
          if (occupants.every(p => p.finishedAt !== null)) await tx.update(rooms).set({ status: 'finished' }).where(eq(rooms.id, room.id));
        }
      });
    } else throw new ApiError('Unknown room action.');
    return Response.json(await snapshot(code), noStore);
  });
}
