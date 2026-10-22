import { describe, expect, it } from "vitest";
import { convert, formatMoney } from "../src/lib/money/currency";
import { computeTotals } from "../src/lib/money/totals";
import { FlightEstimate, flightPartyPrice } from "../src/lib/money/flight";
import { stayEstimate, resizeStay } from "../src/lib/money/totals";
const rates = {
  base: "USD" as const,
  rateDate: "2027-03-01",
  rates: { USD: 1, EUR: 0.9, BHD: 0.376 },
};
describe("currency and honest totals", () => {
  it("prices nightly stays, spreads nights without double counting, and keeps empty days at zero", () => {
    const p = stayEstimate({ low: 30, mid: 45, high: 60, currency: "BHD", basis: "night" }, 3);
    expect(p).toEqual({ price: 135, priceLow: 90, priceHigh: 180, currency: "BHD" });
    const dto = {
      trip: { budgetAmount: null, budgetCurrency: "BHD" },
      stops: [{ id: "s", city: "Porto", endDate: "2027-03-04" }],
      days: Array.from({ length: 4 }, (_, index) => ({
        index,
        date: `2027-03-0${index + 1}`,
        stopId: "s",
        items: index === 0 ? [{ ...p, type: "stay", stayNights: 3, priceSource: "estimate" }] : [],
      })),
    };
    const t = computeTotals(dto, rates, "BHD");
    expect(t.perDay.map((d) => d.amount)).toEqual([45, 45, 45, 0]);
    expect(t.total).toBe(135);
    expect(t.perCity[0].amount).toBe(135);
    expect(t.estimate.mid).toBe(135);
    expect(resizeStay({ ...p, type: "stay", status: "proposed", stayNights: 3 }, 2)).toMatchObject({
      price: 90,
      stayNights: 2,
    });
    expect(resizeStay({ ...p, type: "stay", status: "booked", stayNights: 3 }, 2)).toEqual({});
  });
  it("multiplies USD flight ranges by adults, children and infants before FX and totals", () => {
    const estimate = FlightEstimate.parse({
      currency: "USD",
      adult: { low: 100, mid: 200, high: 300 },
      child: { low: 50, mid: 100, high: 150 },
      infant: { low: 10, mid: 20, high: 30 },
    });
    const p = flightPartyPrice(estimate, { adults: 2, children: 1, infants: 1 });
    expect(p).toEqual({ price: 520, priceLow: 260, priceHigh: 780, currency: "USD" });
    const t = computeTotals(
      {
        trip: { budgetAmount: 1, budgetCurrency: "BHD" },
        stops: [{ id: "s", city: "NYC" }],
        days: [
          { index: 0, date: "2026-12-15", stopId: "s", items: [{ ...p, priceSource: "estimate" }] },
        ],
      },
      rates,
      "BHD",
    );
    expect(t.estimate.mid).toBeCloseTo(195.52);
    expect(t.unpricedCount).toBe(0);
    expect(t.overBudget).toBe(true);
    expect(t.perDay[0].amount).toBe(t.total);
    expect(t.perCity[0].amount).toBe(t.total);
    expect(
      FlightEstimate.safeParse({ ...estimate, adult: { low: 200, mid: 100, high: 300 } }).success,
    ).toBe(false);
  });
  it("keeps Duffel TEST and fixture amounts separate from Live", () => {
    const t = computeTotals(
      {
        trip: { budgetAmount: null, budgetCurrency: "USD" },
        stops: [],
        days: [
          {
            index: 0,
            date: "2027-03-01",
            stopId: "s",
            items: [
              { price: 100, currency: "USD", priceSource: "live", provider: "duffel-test" },
              { price: 50, currency: "USD", priceSource: "live", provider: "fixture" },
            ],
          },
        ],
      },
      rates,
      "USD",
    );
    expect(t.live).toBe(0);
    expect(t.test).toBe(150);
    expect(t.total).toBe(150);
  });
  it("converts through USD and preserves BHD precision", () => {
    expect(convert(90, "EUR", "BHD", rates)).toBeCloseTo(37.6);
    expect(convert(37.6, "BHD", "EUR", rates)).toBeCloseTo(90);
    expect(convert(10, "XYZ", "BHD", rates)).toBeNull();
    expect(convert(10, "EUR", "EUR", null)).toBe(10);
    expect(formatMoney(1.2, "BHD")).toMatch(/1\.200/);
  });
  it("splits estimates/entered/live and excludes missing currency from converted totals", () => {
    const dto = {
      trip: { budgetAmount: 50, budgetCurrency: "BHD" },
      stops: [{ id: "s", city: "Lisbon" }],
      days: [
        {
          index: 0,
          date: "2027-03-01",
          stopId: "s",
          items: [
            { price: 90, priceLow: 45, priceHigh: 135, currency: "EUR", priceSource: "estimate" },
            { price: 10, currency: "BHD", priceSource: "entered" },
            { price: 10, currency: "USD", priceSource: "live" },
            { price: null },
            { price: 3, currency: "XYZ", priceSource: "entered" },
          ],
        },
      ],
    };
    const t = computeTotals(dto, rates, "BHD");
    expect(t.estimate).toEqual({ low: 18.8, mid: 37.6, high: 56.4 });
    expect(t.entered).toBe(10);
    expect(t.live).toBeCloseTo(3.76);
    expect(t.total).toBeCloseTo(51.36);
    expect(t.overBudget).toBe(true);
    expect(t.unpricedCount).toBe(1);
    expect(t.unconvertible).toEqual(["XYZ"]);
    expect(t.perCity[0].amount).toBeCloseTo(51.36);
    expect(t.originalTotals.XYZ).toBe(3);
    expect(computeTotals(dto, null, "BHD").total).toBe(10);
  });
});
