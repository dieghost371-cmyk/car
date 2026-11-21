import { randomInt } from 'node:crypto';
import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '@/db';
import { rooms, players } from '@/db/schema';
import { cleanName, hashPassword, jsonError, newId, newMembership, noStore, readBody, validCar, validColor, validLaps, validPassword, validTrack } from '@/lib/room-server';

export const dynamic = 'force-dynamic';
export async function GET() {
  return jsonError(async () => {
    const available = await db.select({ code: rooms.code, name: rooms.name, track: rooms.track, laps: rooms.laps, playerCount: count(players.id), createdAt: rooms.createdAt })
      .from(rooms).leftJoin(players, eq(players.roomId, rooms.id))
      .where(and(eq(rooms.status, 'waiting'), gt(rooms.updatedAt, new Date(Date.now() - 2 * 60 * 60 * 1000))))
      .groupBy(rooms.id).orderBy(rooms.createdAt).limit(30);
    return Response.json({ rooms: available.filter(room => room.playerCount < 3) }, noStore);
  });
}
export async function POST(request: Request) {
  return jsonError(async () => {
    const body = await readBody(request);
    const name = cleanName(body.name, 'Room name');
    const playerName = cleanName(body.playerName);
    const password = await hashPassword(validPassword(body.password));
    const carId = validCar(body.carId);
    const color = validColor(body.color);
    const track = validTrack(body.track);
    const laps = validLaps(body.laps);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
    const hostId = newId();
    const { membership, tokenHash } = newMembership(code, hostId);
    await db.transaction(async tx => {
      await tx.insert(rooms).values({ id: newId(), code, name, passwordHash: password, track, laps, hostId });
      await tx.insert(players).values({ id: hostId, roomId: (await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)))[0].id, name: playerName, carId, color, tokenHash, ready: true });
    });
    return Response.json({ membership }, { status: 201 });
  });
}
