import { z } from "zod";
import type { PriceOffer } from "../price/types";
import type { GeoResult } from "../geo/nominatim";

// Nullable rather than optional, so the LLM always emits every key.
export const Estimate = z
  .object({
    low: z.number().nonnegative(),
    mid: z.number().nonnegative(),
    high: z.number().nonnegative(),
    currency: z.string().length(3),
    basis: z.enum(["night", "item"]).optional(),
  })
  .refine((e) => e.low <= e.mid && e.mid <= e.high, "low<=mid<=high");
export const Time = z
  .string()
  .regex(
    /^(?:[01]\d|2[0-3]):[0-5]\d$/,
    "Use HH:MM local time (e.g. 09:00) or null; never a date or datetime",
  );
export const NewItem = z.object({
  type: z.enum(["stay", "flight", "activity", "food", "transport"]),
  title: z.string().min(1).max(120),
  placeQuery: z.string().max(200).nullable(),
  start: Time.nullable(),
  end: Time.nullable(),
  notes: z.string().max(500).nullable(),
  estimate: Estimate.nullable(), // total for the whole party, stored as priceSource "estimate"
  offerId: z.string().nullable(), // flights only: must match an offer the server supplied
});
const Pos = z.number().int().min(0).nullable();
const Nights = z.number().int().min(1).max(30);

export const PatchOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    dayIndex: z.number().int().min(0),
    position: Pos,
    item: NewItem,
  }),
  z.object({
    op: z.literal("move"),
    itemId: z.string(),
    toDayIndex: z.number().int().min(0),
    position: Pos,
  }),
  z.object({ op: z.literal("remove"), itemId: z.string(), reason: z.string().max(200) }),
  z.object({
    op: z.literal("addStop"),
    city: z.string().min(1).max(80),
    country: z.string().min(1).max(80),
    airport: z.string().length(3).nullable(),
    localCurrency: z.string().length(3),
    nights: Nights,
    position: Pos,
  }),
  z.object({ op: z.literal("removeStop"), stopId: z.string() }),
  z.object({ op: z.literal("reorderStops"), stopIds: z.array(z.string()).min(1) }),
  z.object({ op: z.literal("setStopNights"), stopId: z.string(), nights: Nights }),
]);
export const Patch = z.object({ ops: z.array(PatchOp).max(60) });
export const PrefCandidate = z.object({
  field: z.enum(["budgetStyle", "pace", "interests", "food", "party", "homeAirport", "dislikes"]),
  value: z.string().max(200),
  evidence: z.string().max(200),
});
export const ChatOutput = z.object({
  reply: z.string().max(2000),
  patch: Patch,
  preferenceCandidates: z.array(PrefCandidate).max(5),
});

export type PatchOpT = z.infer<typeof PatchOp>;
export type NewItemT = z.infer<typeof NewItem>;
export type Geo = Omit<GeoResult, "cached">;
export type AnnotatedOp = PatchOpT & {
  status: "ok" | "skipped";
  reason?: string;
  geo?: Geo;
  offer?: PriceOffer;
};
