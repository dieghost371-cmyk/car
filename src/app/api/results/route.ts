import { db } from '@/db';
import { raceResults } from '@/db/schema';
import { ApiError, cleanName, jsonError, readBody, validCar, validLaps, validTrack } from '@/lib/room-server';
import { getCar } from '@/lib/cars';
import { trackDistance } from '@/lib/track-distance';
export async function POST(request: Request) {
  return jsonError(async () => {
    const body = await readBody(request);
    const playerName = cleanName(body.playerName);
    const carId = validCar(body.carId);
    const track = validTrack(body.track);
    const laps = validLaps(body.laps);
    const timeMs = Number(body.timeMs);
    const minTime = trackDistance(track) * laps / (getCar(carId).topSpeed / 3.6 * 1.16) * 1000;
    if (!Number.isInteger(timeMs) || timeMs < minTime || timeMs > 7200000) throw new ApiError('That race time could not be verified.');
    await db.insert(raceResults).values({ playerName, carId, track, laps, timeMs, mode: 'solo', position: Math.min(6, Math.max(1, Number(body.position) || 1)) });
    return Response.json({ saved: true }, { status: 201 });
  });
}
