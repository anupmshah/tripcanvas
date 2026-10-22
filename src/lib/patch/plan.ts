// Pure planner: simulates patch ops against an in-memory trip and annotates each op as ok/skipped.
// A bad op is skipped with a reason; the rest are kept. Booked items are never moved, removed or re-dated.
import { randomUUID } from "node:crypto";
import { addDays, diffDays } from "../dates";
import type { TripDTO } from "../dto";
import type { PriceOffer } from "../price/types";
import type { AnnotatedOp, Geo, NewItemT, PatchOpT } from "./schema";

export type PStop = {
  id: string; city: string; country: string; countryCode: string | null; lat: number | null; lng: number | null;
  airport: string | null; localCurrency: string; nights: number;
};
export type AddPayload = { item: NewItemT; geo?: Geo; offer?: PriceOffer };
export type PItem = { id: string; status: string; add?: AddPayload };
export type PDay = { id: string; stopId: string; items: PItem[] };
/** days = one day per night of each stop (in stop order) + a final departure day owned by the last stop. */
export type PState = { startDate: string; originAirport?: string; stops: PStop[]; days: PDay[] };
export type StopCtx = { lat: number | null; lng: number | null; countryCode: string | null };

export const MAX_STOPS = 8;

export function stateFromDTO(dto: TripDTO): PState {
  return {
    startDate: dto.trip.startDate, originAirport: dto.trip.originAirport,
    stops: dto.stops.map((s) => ({
      id: s.id, city: s.city, country: s.country, countryCode: s.countryCode, lat: s.lat, lng: s.lng, airport: s.airport,
      localCurrency: s.localCurrency, nights: diffDays(s.startDate, s.endDate),
    })),
    days: dto.days.map((d) => ({ id: d.id, stopId: d.stopId, items: d.items.map((i) => ({ id: i.id, status: i.status })) })),
  };
}

const newDay = (stopId: string): PDay => ({ id: randomUUID(), stopId, items: [] });

/** Rebuild the day list from per-stop blocks so it is always contiguous with the departure day last. */
function rebuild(S: PState, blocks: Map<string, PDay[]>, final: PDay): PState {
  const days = S.stops.flatMap((s) => blocks.get(s.id) ?? []);
  return { ...S, days: [...days, { ...final, stopId: S.stops.at(-1)!.id }] };
}
function split(S: PState) {
  const blocks = new Map<string, PDay[]>(S.stops.map((s) => [s.id, []]));
  S.days.slice(0, -1).forEach((d) => blocks.get(d.stopId)?.push(d));
  return { blocks, final: S.days.at(-1)! };
}

function bookedPositions(S: PState) {
  const m = new Map<string, { date: string; stopId: string; title?: string }>();
  S.days.forEach((d, i) => d.items.filter((it) => it.status === "booked").forEach((it) => m.set(it.id, { date: addDays(S.startDate, i), stopId: d.stopId })));
  return m;
}
/** Returns a reason if the new state moved, re-dated or dropped any booked item. */
function bookedViolation(before: PState, after: PState): string | null {
  const b = bookedPositions(before), a = bookedPositions(after);
  for (const [id, pos] of b) {
    const now = a.get(id);
    if (!now || now.date !== pos.date || now.stopId !== pos.stopId) return "would move or remove a booked item (booked items are locked)";
  }
  return null;
}

function stopOp(S: PState, op: Extract<PatchOpT, { op: "addStop" | "removeStop" | "reorderStops" | "setStopNights" }> & { geo?: Geo }): PState | string {
  const stop = "stopId" in op ? S.stops.find((s) => s.id === op.stopId) : undefined;
  if ("stopId" in op && !stop) return `unknown stop ${op.stopId}`;
  const { blocks, final } = split(S);
  const stops = [...S.stops];
  switch (op.op) {
    case "addStop": {
      if (stops.length >= MAX_STOPS) return `a trip can have at most ${MAX_STOPS} cities`;
      if (op.geo && !op.geo.found && !op.geo.unavailable) return `could not find "${op.city}" on OpenStreetMap`;
      const s: PStop = {
        id: randomUUID(), city: op.city, country: op.country, countryCode: op.geo?.countryCode ?? null, lat: op.geo?.lat ?? null,
        lng: op.geo?.lng ?? null, airport: op.airport?.toUpperCase() ?? null, localCurrency: op.localCurrency.toUpperCase(), nights: op.nights,
      };
      stops.splice(Math.min(op.position ?? stops.length, stops.length), 0, s);
      blocks.set(s.id, Array.from({ length: op.nights }, () => newDay(s.id)));
      break;
    }
    case "removeStop": {
      if (stops.length === 1) return "a trip needs at least one city";
      stops.splice(stops.indexOf(stop!), 1);
      blocks.delete(stop!.id);
      break;
    }
    case "reorderStops": {
      const ids = new Set(S.stops.map((s) => s.id));
      if (op.stopIds.length !== ids.size || !op.stopIds.every((id) => ids.has(id)) || new Set(op.stopIds).size !== ids.size) return "stopIds must list every city exactly once";
      stops.sort((a, b) => op.stopIds.indexOf(a.id) - op.stopIds.indexOf(b.id));
      break;
    }
    case "setStopNights": {
      const blk = blocks.get(stop!.id)!;
      if (op.nights < blk.length) blk.length = op.nights;
      while (blk.length < op.nights) blk.push(newDay(stop!.id));
      stops[stops.indexOf(stop!)] = { ...stop!, nights: op.nights };
      break;
    }
  }
  const next = rebuild({ ...S, stops }, blocks, final);
  next.stops = next.stops.map((s) => ({ ...s, nights: next.days.slice(0, -1).filter((d) => d.stopId === s.id).length }));
  return bookedViolation(S, next) ?? next;
}

