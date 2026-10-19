import "server-only";
import { prisma } from "../db";
import { env } from "../env";

export type GeoResult = { found: boolean; lat?: number; lng?: number; displayName?: string; countryCode?: string; cached: boolean; unavailable?: boolean };
export type GeoCtx = { near?: { lat: number; lng: number } | null; countryCode?: string | null };

// Nominatim policy: max 1 request/second. Serialised through a promise chain that survives HMR.
const g = globalThis as unknown as { __nomChain?: Promise<unknown>; __nomLast?: number };
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = 1100 - (Date.now() - (g.__nomLast ?? 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try { return await fn(); } finally { g.__nomLast = Date.now(); }
  };
  const p = (g.__nomChain ?? Promise.resolve()).then(run, run);
  g.__nomChain = p.catch(() => undefined);
  return p;
}

export async function geocode(query: string, ctx: GeoCtx = {}): Promise<GeoResult> {
  const q = query.trim();
  const box = ctx.near ? `&viewbox=${ctx.near.lng - 0.75},${ctx.near.lat + 0.75},${ctx.near.lng + 0.75},${ctx.near.lat - 0.75}&bounded=1` : "";
  const cc = ctx.countryCode ? `&countrycodes=${ctx.countryCode.toLowerCase()}` : "";
  const key = `${q.toLowerCase().replace(/\s+/g, " ")}|${ctx.near ? `${ctx.near.lat.toFixed(1)},${ctx.near.lng.toFixed(1)}` : ""}|${ctx.countryCode ?? ""}`;
  const hit = await prisma.geocodeCache.findUnique({ where: { key } });
  if (hit && Date.now() - hit.fetchedAt.getTime() < 30 * 864e5) {
    return hit.found
      ? { found: true, lat: hit.lat!, lng: hit.lng!, displayName: hit.displayName ?? undefined, countryCode: hit.countryCode ?? undefined, cached: true }
      : { found: false, cached: true };
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}${box}${cc}`;
  try {
    const rows = await throttled(async () => {
      const r = await fetch(url, { headers: { "User-Agent": `TripCanvas/0.1 (${env.NOMINATIM_CONTACT})`, "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`Nominatim ${r.status}`);
      return (await r.json()) as any[];
    });
    const top = rows[0];
    const data = top
      ? { found: true, lat: Number(top.lat), lng: Number(top.lon), displayName: String(top.display_name), countryCode: top.address?.country_code as string | undefined }
      : { found: false };
    await prisma.geocodeCache.upsert({
      where: { key },
      create: { key, found: data.found, lat: data.lat, lng: data.lng, displayName: data.displayName, countryCode: data.countryCode },
      update: { found: data.found, lat: data.lat ?? null, lng: data.lng ?? null, displayName: data.displayName ?? null, countryCode: data.countryCode ?? null, fetchedAt: new Date() },
    });
    return { ...data, cached: false };
  } catch {
    return { found: false, cached: false, unavailable: true }; // not cached: a network failure is not "does not exist"
  }
}
