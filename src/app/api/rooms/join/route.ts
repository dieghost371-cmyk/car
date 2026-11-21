import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { players, rooms } from '@/db/schema';
import { ApiError, cleanName, jsonError, newId, newMembership, readBody, validCar, validColor, validPassword, verifyPassword } from '@/lib/room-server';

export const dynamic = 'force-dynamic';
const attempts = new Map<string, { count: number; reset: number }>();
export async function POST(request: Request) {
  return jsonError(async () => {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'local';
    const now = Date.now();
    const attempt = attempts.get(ip);
    if (attempt && attempt.reset > now && attempt.count >= 30) throw new ApiError('Too many join attempts. Please wait a minute and try again.', 429);
    attempts.set(ip, { count: attempt && attempt.reset > now ? attempt.count + 1 : 1, reset: attempt && attempt.reset > now ? attempt.reset : now + 60000 });
    if (attempts.size > 10000) attempts.clear();
    const body = await readBody(request);
    if (typeof body.code !== 'string' || !/^[A-Z0-9]{6}$/i.test(body.code.trim())) throw new ApiError('Enter the 6-character room code.');
    const code = body.code.trim().toUpperCase();
    const password = validPassword(body.password);
    const name = cleanName(body.playerName);
    const carId = validCar(body.carId);
    const color = validColor(body.color);
    const id = newId();
    const { membership, tokenHash } = newMembership(code, id);
    await db.transaction(async tx => {
      const [room] = await tx.select().from(rooms).where(eq(rooms.code, code)).for('update');
      if (!room) throw new ApiError('No room with that code. Double-check it with your friend.', 404);
      if (!await verifyPassword(password, room.passwordHash)) throw new ApiError('That password doesn’t match. Try again.', 403);
      if (room.status !== 'waiting') throw new ApiError('This race has already started. Ask the host to open a new grid.', 409);
      await tx.delete(players).where(and(eq(players.roomId, room.id), lt(players.lastSeen, new Date(Date.now() - 120000))));
      const occupants = await tx.select().from(players).where(eq(players.roomId, room.id)).orderBy(players.joinedAt);
      if (occupants.length >= 3) throw new ApiError('This grid is full. Each room has space for 3 drivers.', 409);
      const hostId = occupants.length && !occupants.some(player => player.id === room.hostId) ? occupants[0].id : room.hostId;
      await tx.insert(players).values({ id, roomId: room.id, name, carId, color, tokenHash });
      await tx.update(rooms).set({ hostId, updatedAt: new Date() }).where(eq(rooms.id, room.id));
    });
    return Response.json({ membership }, { status: 201 });
  });
}
