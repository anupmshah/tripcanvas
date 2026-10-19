import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, err, json } from "@/lib/http";
import { chat } from "@/lib/llm/chat";
import { LlmInvalidOutput, LlmUnavailable } from "@/lib/llm/openai";
import { rateLimit } from "@/lib/rateLimit";
import { env } from "@/lib/env";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Ctx) {
  const tripId = (await params).id;
  if (!await prisma.trip.findUnique({ where: { id: tripId } })) return err(404, "Trip not found");
  const [messages, pending, latest, profile] = await Promise.all([
    prisma.chatMessage.findMany({ where: { tripId }, orderBy: { createdAt: "asc" } }),
    prisma.pendingPatch.findFirst({ where: { tripId, status: "pending" }, orderBy: { createdAt: "desc" } }),
    prisma.pendingPatch.findFirst({ where: { tripId }, orderBy: { createdAt: "desc" } }),
    prisma.profile.findUnique({ where: { id: "default" } }),
  ]);
  const preferenceCandidates = latest ? JSON.parse(latest.prefsJson).filter((p: { field: keyof NonNullable<typeof profile>; value: string }) => profile?.[p.field] !== p.value) : [];
  return json({ messages, preferenceCandidates, pending: pending ? { id: pending.id, ops: JSON.parse(pending.opsJson), preferenceCandidates } : null });
}
export async function POST(req: Request, { params }: Ctx) {
  const limited = rateLimit(`chat:${req.headers.get("x-forwarded-for") ?? "local"}`, env.CHAT_RATE_LIMIT_PER_MIN);
  if (!limited.ok) return err(429, "Too many chat requests", { retryAfterSec: limited.retryAfterSec });
  const [d, bad] = await body(req, z.object({ message: z.string().trim().min(1).max(2000), mode: z.enum(["chat", "regenerate"]).default("chat") }));
  if (bad) return bad;
  try {
    const result = await chat((await params).id, d.message, d.mode ?? "chat");
    return result ? json(result) : err(404, "Trip not found");
  } catch (e) {
    if (e instanceof LlmInvalidOutput) return err(502, e.message);
    if (e instanceof LlmUnavailable) return err(503, "Chat is unavailable. Check the server key or try again.");
    throw e;
  }
}
