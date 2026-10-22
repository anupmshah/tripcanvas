import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "../db";
import { env } from "../env";
import { rateLimit } from "../rateLimit";
import { DeepLinkProvider } from "./deeplink";
import { DuffelProvider } from "./duffel";
import { FixtureProvider } from "./fixture";
import type { PriceOffer } from "./types";
export type Search = { origin: string; dest: string; dates: { depart: string; return?: string }; travellers: { adults: number; children: number; infants?: number } };
type Stored = { offers: PriceOffer[]; source: string; error?: string; fetchedAt: number };
export type Cache = { get: (key: string) => Promise<Stored | null>; set: (key: string, value: Stored) => Promise<void> };
const dbCache: Cache = {
  get: async (key) => { const r = await prisma.offerCache.findUnique({ where: { key } }); return r ? JSON.parse(r.offersJson) : null; },
  set: async (key, value) => { const data = { offersJson: JSON.stringify(value), provider: value.source, fetchedAt: new Date(value.fetchedAt) }; await prisma.offerCache.upsert({ where: { key }, create: { key, ...data }, update: data }); },
};
export async function searchFlightsWithFallback(p: Search, opts: { token?: string; cache?: Cache } = {}) {
  const token = opts.token ?? env.DUFFEL_ACCESS_TOKEN, cache = opts.cache ?? dbCache;
  const mode = env.PRICE_PROVIDER === "fixture" ? "fixture" : token ? (token.startsWith("duffel_test_") ? "duffel-test" : "duffel") : "deeplink";
  const key = createHash("sha1").update(JSON.stringify({ ...p, mode })).digest("hex");
  try { const hit = await cache.get(key); if (hit && Date.now() - hit.fetchedAt < 15 * 60_000) return { offers: hit.offers, source: hit.source, error: hit.error, cached: true }; } catch { /* caching is optional */ }
  const args = [p.origin, p.dest, p.dates, p.travellers] as const;
  let offers: PriceOffer[] = [], source = mode, error: string | undefined;
  try {
    if (mode === "fixture") offers = await new FixtureProvider().searchFlights(...args);
    else if (token) {
      if (!rateLimit("duffel-3s", 1, 3000).ok || !rateLimit("duffel-hour", 20, 3600_000).ok) throw new Error("Duffel rate limited");
      offers = await new DuffelProvider(token).searchFlights(...args);
      if (!offers.length) throw new Error("Duffel returned no offers");
    }
  } catch (e) { error = (e as Error).message.startsWith("Duffel") ? (e as Error).message : "Flight provider unavailable"; }
  if (!offers.length) { source = "deeplink"; offers = await new DeepLinkProvider().searchFlights(...args); }
  try { await cache.set(key, { offers, source, error, fetchedAt: Date.now() }); } catch { /* return offers even if caching fails */ }
  return { offers, source, error, cached: false };
}
