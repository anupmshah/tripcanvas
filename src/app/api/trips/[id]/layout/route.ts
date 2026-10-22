import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, err, json } from "@/lib/http";
import { invalidateQuote } from "@/lib/price/invalidate";

export const runtime = "nodejs";
const Layout = z.object({ days: z.array(z.object({ dayId: z.string(), itemIds: z.array(z.string()) })).min(1) });

/** Drag & drop result: the full item order of the listed days. Booked items may be reordered within a day but never change day. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = (await params).id;
  const [d, bad] = await body(req, Layout);
  if (bad) return bad;
  try { return await prisma.$transaction(async (tx) => {
  const [items, days] = await Promise.all([tx.item.findMany({ where: { tripId } }), tx.day.findMany({ where: { tripId } })]);
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
  for (const col of d.days) for (const [order, id] of col.itemIds.entries()) await tx.item.update({ where: { id }, data: { dayId: col.dayId, order, ...invalidateQuote(byId.get(id)!, byId.get(id)!.dayId !== col.dayId) } });
  return json({ ok: true });
  }, { isolationLevel: "Serializable", timeout: 30_000 }); } catch (e) {
    if ((e as { code?: string }).code === "P2034") return err(409, "Trip changed while moving. Reload and retry.");
    throw e;
  }
}
