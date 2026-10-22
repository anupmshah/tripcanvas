import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { verificationQueries, wikiMatches, canReadGeoCache } from "./queries";
import { getPlaceInfo } from "../info/wiki";

export type GeoResult = {
  found: boolean;
  lat?: number;
  lng?: number;
  displayName?: string;
  countryCode?: string;
  cached: boolean;
  unavailable?: boolean;
  source?: "wikipedia" | "wikivoyage";
};
export type GeoCtx = {
  near?: { lat: number; lng: number } | null;
  countryCode?: string | null;
  city?: string;
  country?: string;
  force?: boolean;
};

// Nominatim policy: max 1 request/second. Serialised through a promise chain that survives HMR.
const g = globalThis as unknown as { __nomChain?: Promise<unknown>; __nomLast?: number };
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = 1100 - (Date.now() - (g.__nomLast ?? 0));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await fn();
    } finally {
      g.__nomLast = Date.now();
    }
  };
  const p = (g.__nomChain ?? Promise.resolve()).then(run, run);
  g.__nomChain = p.catch(() => undefined);
  return p;
}

export async function geocode(query: string, ctx: GeoCtx = {}): Promise<GeoResult> {
  const [q, name] = verificationQueries(query, ctx);
  const box = ctx.near
    ? `&viewbox=${ctx.near.lng - 0.75},${ctx.near.lat + 0.75},${ctx.near.lng + 0.75},${ctx.near.lat - 0.75}&bounded=1`
    : "";
  const cc = ctx.countryCode ? `&countrycodes=${ctx.countryCode.toLowerCase()}` : "";
  const key = `v2:${q.toLowerCase().replace(/\s+/g, " ")}|${ctx.near ? `${ctx.near.lat.toFixed(1)},${ctx.near.lng.toFixed(1)}` : ""}|${ctx.countryCode ?? ""}`;
  const hit = await prisma.geocodeCache.findUnique({ where: { key } });
  if (hit && canReadGeoCache(hit, ctx.force)) {
    return hit.found
      ? {
          found: true,
          lat: hit.lat ?? undefined,
          lng: hit.lng ?? undefined,
          displayName: hit.displayName ?? undefined,
          countryCode: hit.countryCode ?? undefined,
          source: hit.displayName?.startsWith("wikipedia:")
            ? "wikipedia"
            : hit.displayName?.startsWith("wikivoyage:")
              ? "wikivoyage"
              : undefined,
          cached: true,
        }
      : { found: false, cached: true };
  }
  const base = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}${cc}`;
  const search = (url: string) =>
    throttled(async () => {
      const r = await fetch(url, {
        headers: {
          "User-Agent": `TripCanvas/0.1 (${env.NOMINATIM_CONTACT})`,
          "Accept-Language": "en",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error(`Nominatim ${r.status}`);
      return (await r.json()) as any[];
    });
  try {
    let unavailable = false;
    const attempt = async (url: string) => {
      try {
        return await search(url);
      } catch {
        unavailable = true;
        return [];
      }
    };
    let rows = await attempt(base);
    if (!rows.length && ctx.near)
      rows = await attempt(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(name)}${cc}${box}`,
      );
    const top = rows[0];
    let data: Omit<GeoResult, "cached"> = top
      ? {
          found: true,
          lat: Number(top.lat),
          lng: Number(top.lon),
          displayName: String(top.display_name),
          countryCode: top.address?.country_code as string | undefined,
        }
      : { found: false };
    // A sourced article can verify existence without inventing map coordinates. AI summaries never qualify.
    if (!data.found && ctx.city)
      for (const source of ["wikipedia", "wikivoyage"] as const) {
        const info = await getPlaceInfo(name, source, ctx.force);
        if (info.found && info.title && wikiMatches(name, info.title, info.extract ?? "")) {
          data = { found: true, displayName: `${source}:${info.title}`, source };
          break;
        }
      }
    if (!data.found && unavailable) return { found: false, cached: false, unavailable: true };
    const cached = {
      found: data.found,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      displayName: data.displayName ?? null,
      countryCode: data.countryCode ?? null,
      fetchedAt: new Date(),
    };
    await prisma.geocodeCache.upsert({
      where: { key },
      create: { key, ...cached },
      update: cached,
    });
    return { ...data, cached: false };
  } catch {
    return { found: false, cached: false, unavailable: true }; // not cached: a network failure is not "does not exist"
  }
}
