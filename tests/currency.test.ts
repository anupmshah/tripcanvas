import { describe, expect, it } from "vitest";
import { convert, formatMoney } from "../src/lib/money/currency";
import { computeTotals } from "../src/lib/money/totals";
const rates = { base: "USD" as const, rateDate: "2027-03-01", rates: { USD: 1, EUR: 0.9, BHD: 0.376 } };
describe("currency and honest totals", () => {
  it("converts through USD and preserves BHD precision", () => {
    expect(convert(90, "EUR", "BHD", rates)).toBeCloseTo(37.6);
    expect(convert(37.6, "BHD", "EUR", rates)).toBeCloseTo(90);
    expect(convert(10, "XYZ", "BHD", rates)).toBeNull();
    expect(convert(10, "EUR", "EUR", null)).toBe(10);
    expect(formatMoney(1.2, "BHD")).toMatch(/1\.200/);
  });
  it("splits estimates/entered/live and excludes missing currency from converted totals", () => {
    const dto = { trip: { budgetAmount: 50, budgetCurrency: "BHD" }, stops: [{ id: "s", city: "Lisbon" }], days: [{ index: 0, date: "2027-03-01", stopId: "s", items: [
      { price: 90, priceLow: 45, priceHigh: 135, currency: "EUR", priceSource: "estimate" },
      { price: 10, currency: "BHD", priceSource: "entered" },
      { price: 10, currency: "USD", priceSource: "live" },
      { price: null }, { price: 3, currency: "XYZ", priceSource: "entered" },
    ] }] };
    const t = computeTotals(dto, rates, "BHD");
    expect(t.estimate).toEqual({ low: 18.8, mid: 37.6, high: 56.4 });
    expect(t.entered).toBe(10); expect(t.live).toBeCloseTo(3.76);
    expect(t.total).toBeCloseTo(51.36); expect(t.overBudget).toBe(true);
    expect(t.unpricedCount).toBe(1); expect(t.unconvertible).toEqual(["XYZ"]);
    expect(t.perCity[0].amount).toBeCloseTo(51.36);
    expect(t.originalTotals.XYZ).toBe(3);
    expect(computeTotals(dto, null, "BHD").total).toBe(10);
  });
});
