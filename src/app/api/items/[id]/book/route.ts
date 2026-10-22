import { z } from "zod";
import { prisma } from "@/lib/db";
import { toItemDTO } from "@/lib/dto";
import { body, err, json } from "@/lib/http";
export const runtime = "nodejs";
const Booking = z.object({
  bookingRef: z.string().trim().min(1).max(100),
  price: z.number().nonnegative(),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/)
    .transform((s) => s.toUpperCase()),
});
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const [d, bad] = await body(req, Booking);
  if (bad) return bad;
  if (!(await prisma.item.findUnique({ where: { id } }))) return err(404, "Item not found");
  const r = await prisma.item.updateMany({
    where: { id, status: "proposed" },
    data: {
      status: "booked",
      bookingRef: d.bookingRef,
      price: d.price,
      currency: d.currency,
      priceLow: null,
      priceHigh: null,
      priceSource: "entered",
      provider: "user",
      priceFetchedAt: new Date(),
    },
  });
  if (!r.count) return err(409, "Booked items are locked");
  return json(toItemDTO((await prisma.item.findUnique({ where: { id } }))!));
}
