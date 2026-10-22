import { prisma } from "@/lib/db";
import { err, json } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const r = await prisma.pendingPatch.updateMany({
    where: { id: (await params).id, status: "pending" },
    data: { status: "rejected", decidedAt: new Date() },
  });
  return r.count ? json({ ok: true }) : err(409, "Patch no longer pending");
}
