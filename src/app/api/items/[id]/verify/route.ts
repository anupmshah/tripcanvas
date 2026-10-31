import { prisma } from "@/lib/db";
import { verifyPlace } from "@/lib/geo/verify";
import { err, json } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const item = await prisma.item.findUnique({
    where: { id: (await params).id },
    include: { day: { include: { stop: true } } },
  });
  if (!item) return err(404, "Item not found");
  const geo = await verifyPlace(item, item.day.stop, true);
  const result = await prisma.item.updateMany({
    where: { id: item.id, dayId: item.dayId },
    data: geo,
  });
  return result.count ? json(geo) : err(409, "Item moved. Reload and retry verification.");
}
