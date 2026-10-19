import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, json } from "@/lib/http";

export const runtime = "nodejs";
const Update = z.object({
  budgetStyle: z.enum(["budget", "moderate", "luxury"]), pace: z.enum(["relaxed", "balanced", "packed"]),
  interests: z.string().max(300), food: z.string().max(300), party: z.string().max(100),
  homeAirport: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  dislikes: z.string().max(300), displayCurrency: z.string().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
}).partial();

export async function GET() {
  return json(await prisma.profile.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} }));
}
export async function PUT(req: Request) {
  const [data, bad] = await body(req, Update);
  if (bad) return bad;
  return json(await prisma.profile.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data }));
}
