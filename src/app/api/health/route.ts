import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  const t = env.DUFFEL_ACCESS_TOKEN;
  return json({
    ok: true,
    db: true,
    env: {
      openai: !!env.OPENAI_API_KEY,
      duffel: !!t,
      duffelMode: t ? (t.startsWith("duffel_test_") ? "test" : "live") : null,
    },
  });
}
