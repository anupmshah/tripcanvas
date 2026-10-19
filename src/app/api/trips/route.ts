import { z } from "zod";
import { prisma } from "@/lib/db";
import { addDays, diffDays, isDate } from "@/lib/dates";
import { geocode } from "@/lib/geo/nominatim";
import { body, err, json } from "@/lib/http";
import { createTrip } from "@/lib/trips";

export const runtime = "nodejs";
const Ccy = z.string().regex(/^[A-Za-z]{3}$/);
const Iata = z.string().regex(/^[A-Za-z]{3}$/);
const Create = z.object({
  title: z.string().min(1).max(120), originAirport: Iata, startDate: z.string().refine(isDate, "YYYY-MM-DD"),
  endDate: z.string().refine(isDate, "YYYY-MM-DD").optional(),
  adults: z.number().int().min(1).max(9), children: z.number().int().min(0).max(9),
  budgetAmount: z.number().positive().nullish(), budgetCurrency: Ccy.optional(),
  stops: z.array(z.object({
    city: z.string().min(1).max(80), country: z.string().min(1).max(80), airport: Iata.nullish(),
    localCurrency: Ccy, nights: z.number().int().min(1).max(60),
  })).min(1).max(8),
});

export async function GET() {
  const trips = await prisma.trip.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, destination: true, startDate: true, endDate: true } });
  return json({ trips });
}

export async function POST(req: Request) {
  const [d, bad] = await body(req, Create);
  if (bad) return bad;
  const total = d.stops.reduce((n, s) => n + s.nights, 0);
  if (d.endDate && diffDays(d.startDate, d.endDate) !== total)
    return err(400, `Nights per city add up to ${total} but the trip is ${diffDays(d.startDate, d.endDate)} nights long (${d.startDate} → ${d.endDate}). They must match.`);
  const stops = [];
  for (const s of d.stops) {
    const g = await geocode(`${s.city}, ${s.country}`);
    if (!g.found && !g.unavailable) return err(400, `Could not find "${s.city}, ${s.country}" on OpenStreetMap. Check the spelling.`);
    stops.push({ ...s, lat: g.lat ?? null, lng: g.lng ?? null, countryCode: g.countryCode ?? null });
  }
  const { trip } = await createTrip(prisma, { ...d, stops });
  return json({ id: trip.id, endDate: addDays(d.startDate, total) }, 201);
}
