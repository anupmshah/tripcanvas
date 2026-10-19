import type { Item, Stop, Trip } from "@prisma/client";
import { prisma, type Db } from "./db";

export type ItemDTO = Omit<Item, "createdAt" | "updatedAt" | "priceFetchedAt"> & { priceFetchedAt: string | null; links: { label: string; url: string }[] };
export type DayDTO = { id: string; index: number; date: string; stopId: string; items: ItemDTO[] };
export type TripDTO = {
  trip: Omit<Trip, "createdAt" | "updatedAt">;
  stops: Stop[];
  days: DayDTO[];
};

export function toItemDTO(it: Item, links: ItemDTO["links"] = []): ItemDTO {
  const { createdAt: _a, updatedAt: _b, priceFetchedAt, ...rest } = it;
  return { ...rest, priceFetchedAt: priceFetchedAt?.toISOString() ?? null, links };
}

export async function getTripDTO(id: string, db: Db = prisma): Promise<TripDTO | null> {
  const t = await db.trip.findUnique({
    where: { id },
    include: { stops: { orderBy: { order: "asc" } }, days: { orderBy: { index: "asc" }, include: { items: { orderBy: { order: "asc" } } } } },
  });
  if (!t) return null;
  const { stops, days, createdAt: _c, updatedAt: _u, ...trip } = t;
  return {
    trip, stops,
    days: days.map((d) => ({ id: d.id, index: d.index, date: d.date, stopId: d.stopId, items: d.items.map((it) => toItemDTO(it)) })),
  };
}
