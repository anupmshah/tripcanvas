import { z } from "zod";
import { prisma } from "@/lib/db";
import { getTripDTO } from "@/lib/dto";
import { body, err, json } from "@/lib/http";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const dto = await getTripDTO((await params).id);
  return dto ? json(dto) : err(404, "Trip not found");
}

const Patch = z
  .object({
    title: z.string().min(1).max(120),
    budgetAmount: z.number().positive().nullable(),
    budgetCurrency: z
      .string()
      .regex(/^[A-Za-z]{3}$/)
      .transform((s) => s.toUpperCase()),
  })
  .partial();
export async function PATCH(req: Request, { params }: Ctx) {
  const id = (await params).id;
  const [data, bad] = await body(req, Patch);
  if (bad) return bad;
  if (!(await prisma.trip.findUnique({ where: { id } }))) return err(404, "Trip not found");
  await prisma.trip.update({ where: { id }, data });
  return json(await getTripDTO(id));
}
