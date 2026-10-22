import "server-only";
import { prisma, retryConflict, type Db } from "../db";
import { getTripDTO } from "../dto";
import { planDays, tripLabel } from "../stops";
import type { AnnotatedOp } from "./schema";
import { annotateOps, stateFromDTO, offerFits, type AddPayload, type PState } from "./plan";
import { invalidateQuote } from "../price/invalidate";
import { nightsRemaining, resizeStay, stayEstimate } from "../money/totals";

/** Write a planned state to the DB: stops, days (contiguous), item order; new items from `add` payloads. */
export async function persistState(tx: Db, tripId: string, S: PState) {
  const plan = planDays(
    S.startDate,
    S.stops.map((s) => s.nights),
  );
  const [stops, days, items] = await Promise.all([
    tx.stop.findMany({ where: { tripId } }),
    tx.day.findMany({ where: { tripId } }),
    tx.item.findMany({ where: { tripId } }),
  ]);
  const keepItems = new Set(S.days.flatMap((d) => d.items.map((i) => i.id)));
  const dbItem = new Map(items.map((i) => [i.id, i]));
  const routeChanged =
    stops.length !== S.stops.length ||
    S.stops.some((s, index) => {
      const old = stops.find((x) => x.id === s.id);
      return (
        !old ||
        old.order !== index ||
        old.airport !== s.airport ||
        old.startDate !== plan.ranges[index].startDate ||
        old.endDate !== plan.ranges[index].endDate
      );
    });
  await tx.item.deleteMany({
    where: { id: { in: items.filter((i) => !keepItems.has(i.id)).map((i) => i.id) } },
  });
  await tx.day.deleteMany({
    where: { id: { in: days.filter((d) => !S.days.some((x) => x.id === d.id)).map((d) => d.id) } },
  });
  // free the unique (tripId, order/index) slots before renumbering
  await tx.stop.updateMany({ where: { tripId }, data: { order: { increment: 1000 } } });
  await tx.day.updateMany({ where: { tripId }, data: { index: { increment: 1000 } } });
  const stopIds = new Set(stops.map((s) => s.id)),
    dayIds = new Set(days.map((d) => d.id));
  for (const [order, s] of S.stops.entries()) {
    const data = {
      order,
      startDate: plan.ranges[order].startDate,
      endDate: plan.ranges[order].endDate,
    };
    if (stopIds.has(s.id)) await tx.stop.update({ where: { id: s.id }, data });
    else
      await tx.stop.create({
        data: {
          id: s.id,
          tripId,
          city: s.city,
          country: s.country,
          countryCode: s.countryCode,
          lat: s.lat,
          lng: s.lng,
          airport: s.airport,
          localCurrency: s.localCurrency,
          ...data,
        },
      });
  }
  for (const [index, d] of S.days.entries()) {
    const data = { index, date: plan.days[index].date, stopId: d.stopId };
    if (dayIds.has(d.id)) await tx.day.update({ where: { id: d.id }, data });
    else await tx.day.create({ data: { id: d.id, tripId, ...data } });
    for (const [order, it] of d.items.entries()) {
      const cur = dbItem.get(it.id);
      const nights = nightsRemaining(
        data.date,
        plan.ranges[S.stops.findIndex((s) => s.id === d.stopId)].endDate,
      );
      if (cur && it.status !== "booked") {
        const old = days.find((x) => x.id === cur.dayId);
        const changed =
          cur.dayId !== d.id ||
          old?.date !== data.date ||
          old?.stopId !== d.stopId ||
          (cur.type === "flight" && routeChanged);
        if (changed || cur.order !== order || (cur.type === "stay" && cur.stayNights !== nights))
          await tx.item.update({
            where: { id: it.id },
            data: {
              dayId: d.id,
              order,
              ...invalidateQuote(cur, changed),
              ...resizeStay(cur, nights),
            },
          });
      } else if (it.add) {
        const add = {
          ...it.add,
          offer: it.add.offer && offerFits(S, index, it.add.offer) ? it.add.offer : undefined,
        };
        await tx.item.create({
          data: { id: it.id, tripId, dayId: d.id, order, ...newItemData(add, nights) },
        });
      }
    }
  }
  await tx.stop.deleteMany({
    where: {
      id: { in: stops.filter((s) => !S.stops.some((x) => x.id === s.id)).map((s) => s.id) },
    },
  });
  await tx.trip.update({
    where: { id: tripId },
    data: { endDate: plan.endDate, destination: tripLabel(S.stops) },
  });
}

export function newItemData({ item, geo, offer }: AddPayload, nights = 1) {
  const geoData = geo?.found
    ? { lat: geo.lat, lng: geo.lng, geoStatus: geo.source ?? "ok" }
    : { geoStatus: geo?.unavailable || !geo ? "pending" : "unresolved" };
  const base = {
    type: item.type,
    title: item.title,
    placeQuery: item.placeQuery,
    start: item.start,
    end: item.end,
    notes: item.notes,
    stayNights: item.type === "stay" ? nights : null,
    ...geoData,
  };
  if (offer && offer.price != null)
    return {
      ...base,
      price: offer.price,
      currency: offer.currency,
      priceSource: "live",
      priceFetchedAt: new Date(offer.fetchedAt),
      provider: offer.provider,
      offerId: offer.offerId,
      sourceUrl: offer.deepLink,
    };
  if (item.estimate)
    // every LLM number is an estimate; the LLM can never set live/entered
    return {
      ...base,
      ...stayEstimate(item.estimate, item.type === "stay" ? nights : 1),
      priceSource: "estimate",
      provider: "llm",
      priceFetchedAt: new Date(),
    };
  return base;
}

/** Apply a stored patch. Re-reads the trip inside the transaction, so items booked since the proposal stay locked. */
export async function applyPatch(
  patchId: string,
): Promise<{ applied: number; skipped: { index: number; reason: string }[] } | null> {
  const patch = await prisma.pendingPatch.findUnique({ where: { id: patchId } });
  if (!patch || patch.status !== "pending") return null;
  return retryConflict(() =>
    prisma.$transaction(
      async (tx) => {
        const claimed = await tx.pendingPatch.updateMany({
          where: { id: patchId, status: "pending" },
          data: { status: "applied", decidedAt: new Date() },
        });
        if (claimed.count !== 1) return null;
        const stored = JSON.parse(patch.opsJson) as AnnotatedOp[];
        const dto = await getTripDTO(patch.tripId, tx);
        if (!dto) return null;
        const okIdx = stored.flatMap((o, i) => (o.status === "ok" ? [i] : []));
        const { ops, state } = annotateOps(
          stateFromDTO(dto),
          okIdx.map((i) => stored[i]),
          stored.flatMap((o) => ("offer" in o && o.offer ? [o.offer] : [])),
        );
        await persistState(tx, patch.tripId, state);
        const skipped = [
          ...stored.flatMap((o, index) =>
            o.status === "skipped" ? [{ index, reason: o.reason ?? "skipped" }] : [],
          ),
          ...ops.flatMap((o, k) =>
            o.status === "skipped" ? [{ index: okIdx[k], reason: o.reason ?? "skipped" }] : [],
          ),
        ];
        return { applied: ops.length - ops.filter((o) => o.status === "skipped").length, skipped };
      },
      { timeout: 45000, maxWait: 10000, isolationLevel: "Serializable" },
    ),
  );
}
