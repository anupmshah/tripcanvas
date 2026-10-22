import { convert, type Rates } from "./currency";
type CostTrip = {
  trip: { budgetAmount: number | null; budgetCurrency: string };
  stops: { id: string; city: string }[];
  days: { index: number; date: string; stopId: string; items: { provider?: string | null; price: number | null; currency?: string | null; priceSource?: string | null; priceLow?: number | null; priceHigh?: number | null }[] }[];
};
export function computeTotals(dto: CostTrip, rates: Rates | null, displayCurrency: string) {
  let live = 0, test = 0, entered = 0, unpricedCount = 0;
  const estimate = { low: 0, mid: 0, high: 0 }, unconvertible = new Set<string>(), originalTotals: Record<string, number> = {};
  const perCity = dto.stops.map((s) => ({ stopId: s.id, city: s.city, amount: 0 }));
  const perDay = dto.days.map((d) => {
    let amount = 0;
    for (const i of d.items) {
      if (i.price == null || !i.currency || !i.priceSource) { unpricedCount++; continue; }
      originalTotals[i.currency] = (originalTotals[i.currency] ?? 0) + i.price;
      const value = convert(i.price, i.currency, displayCurrency, rates);
      if (value == null) { unconvertible.add(i.currency); continue; }
      amount += value;
      if (i.provider === "fixture" || i.provider === "duffel-test") test += value;
      else if (i.priceSource === "live") live += value;
      else if (i.priceSource === "entered") entered += value;
      else { estimate.low += convert(i.priceLow ?? i.price, i.currency, displayCurrency, rates)!; estimate.mid += value; estimate.high += convert(i.priceHigh ?? i.price, i.currency, displayCurrency, rates)!; }
    }
    const city = perCity.find((s) => s.stopId === d.stopId); if (city) city.amount += amount;
    return { index: d.index, date: d.date, amount };
  });
  const total = live + entered + estimate.mid + test;
  const budget = dto.trip.budgetAmount == null ? null : convert(dto.trip.budgetAmount, dto.trip.budgetCurrency, displayCurrency, rates);
  if (dto.trip.budgetAmount != null && budget == null) unconvertible.add(dto.trip.budgetCurrency);
  return { displayCurrency, rateDate: rates?.rateDate ?? null, live, test, entered, estimate, total, perDay, perCity, unpricedCount, unconvertible: [...unconvertible], originalTotals, budget, remaining: budget == null ? null : budget - total, overBudget: budget != null && total > budget };
}
