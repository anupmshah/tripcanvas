import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { err, json } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const tripId = (await params).id;
  if (!await prisma.trip.findUnique({ where: { id: tripId } })) return err(404, "Trip not found");
  const token = randomBytes(24).toString("hex");
  await prisma.shareLink.create({ data: { token, tripId } });
  return json({ token, url: `/share/${token}` });
}
