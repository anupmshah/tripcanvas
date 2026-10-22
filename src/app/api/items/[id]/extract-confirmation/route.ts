import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, err, json } from "@/lib/http";
import { extractConfirmation } from "@/lib/llm/extract";
import { LlmInvalidOutput } from "@/lib/llm/openai";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/lib/env";
export const runtime = "nodejs";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(
    `extract:${req.headers.get("x-forwarded-for") ?? "local"}`,
    env.CHAT_RATE_LIMIT_PER_MIN,
  );
  if (!limit.ok)
    return err(429, "Too many extraction requests", { retryAfterSec: limit.retryAfterSec });
  const [d, bad] = await body(req, z.object({ text: z.string().trim().min(1).max(8000) }));
  if (bad) return bad;
  if (!(await prisma.item.findUnique({ where: { id: (await params).id } })))
    return err(404, "Item not found");
  try {
    return json(await extractConfirmation(d.text));
  } catch (e) {
    return err(
      e instanceof LlmInvalidOutput ? 502 : 503,
      "Could not extract details. Retry or enter them manually.",
    );
  }
}
