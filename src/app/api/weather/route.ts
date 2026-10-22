import { prisma } from "@/lib/db";
import { err, json } from "@/lib/http";
import { getForecast } from "@/lib/info/weather";

export const runtime = "nodejs";
/** Per-stop forecast covering the days spent in each city. */
export async function GET(req: Request) {
  const tripId = new URL(req.url).searchParams.get("tripId");
  if (!tripId) return err(400, "tripId required");
  const stops = await prisma.stop.findMany({
    where: { tripId },
    orderBy: { order: "asc" },
    include: { days: { orderBy: { index: "asc" } } },
  });
  if (!stops.length) return err(404, "Trip not found");
  const out = await Promise.all(
    stops.map(async (s) => {
      const dates = s.days.map((d) => d.date);
      if (s.lat == null || s.lng == null)
        return {
          stopId: s.id,
          city: s.city,
          available: false as const,
          reason: "City location unknown",
        };
      return {
        stopId: s.id,
        city: s.city,
        ...(await getForecast(s.lat, s.lng, dates[0], dates.at(-1)!)),
      };
    }),
  );
  return json({ stops: out });
}
