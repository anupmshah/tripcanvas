import type { Db } from "./db";
import { planDays, tripLabel, type StopInput } from "./stops";

export type TripInput = {
  title: string; originAirport: string; startDate: string; adults: number; children: number; infants?: number;
  budgetAmount?: number | null; budgetCurrency?: string; stops: StopInput[];
};

/** Creates trip + stops + contiguous days. No network (callers geocode stops first). */
export async function createTrip(db: Db, i: TripInput) {
  const plan = planDays(i.startDate, i.stops.map((s) => s.nights));
  const trip = await db.trip.create({
    data: {
      title: i.title, destination: tripLabel(i.stops), originAirport: i.originAirport.toUpperCase(),
      startDate: i.startDate, endDate: plan.endDate, adults: i.adults, children: i.children, infants: i.infants ?? 0,
      budgetAmount: i.budgetAmount ?? null, budgetCurrency: i.budgetCurrency ?? "BHD",
    },
  });
  const stops = [];
  for (const [order, s] of i.stops.entries()) {
    stops.push(await db.stop.create({
      data: {
        tripId: trip.id, order, city: s.city, country: s.country, countryCode: s.countryCode ?? null,
        lat: s.lat ?? null, lng: s.lng ?? null, airport: s.airport?.toUpperCase() || null,
        localCurrency: s.localCurrency.toUpperCase(), ...plan.ranges[order],
      },
    }));
  }
  const days = [];
  for (const d of plan.days) {
    days.push(await db.day.create({ data: { tripId: trip.id, stopId: stops[d.stopIdx].id, index: d.index, date: d.date } }));
  }
  return { trip, stops, days };
}
