import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
const Layout = z.object({ days: z.array(z.object({ dayId: z.string(), itemIds: z.array(z.string()) })).min(1) });

/** Drag & drop result: the full item order of the listed days. Booked items may be reordered within a day but never change day. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = (await params).id;
  const [d, bad] = await body(req, Layout);
  if (bad) return bad;
  const [items, days] = await Promise.all([prisma.item.findMany({ where: { tripId } }), prisma.day.findMany({ where: { tripId } })]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const dayIds = new Set(days.map((x) => x.id));
  const seen = new Set<string>();
  for (const col of d.days) {
    if (!dayIds.has(col.dayId)) return err(400, `Unknown day ${col.dayId}`);
    for (const id of col.itemIds) {
      const it = byId.get(id);
      if (!it || seen.has(id)) return err(400, `Unknown or duplicate item ${id}`);
      seen.add(id);
      if (it.status === "booked" && it.dayId !== col.dayId) return err(409, `"${it.title}" is booked and cannot move to another day`);
    }
  }
  await prisma.$transaction(d.days.flatMap((col) => col.itemIds.map((id, order) => prisma.item.update({ where: { id }, data: { dayId: col.dayId, order } }))));
  return json({ ok: true });
}
