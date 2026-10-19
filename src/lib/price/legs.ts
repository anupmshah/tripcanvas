import "server-only";
import type { TripDTO } from "../dto";
import { searchFlightsWithFallback } from "./index";
export function flightLegs(dto: Pick<TripDTO, "trip" | "stops" | "days">) {
  const { trip: t, stops, days } = dto;
  const legs: { id: string; origin: string; dest: string; depart: string; dayIndex: number; optional: boolean }[] = [];
  if (stops[0]?.airport) legs.push({ id: "outbound", origin: t.originAirport, dest: stops[0].airport, depart: t.startDate, dayIndex: 0, optional: false });
  stops.slice(1).forEach((s, k) => {
    if (stops[k].airport && s.airport) legs.push({ id: `to:${s.id}`, origin: stops[k].airport!, dest: s.airport, depart: s.startDate, dayIndex: days.find((d) => d.stopId === s.id)!.index, optional: true });
  });
  const last = stops.at(-1);
  if (last?.airport) legs.push({ id: "home", origin: last.airport, dest: t.originAirport, depart: t.endDate, dayIndex: days.length - 1, optional: false });
  return legs;
}
export async function flightsForTrip(dto: TripDTO) {
  const legs = [];
  for (const leg of flightLegs(dto)) {
    const result = await searchFlightsWithFallback({ origin: leg.origin, dest: leg.dest, dates: { depart: leg.depart }, travellers: { adults: dto.trip.adults, children: dto.trip.children } });
    legs.push({ ...leg, ...result, offers: result.offers.map((o) => ({ ...o, leg: { origin: leg.origin, dest: leg.dest, depart: leg.depart, dayIndex: leg.dayIndex } })) });
  }
  return { legs, offers: legs.flatMap((l) => l.offers), source: [...new Set(legs.map((l) => l.source))].join(",") || "deeplink", cached: legs.every((l) => l.cached), error: legs.map((l) => l.error).filter(Boolean).join("; ") || undefined };
}
