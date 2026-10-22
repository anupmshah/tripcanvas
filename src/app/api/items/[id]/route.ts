import { z } from "zod";
import { Time as TimeValue } from "@/lib/patch/schema";
import { prisma } from "@/lib/db";
import { toItemDTO } from "@/lib/dto";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const Time = TimeValue.nullable();
const Patch = z.object({
  title: z.string().min(1).max(120), notes: z.string().max(500).nullable(), start: Time, end: Time,
  entered: z.object({ amount: z.number().nonnegative(), currency: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()) }),
}).partial();

export async function PATCH(req: Request, { params }: Ctx) {
  const id = (await params).id;
  const [d, bad] = await body(req, Patch);
  if (bad) return bad;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return err(404, "Item not found");
  if (item.status === "booked" && Object.keys(d).some((k) => k !== "notes")) return err(409, "Booked items are locked (only notes can change)");
  const { entered, ...rest } = d;
  const priceData = entered
    ? { price: entered.amount, priceLow: null, priceHigh: null, currency: entered.currency, priceSource: "entered", provider: "user", priceFetchedAt: new Date() }
    : {};
  const changed = await prisma.item.updateMany({ where: { id, ...(Object.keys(d).some((k) => k !== "notes") ? { status: "proposed" } : {}) }, data: { ...rest, ...priceData } });
  if (!changed.count) return err(409, "Item changed or was booked. Reload and retry.");
  const updated = await prisma.item.findUnique({ where: { id } });
  return updated ? json(toItemDTO(updated)) : err(404, "Item not found");
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = (await params).id;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return err(404, "Item not found");
  if (item.status === "booked") return err(409, "Booked items cannot be deleted");
  const removed = await prisma.item.deleteMany({ where: { id, status: "proposed" } });
  if (!removed.count) return err(409, "Item changed or was booked. Reload and retry.");
  return new Response(null, { status: 204 });
}
