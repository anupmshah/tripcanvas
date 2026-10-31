import { nightsRemaining } from "@/lib/money/totals";
import { z } from "zod";
import { Time as TimeValue } from "@/lib/patch/schema";
import { prisma } from "@/lib/db";
import { getTripDTO, toItemDTO } from "@/lib/dto";
import { flightsForTrip } from "@/lib/price/legs";
import { verifyPlace } from "@/lib/geo/verify";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
const Time = TimeValue;
const Create = z.object({
  dayIndex: z.number().int().min(0),
  type: z.enum(["stay", "flight", "activity", "food", "transport"]),
  title: z.string().min(1).max(120),
  placeQuery: z.string().max(200).nullish(),
  start: Time.nullish(),
  end: Time.nullish(),
  notes: z.string().max(500).nullish(),
  offerId: z.string().optional(),
  legId: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = (await params).id;
  const [d, bad] = await body(req, Create);
  if (bad) return bad;
  const day = await prisma.day.findUnique({
    where: { tripId_index: { tripId, index: d.dayIndex } },
    include: { stop: true },
  });
  if (!day) return err(404, "No such day in this trip");
  let priceData = {};
  if (d.offerId) {
    const dto = await getTripDTO(tripId);
    if (!dto) return err(404, "Trip not found");
    const leg = (await flightsForTrip(dto)).legs.find(
      (l) => l.id === d.legId && l.dayIndex === d.dayIndex,
    );
    const offer = leg?.offers.find(
      (o) => o.offerId === d.offerId && o.isLive && o.price != null && o.currency,
    );
    if (d.type !== "flight" || !offer)
      return err(400, "Offer not found for this leg; refresh flight offers");
    priceData = {
      price: offer.price,
      currency: offer.currency,
      priceSource: "live",
      provider: offer.provider,
      offerId: offer.offerId,
      sourceUrl: offer.deepLink,
      priceFetchedAt: new Date(offer.fetchedAt),
    };
  }
  const geo = await verifyPlace(d, day.stop);
  const order = await prisma.item.count({ where: { dayId: day.id } });
  const item = await prisma.item.create({
    data: {
      tripId,
      dayId: day.id,
      order,
      type: d.type,
      stayNights: d.type === "stay" ? nightsRemaining(day.date, day.stop.endDate) : null,
      title: d.title,
      placeQuery: d.placeQuery ?? null,
      start: d.start ?? null,
      end: d.end ?? null,
      notes: d.notes ?? null,
      ...geo,
      ...priceData,
    },
  });
  return json(toItemDTO(item), 201);
}
