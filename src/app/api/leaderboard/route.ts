import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { raceResults } from '@/db/schema';
import { jsonError, noStore, validLaps, validTrack } from '@/lib/room-server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return jsonError(async () => {
    const params = new URL(request.url).searchParams;
    const track = validTrack(params.get('track') ?? 'coastal');
    const laps = validLaps(params.get('laps') ?? '3');
    const results = await db.select().from(raceResults).where(and(eq(raceResults.track, track), eq(raceResults.laps, laps))).orderBy(asc(raceResults.timeMs)).limit(50);
    return Response.json({ results }, noStore);
  });
}
