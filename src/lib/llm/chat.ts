import "server-only";
import { prisma } from "../db";
import { getTripDTO } from "../dto";
import { geocode } from "../geo/nominatim";
import { annotateOps, rejectPricierSwaps, stateFromDTO } from "../patch/plan";
import { ChatOutput, groundedPrefs } from "../patch/schema";
import { callJson } from "./openai";
import { SYSTEM } from "./prompts";
import { flightsForTrip } from "../price/legs";

export async function chat(tripId: string, message: string, mode: string, instruction?: string) {
  const dto = await getTripDTO(tripId);
  if (!dto) return null;
  const [profile, history] = await Promise.all([
    prisma.profile.upsert({ where: { id: "default" }, create: {}, update: {} }),
    prisma.chatMessage.findMany({ where: { tripId }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const flights = await flightsForTrip(dto);
  const offers = flights.legs.flatMap((l) => l.offers.slice(0, 3));
  const output = await callJson(ChatOutput, [
    { role: "system", content: SYSTEM },
    {
      role: "system",
      content: JSON.stringify({
        profile,
        trip: dto,
        mode,
        flightOffers: offers,
        budget: dto.totals,
        flightEstimates: flights.legs.map((l) => ({ ...l, offers: undefined })),
        instruction,
      }),
    },
    ...history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: message },
  ]);
  // Verify new cities first, then resolve item context against the simulated new schedule.
  const raw = await Promise.all(
    output.patch.ops.map(async (op) =>
      op.op === "addStop" ? { ...op, geo: await geocode(`${op.city}, ${op.country}`) } : op,
    ),
  );
  const first = annotateOps(stateFromDTO(dto), raw, offers);
  const located = await Promise.all(
    first.ops.map(async (op, i) => {
      if (op.op !== "add" || op.status !== "ok") return op;
      const ctx = first.ctx[i];
      const day = first.state.days[op.dayIndex];
      const stop = first.state.stops.find((s) => s.id === day?.stopId);
      const geo = await geocode(
        op.item.placeQuery ?? `${op.item.title}, ${stop?.city}, ${stop?.country}`,
        {
          near: ctx?.lat != null && ctx.lng != null ? { lat: ctx.lat, lng: ctx.lng } : null,
          countryCode: ctx?.countryCode,
          city: stop?.city,
          country: stop?.country,
        },
      );
      return { ...op, geo };
    }),
  );
  const ops = rejectPricierSwaps(
    located,
    first.state,
    dto.days.flatMap((d) =>
      d.items
        .filter((i) => i.type === "stay")
        .map((i) => ({ id: i.id, stopId: d.stopId, total: i.price, currency: i.currency })),
    ),
  );
  const said = [...history.filter((m) => m.role === "user").map((m) => m.content), message];
  const prefs = groundedPrefs(output.preferenceCandidates, said);
  const patch = await prisma.$transaction(async (tx) => {
    const p = await tx.pendingPatch.create({
      data: {
        tripId,
        opsJson: JSON.stringify(ops),
        prefsJson: JSON.stringify(prefs),
      },
    });
    await tx.chatMessage.createMany({
      data: [
        { tripId, role: "user", content: message, patchId: p.id },
        { tripId, role: "assistant", content: output.reply, patchId: p.id },
      ],
    });
    return p;
  });
  return {
    reply: output.reply,
    patch: { id: patch.id, ops },
    preferenceCandidates: prefs,
  };
}
