import "server-only";
import { addDays, today } from "../dates";

export type Forecast =
  | { available: true; days: { date: string; tMax: number; tMin: number; precipProb: number | null }[]; fetchedAt: string }
  | { available: false; reason: string };

const g = globalThis as unknown as { __wx?: Map<string, { at: number; v: Forecast }> };
const cache = (g.__wx ??= new Map());

/** Open-Meteo daily forecast; only dates inside its 16-day horizon. Never invents weather. */
export async function getForecast(lat: number, lng: number, start: string, end: string): Promise<Forecast> {
  const last = addDays(today(), 15);
  const s = start < today() ? today() : start, e = end > last ? last : end;
  if (s > e) return { available: false, reason: "Forecast appears ~16 days before the trip" };
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${s},${e}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 3600e3) return hit.v;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=${s}&end_date=${e}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()).daily;
    const v: Forecast = {
      available: true, fetchedAt: new Date().toISOString(),
      days: (d.time as string[]).map((date, i) => ({ date, tMax: d.temperature_2m_max[i], tMin: d.temperature_2m_min[i], precipProb: d.precipitation_probability_max?.[i] ?? null })),
    };
    cache.set(key, { at: Date.now(), v });
    return v;
  } catch {
    return { available: false, reason: "Weather service unavailable" };
  }
}
