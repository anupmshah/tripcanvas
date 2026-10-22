import { prisma } from "@/lib/db";
import { geocode } from "@/lib/geo/nominatim";
import { err, json } from "@/lib/http";

export const runtime = "nodejs";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = u.searchParams.get("q")?.trim();
  if (!q || q.length > 200) return err(400, "q required (≤200 chars)");
  const stopId = u.searchParams.get("stopId"), tripId = u.searchParams.get("tripId");
  const stop = stopId ? await prisma.stop.findUnique({ where: { id: stopId } })
    : tripId ? await prisma.stop.findFirst({ where: { tripId }, orderBy: { order: "asc" } }) : null;
  return json(await geocode(q, { near: stop?.lat != null ? { lat: stop.lat, lng: stop.lng! } : null, countryCode: stop?.countryCode, city: stop?.city, country: stop?.country }));
}
