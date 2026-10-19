import type { DayDTO, ItemDTO, TripDTO } from "@/lib/dto";

export const PALETTE = ["#0284c7", "#db2777", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];
export const ICON: Record<string, string> = { stay: "🏨", flight: "✈️", activity: "🎟️", food: "🍽️", transport: "🚆" };
export const stopColor = (dto: TripDTO, stopId: string) => PALETTE[Math.max(0, dto.stops.findIndex((s) => s.id === stopId)) % PALETTE.length];

export const hasPin = (i: ItemDTO) => i.lat != null && i.lng != null;
/** Pin numbers per day: 1..n over items that have coordinates, in day order. */
export function pinNumbers(day: DayDTO) {
  const m = new Map<string, number>();
  day.items.filter(hasPin).forEach((it, k) => m.set(it.id, k + 1));
  return m;
}
export type Weather = Record<string, { tMax: number; tMin: number; precipProb: number | null }>; // by date
