import { prisma } from "@/lib/db";
import { createDemoTrip } from "@/lib/demo";
import { err, json } from "@/lib/http";

export const runtime = "nodejs";
export async function POST() {
  if (process.env.NODE_ENV === "production") return err(404, "Not found");
  return json({ id: (await createDemoTrip(prisma)).id });
}