const locate = (S: PState, id: string) => {
  for (const d of S.days) { const i = d.items.findIndex((x) => x.id === id); if (i >= 0) return { day: d, i }; }
  return null;
};
const insertAt = (day: PDay, item: PItem, pos: number | null) => day.items.splice(Math.min(pos ?? day.items.length, day.items.length), 0, item);

export function offerFits(S: PState, index: number, offer: PriceOffer) {
  const leg = offer.leg, stop = S.stops.find((s) => s.id === S.days[index]?.stopId);
  const position = S.stops.findIndex((s) => s.id === stop?.id), home = index === S.days.length - 1;
  const origin = home ? stop?.airport : index === 0 ? S.originAirport : S.stops[position - 1]?.airport;
  const dest = home ? S.originAirport : stop?.airport;
  return !!leg && leg.dayIndex === index && leg.depart === addDays(S.startDate, index) && leg.origin === origin && leg.dest === dest;
}

/**
 * Run ops in order against a copy of the trip. Returns the annotated ops, the final state, and for every `add`
 * the location context (the stop of the day it lands on) so the caller can verify the place on OSM.
 */
export function annotateOps(start: PState, ops: (PatchOpT & { geo?: Geo; offer?: PriceOffer })[], offers: PriceOffer[] = []) {
  let S = structuredClone(start);
  const known = new Map(offers.filter((o) => o.offerId).map((o) => [o.offerId!, o]));
  const ctx: (StopCtx | null)[] = [];
  const out: AnnotatedOp[] = ops.map((raw, idx) => {
    ctx[idx] = null;
    const skip = (reason: string): AnnotatedOp => ({ ...raw, status: "skipped", reason }) as AnnotatedOp;
    const ok = (extra?: object): AnnotatedOp => ({ ...raw, ...extra, status: "ok" }) as AnnotatedOp;
    switch (raw.op) {
      case "addStop": case "removeStop": case "reorderStops": case "setStopNights": {
        const r = stopOp(structuredClone(S), raw);
        if (typeof r === "string") return skip(r);
        S = r;
        return ok();
      }
      case "add": {
        const day = S.days[raw.dayIndex];
        if (!day) return skip(`day ${raw.dayIndex} does not exist (trip has ${S.days.length} days, index from 0)`);
        const candidate = raw.item.type === "flight" && raw.item.offerId ? known.get(raw.item.offerId) : undefined;
        const offer = candidate && offerFits(S, raw.dayIndex, candidate) ? candidate : undefined;
        const item: NewItemT = {
          ...raw.item,
          offerId: offer ? raw.item.offerId : null, // never keep an offer the server did not supply
          estimate: raw.item.type === "flight" ? null : raw.item.estimate, // flights are priced only via a live offer
        };
        insertAt(day, { id: randomUUID(), status: "proposed", add: { item, geo: raw.geo, offer } }, raw.position);
        const stop = S.stops.find((s) => s.id === day.stopId);
        ctx[idx] = stop ? { lat: stop.lat, lng: stop.lng, countryCode: stop.countryCode } : null;
        return { ...raw, item, status: "ok", ...(raw.item.offerId && !offer ? { reason: "offer not recognised — left unpriced" } : {}), ...(offer ? { offer } : {}) } as AnnotatedOp;
      }
      case "move": {
        const at = locate(S, raw.itemId), to = S.days[raw.toDayIndex];
        if (!at) return skip(`unknown item ${raw.itemId}`);
        if (at.day.items[at.i].status === "booked") return skip("booked items are locked");
        if (!to) return skip(`day ${raw.toDayIndex} does not exist`);
        const [it] = at.day.items.splice(at.i, 1);
        insertAt(to, it, raw.position);
        return ok();
      }
      case "remove": {
        const at = locate(S, raw.itemId);
        if (!at) return skip(`unknown item ${raw.itemId}`);
        if (at.day.items[at.i].status === "booked") return skip("booked items are locked");
        at.day.items.splice(at.i, 1);
        return ok();
      }
    }
  });
  return { ops: out, state: S, ctx };
}
