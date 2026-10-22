import "server-only";
import { createHash } from "node:crypto";
import type { Item, Day, Stop, Trip } from "@prisma/client";
import { prisma } from "../db";
import { env } from "../env";
import { callJson } from "../llm/openai";
import { FlightEstimate, flightPartyPrice } from "../money/flight";
import { searchFlightsWithFallback } from "./index";

const g = globalThis as unknown as { __flightEstimates?: Map<string, Promise<Awaited<ReturnType<typeof fetchEstimate>>>> };
async function fetchEstimate(origin: string, dest: string, depart: string, key: string) {
  const hit = await prisma.offerCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < 864e5) {
    const parsed = FlightEstimate.safeParse(JSON.parse(hit.offersJson));
    if (parsed.success) return { estimate: parsed.data, fetchedAt: hit.fetchedAt };
  }
  const estimate = await callJson(FlightEstimate, [{ role: "system", content: 'Return structured JSON: {currency:"USD",adult:{low,mid,high},child:{low,mid,high},infant:{low,mid,high}}. All amounts are rough ONE-WAY economy airfare estimates PER PERSON in USD for these exact airports and date, including typical taxes. Infant means lap infant under 2. Ordered nonnegative ranges. Use your general knowledge and seasonal uncertainty, not live quotes. No claim of availability.' }, { role: "user", content: JSON.stringify({ origin, dest, depart }) }]);
  const fetchedAt = new Date(), data = { provider: "llm-flight", offersJson: JSON.stringify(estimate), fetchedAt };
  await prisma.offerCache.upsert({ where: { key }, create: { key, ...data }, update: data });
  return { estimate, fetchedAt };
}
export async function flightEstimate(origin: string, dest: string, depart: string) {
  const key = `flight-estimate:${createHash("sha1").update(JSON.stringify({ origin, dest, depart })).digest("hex")}`;
  const pending = g.__flightEstimates ??= new Map();
  if (!pending.has(key)) pending.set(key, fetchEstimate(origin, dest, depart, key).finally(() => pending.delete(key)));
  return pending.get(key)!;
}

/** Enrich only proposed flights. Conditional writes protect edits/bookings made during a model call. */
export async function ensureFlightPrices(t: Trip & { stops: Stop[]; days: (Day & { items: Item[] })[] }) {
  await Promise.all(t.days.flatMap((day) => day.items.filter((i) => i.type === "flight" && i.status !== "booked" && i.priceSource !== "entered").map(async (item) => {
    const stop = t.stops.find((s) => s.id === day.stopId)!;
    const home = day.index === t.days.length - 1;
    const origin = home ? stop.airport ?? stop.city : stop.order === 0 ? t.originAirport : t.stops[stop.order - 1].airport ?? t.stops[stop.order - 1].city;
    const dest = home ? t.originAirport : stop.airport ?? stop.city;
    const fingerprint = `llm-flight:${origin}:${dest}:${day.date}:${t.adults}:${t.children}:${t.infants}`;
    if (item.priceSource === "live" || (!env.DUFFEL_ACCESS_TOKEN && item.provider === fingerprint && item.price != null)) return;
    try {
      const result = await searchFlightsWithFallback({ origin, dest, dates: { depart: day.date }, travellers: { adults: t.adults, children: t.children, infants: t.infants } });
      const live = result.offers.find((o) => o.isLive && o.price != null && o.currency);
      const quote = live ? null : await flightEstimate(origin, dest, day.date);
      const data = live ? { price: live.price, currency: live.currency, priceLow: null, priceHigh: null, priceSource: "live", priceFetchedAt: new Date(live.fetchedAt), provider: live.provider, offerId: live.offerId ?? null, sourceUrl: live.deepLink }
        : { ...flightPartyPrice(quote!.estimate, t), priceSource: "estimate", priceFetchedAt: quote!.fetchedAt, provider: fingerprint, offerId: null, sourceUrl: null };
      const changed = await prisma.item.updateMany({ where: { id: item.id, status: "proposed", dayId: day.id, priceSource: item.priceSource, updatedAt: item.updatedAt }, data });
      if (changed.count) Object.assign(item, data);
    } catch { console.warn("Flight estimate unavailable; retry by reloading the trip."); }
  })));
}
