import { z } from "zod";
import { prisma } from "@/lib/db";
import { toItemDTO } from "@/lib/dto";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const Time = z.string().regex(/^\d{2}:\d{2}$/).nullable();
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
  return json(toItemDTO(await prisma.item.update({ where: { id }, data: { ...rest, ...priceData } })));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const id = (await params).id;
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return err(404, "Item not found");
  if (item.status === "booked") return err(409, "Booked items cannot be deleted");
  await prisma.item.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
