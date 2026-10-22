import type { Item, Stop, Trip } from "@prisma/client";
import { prisma, type Db } from "./db";
import { getRates } from "./money/fx";
import { computeTotals } from "./money/totals";
import { priceLabel } from "./money/priceLabel";
import { convert } from "./money/currency";
import { linksForItem } from "./links/deeplinks";
import { ensureFlightPrices } from "./price/estimate";
import { nightsRemaining } from "./money/totals";

export type ItemDTO = Omit<Item, "createdAt" | "updatedAt" | "priceFetchedAt"> & { priceFetchedAt: string | null; links: { label: string; url: string }[]; label: ReturnType<typeof priceLabel>; displayPrice?: number | null };
export type DayDTO = { id: string; index: number; date: string; stopId: string; items: ItemDTO[] };
export type TripDTO = {
  trip: Omit<Trip, "createdAt" | "updatedAt">;
  stops: Stop[];
  days: DayDTO[];
  totals: ReturnType<typeof computeTotals>;
  rates: { rateDate: string; conversions: Record<string, number | null> } | null;
};

export function toItemDTO(it: Item, links: ItemDTO["links"] = []): ItemDTO {
  const { createdAt: _a, updatedAt: _b, priceFetchedAt, ...rest } = it;
  return { ...rest, priceFetchedAt: priceFetchedAt?.toISOString() ?? null, links, label: priceLabel(it.priceSource, priceFetchedAt) };
}

export async function getTripDTO(id: string, db: Db = prisma): Promise<TripDTO | null> {
  const t = await db.trip.findUnique({
    where: { id },
    include: { stops: { orderBy: { order: "asc" } }, days: { orderBy: { index: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
  });
  if (!t) return null;
  for (const d of t.days) for (const i of d.items) if (i.type === "stay" && i.stayNights == null) {
    i.stayNights = nightsRemaining(d.date, t.stops.find((s) => s.id === d.stopId)!.endDate);
    await db.item.updateMany({ where: { id: i.id, stayNights: null }, data: { stayNights: i.stayNights } });
  }
  if (db === prisma) await ensureFlightPrices(t);
  const { stops, days, createdAt: _c, updatedAt: _u, ...trip } = t;
  const [rates, profile] = await Promise.all([getRates(), db.profile.findUnique({ where: { id: "default" } })]);
  const displayCurrency = profile?.displayCurrency ?? "BHD";
  const data = {
    trip, stops,
    days: days.map((d) => ({ id: d.id, index: d.index, date: d.date, stopId: d.stopId, items: d.items.map((it) => ({ ...toItemDTO(it, linksForItem(it, d, trip, stops, days.length - 1)), displayPrice: it.price != null && it.currency ? convert(it.price, it.currency, displayCurrency, rates) : null })) })),
  };
  return { ...data, totals: computeTotals(data, rates, displayCurrency), rates: rates ? { rateDate: rates.rateDate, conversions: Object.fromEntries([...new Set(stops.map((s) => s.localCurrency))].map((c) => [c, convert(1, c, displayCurrency, rates)])) } : null };
}
