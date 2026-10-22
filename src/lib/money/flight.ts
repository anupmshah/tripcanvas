import { z } from "zod";
const Range = z
  .object({
    low: z.number().nonnegative(),
    mid: z.number().nonnegative(),
    high: z.number().nonnegative(),
  })
  .refine((r) => r.low <= r.mid && r.mid <= r.high, "low<=mid<=high");
export const FlightEstimate = z.object({
  currency: z.literal("USD"),
  adult: Range,
  child: Range,
  infant: Range,
});
export function flightPartyPrice(
  e: z.infer<typeof FlightEstimate>,
  p: { adults: number; children: number; infants?: number },
) {
  const sum = (key: "low" | "mid" | "high") =>
    e.adult[key] * p.adults + e.child[key] * p.children + e.infant[key] * (p.infants ?? 0);
  return { price: sum("mid"), priceLow: sum("low"), priceHigh: sum("high"), currency: e.currency };
}
