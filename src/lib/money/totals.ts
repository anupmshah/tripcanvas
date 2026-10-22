import { convert, type Rates } from "./currency";
import { diffDays, addDays } from "../dates";
type CostTrip = {
  trip: { budgetAmount: number | null; budgetCurrency: string };
  stops: { id: string; city: string; endDate?: string }[];
  days: { index: number; date: string; stopId: string; items: { type?: string; stayNights?: number | null; provider?: string | null; price: number | null; currency?: string | null; priceSource?: string | null; priceLow?: number | null; priceHigh?: number | null }[] }[];
};
export function computeTotals(dto: CostTrip, rates: Rates | null, displayCurrency: string) {
  let live = 0, test = 0, entered = 0, unpricedCount = 0;
  const estimate = { low: 0, mid: 0, high: 0 }, unconvertible = new Set<string>(), originalTotals: Record<string, number> = {};
  const perCity = dto.stops.map((s) => ({ stopId: s.id, city: s.city, amount: 0 }));
  const perDay = dto.days.map((d) => ({ index: d.index, date: d.date, amount: 0 }));
  for (const d of dto.days) {
    for (const i of d.items) {
      if (i.price == null || !i.currency || !i.priceSource) { unpricedCount++; continue; }
      originalTotals[i.currency] = (originalTotals[i.currency] ?? 0) + i.price;
      const value = convert(i.price, i.currency, displayCurrency, rates);
      if (value == null) { unconvertible.add(i.currency); continue; }
      const stop = dto.stops.find((s) => s.id === d.stopId);
      const nights = i.type === "stay" ? i.stayNights ?? (stop?.endDate ? nightsRemaining(d.date, stop.endDate) : 1) : 1;
      const targets = perDay.filter((x) => x.date >= d.date && x.date < addDays(d.date, nights));
      if (targets.length) targets.forEach((x) => { x.amount += value / targets.length; });
      const city = perCity.find((s) => s.stopId === d.stopId); if (city) city.amount += value;
      if (i.provider === "fixture" || i.provider === "duffel-test") test += value;
      else if (i.priceSource === "live") live += value;
      else if (i.priceSource === "entered") entered += value;
      else { estimate.low += convert(i.priceLow ?? i.price, i.currency, displayCurrency, rates)!; estimate.mid += value; estimate.high += convert(i.priceHigh ?? i.price, i.currency, displayCurrency, rates)!; }
    }
  }
  const total = live + entered + estimate.mid + test;
  const budget = dto.trip.budgetAmount == null ? null : convert(dto.trip.budgetAmount, dto.trip.budgetCurrency, displayCurrency, rates);
  if (dto.trip.budgetAmount != null && budget == null) unconvertible.add(dto.trip.budgetCurrency);
  return { displayCurrency, rateDate: rates?.rateDate ?? null, live, test, entered, estimate, total, perDay, perCity, unpricedCount, unconvertible: [...unconvertible], originalTotals, budget, remaining: budget == null ? null : budget - total, overBudget: budget != null && total > budget };
}

export const nightsRemaining = (date: string, end: string) => Math.max(1, diffDays(date, end));
export function stayEstimate(e: { low: number; mid: number; high: number; currency: string; basis?: string }, nights: number) {
  const n = e.basis === "night" ? nights : 1; // legacy proposals already contain total-stay estimates
  return { price: e.mid * n, priceLow: e.low * n, priceHigh: e.high * n, currency: e.currency.toUpperCase() };
}
export function resizeStay(i: { type: string; status: string; stayNights: number | null; price: number | null; priceLow?: number | null; priceHigh?: number | null }, next: number) {
  if (i.type !== "stay" || i.status === "booked" || i.stayNights === next) return {};
  const ratio = next / (i.stayNights ?? next);
  return { stayNights: next, price: i.price == null ? null : i.price * ratio, priceLow: i.priceLow == null ? null : i.priceLow * ratio, priceHigh: i.priceHigh == null ? null : i.priceHigh * ratio };
}
