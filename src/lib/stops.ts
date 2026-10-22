import { addDays } from "./dates";

export type StopInput = {
  city: string;
  country: string;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  airport?: string | null;
  localCurrency: string;
  nights: number;
};

/** Date range per stop (nights = end - start) and the day plan: one day per night + a final departure day. */
export function planDays(startDate: string, nights: number[]) {
  const ranges: { startDate: string; endDate: string }[] = [];
  let off = 0;
  for (const n of nights) {
    ranges.push({ startDate: addDays(startDate, off), endDate: addDays(startDate, off + n) });
    off += n;
  }
  const days: { index: number; date: string; stopIdx: number }[] = [];
  nights.forEach((n, si) => {
    for (let k = 0; k < n; k++)
      days.push({ index: days.length, date: addDays(startDate, days.length), stopIdx: si });
  });
  days.push({ index: days.length, date: addDays(startDate, off), stopIdx: nights.length - 1 });
  return { ranges, days, endDate: addDays(startDate, off) };
}

export function tripLabel(stops: { city: string; country: string }[]) {
  const cities = stops.map((s) => s.city).join(" → ");
  return new Set(stops.map((s) => s.country)).size === 1
    ? `${stops[0].country}: ${cities}`
    : cities;
}
