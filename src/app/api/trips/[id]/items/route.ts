import { z } from "zod";
import { prisma } from "@/lib/db";
import { toItemDTO } from "@/lib/dto";
import { verifyPlace } from "@/lib/geo/verify";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
const Time = z.string().regex(/^\d{2}:\d{2}$/);
const Create = z.object({
  dayIndex: z.number().int().min(0), type: z.enum(["stay", "flight", "activity", "food", "transport"]),
  title: z.string().min(1).max(120), placeQuery: z.string().max(200).nullish(),
  start: Time.nullish(), end: Time.nullish(), notes: z.string().max(500).nullish(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = (await params).id;
  const [d, bad] = await body(req, Create);
  if (bad) return bad;
  const day = await prisma.day.findUnique({ where: { tripId_index: { tripId, index: d.dayIndex } }, include: { stop: true } });
  if (!day) return err(404, "No such day in this trip");
  const geo = await verifyPlace(d.placeQuery || `${d.title}, ${day.stop.city}, ${day.stop.country}`, day.stop);
  const order = await prisma.item.count({ where: { dayId: day.id } });
  const item = await prisma.item.create({
    data: { tripId, dayId: day.id, order, type: d.type, title: d.title, placeQuery: d.placeQuery ?? null, start: d.start ?? null, end: d.end ?? null, notes: d.notes ?? null, ...geo },
  });
  return json(toItemDTO(item), 201);
}
