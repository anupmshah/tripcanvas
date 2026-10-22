import { expect, it } from "vitest";
import { priceLabel } from "../src/lib/money/priceLabel";
it("marks 31-minute fares stale but never presents estimates as live", () => {
  const now = new Date("2027-03-01T12:00:00Z");
  expect(priceLabel("live", "2027-03-01T11:31:00Z", now).mayHaveChanged).toBe(false);
  expect(priceLabel("live", "2027-03-01T11:29:00Z", now)).toMatchObject({ mayHaveChanged: true, tone: "stale" });
  expect(priceLabel("estimate", now.toISOString(), now).tone).toBe("estimate");
  expect(priceLabel(null, null, now).text).toContain("check on provider");
});
import { invalidateQuote } from "../src/lib/price/invalidate";
it("invalidates moved live quotes but keeps booked and entered prices", () => {
  expect(invalidateQuote({ status: "proposed", priceSource: "live" }, true)).toMatchObject({ price: null, offerId: null, sourceUrl: null });
  expect(invalidateQuote({ status: "booked", priceSource: "live" }, true)).toEqual({});
  expect(invalidateQuote({ status: "proposed", priceSource: "entered" }, true)).toEqual({});
});
