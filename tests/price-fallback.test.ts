import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/duffel-offers.json";
import invalid from "./fixtures/duffel-error-422.json";
import { searchFlightsWithFallback, type Cache } from "../src/lib/price";
let time = new Date("2027-03-01T12:00:00Z").getTime();
let cache: Cache;
const p = { origin: "BAH", dest: "LIS", dates: { depart: "2027-04-01" }, travellers: { adults: 2, children: 1 } };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); time += 4000; vi.setSystemTime(time);
  const values = new Map(); cache = { get: async (k) => values.get(k) ?? null, set: async (k, v) => { values.set(k, v); } };
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe("Duffel provider fallback", () => {
  it("returns unpriced links without a token and caches for 15 minutes", async () => {
    const a = await searchFlightsWithFallback(p, { token: "", cache });
    expect(a.source).toBe("deeplink"); expect(a.offers).toHaveLength(2);
    expect(a.offers.every((o) => o.price === null && !o.isLive && new URL(o.deepLink).protocol === "https:")).toBe(true);
    expect((await searchFlightsWithFallback(p, { token: "", cache })).cached).toBe(true);
    vi.setSystemTime(time + 16 * 60_000);
    expect((await searchFlightsWithFallback(p, { token: "", cache })).cached).toBe(false);
  });
  for (const [name, response] of [["500", () => Promise.resolve(new Response("server failed", { status: 500 }))], ["422 fixture", () => Promise.resolve(Response.json(invalid, { status: 422 }))], ["network error", () => Promise.reject(new TypeError("fetch failed"))], ["timeout", () => Promise.reject(new DOMException("timeout", "TimeoutError"))], ["empty offers", () => Promise.resolve(Response.json({ data: { offers: [] } }))]] as const) {
    it(`falls back without throwing on ${name}`, async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(response);
      const r = await searchFlightsWithFallback(p, { token: "duffel_test_fixture", cache });
      expect(r.source).toBe("deeplink"); expect(r.error).toBeTruthy();
      expect(r.offers.every((o) => o.price === null)).toBe(true);
    });
  }
  it("normalizes sorted real-shaped offers and pins the Duffel version", async () => {
    let request: RequestInit | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => { request = init; return Response.json(fixture); });
    const r = await searchFlightsWithFallback(p, { token: "duffel_test_fixture", cache });
    expect(r.offers[0]).toMatchObject({ provider: "duffel-test", price: 245.5, currency: "EUR", isLive: true, offerId: "off_fixture_cheap" });
    expect(new Headers(request?.headers).get("Duffel-Version")).toBe("v2");
    expect(JSON.parse(String(request?.body)).data.passengers).toEqual([{ type: "adult" }, { type: "adult" }, { age: 10 }]);
    expect((await searchFlightsWithFallback(p, { token: "duffel_test_fixture", cache })).cached).toBe(true);
  });
});
