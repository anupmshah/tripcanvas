import { describe, expect, it } from "vitest";
import { ChatOutput, NewItem, PatchOp, Time } from "../src/lib/patch/schema";
import { annotateOps, offerFits, type PState } from "../src/lib/patch/plan";
import { retryConflict } from "../src/lib/db";

const state: PState = {
  startDate: "2027-03-01",
  stops: ["a", "b"].map((id) => ({ id, city: id, country: "Portugal", countryCode: "pt", lat: null, lng: null, airport: null, localCurrency: "EUR", nights: 1 })),
  days: [{ id: "d1", stopId: "a", items: [{ id: "hotel", status: "booked" }] }, { id: "d2", stopId: "b", items: [{ id: "walk", status: "proposed" }] }, { id: "d3", stopId: "b", items: [] }],
};
const item = { type: "food" as const, title: "Dinner", placeQuery: null, start: null, end: null, notes: null, estimate: { low: 10, mid: 20, high: 30, currency: "EUR" }, offerId: null };
describe("patch validation and booked protection", () => {
  it("retries serialization conflicts but propagates unrelated errors", async () => {
    let attempts = 0;
    expect(await retryConflict(async () => { if (++attempts < 3) throw { code: "P2034" }; return "saved"; })).toBe("saved");
    expect(attempts).toBe(3);
    await expect(retryConflict(async () => { throw new Error("invalid"); })).rejects.toThrow("invalid");
  });
  it("rejects invalid manual times and clears quotes for the final route/date", () => {
    for (const t of ["99:99", "24:00", "12:60", "9:00"]) expect(Time.safeParse(t).success).toBe(false);
    expect(Time.parse("23:59")).toBe("23:59");
    const s = structuredClone(state); s.originAirport = "BAH"; s.stops[0].airport = "LIS"; s.stops[1].airport = "OPO";
    const offer = { provider: "duffel" as const, price: 100, currency: "USD", fetchedAt: new Date().toISOString(), deepLink: "https://example.com", isLive: true, leg: { origin: "BAH", dest: "LIS", depart: s.startDate, dayIndex: 0 } };
    expect(offerFits(s, 0, offer)).toBe(true);
    expect(offerFits(s, 1, offer)).toBe(false);
    s.stops[0].airport = "JFK";
    expect(offerFits(s, 0, offer)).toBe(false);
    s.stops[0].airport = "LIS"; s.startDate = "2027-03-02";
    expect(offerFits(s, 0, offer)).toBe(false);
  });
  it("requires complete items and ordered estimates", () => {
    expect(NewItem.safeParse(item).success).toBe(true);
    expect(NewItem.safeParse({ ...item, estimate: { low: 30, mid: 20, high: 10, currency: "EUR" } }).success).toBe(false);
    expect(NewItem.safeParse({ type: "food", title: "Dinner" }).success).toBe(false);
    const badTime = NewItem.safeParse({ ...item, start: "2026-12-20T09:00:00" });
    expect(!badTime.success && badTime.error.issues[0].message).toContain("HH:MM");
    expect(PatchOp.safeParse({ op: "destroy" }).success).toBe(false);
    expect(ChatOutput.safeParse({ reply: "ok", patch: { ops: [] }, preferenceCandidates: [] }).success).toBe(true);
  });
  it("skips locked/unknown operations while keeping valid adds and stripping unknown offers", () => {
    const before = structuredClone(state);
    const r = annotateOps(state, [
      { op: "remove", itemId: "hotel", reason: "replace" },
      { op: "move", itemId: "hotel", toDayIndex: 1, position: null },
      { op: "remove", itemId: "missing", reason: "replace" },
      { op: "add", dayIndex: 1, position: null, item: { ...item, type: "flight", offerId: "invented" } },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "skipped", "skipped", "ok"]);
    expect(r.state.days[0]).toEqual(before.days[0]);
    expect(r.state.days[1].items[1].add?.item).toMatchObject({ offerId: null, estimate: null });
    expect(state).toEqual(before);
  });
  it("a rejected city change cannot mutate the accepted schedule", () => {
    const r = annotateOps(state, [
      { op: "addStop", city: "Coimbra", country: "Portugal", airport: null, localCurrency: "EUR", nights: 1, position: 0 },
      { op: "add", dayIndex: 2, position: null, item },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "ok"]);
    expect(r.state.days[2].stopId).toBe("b");
    expect(r.state.stops).toHaveLength(2);
  });
  it("rejects a reorder that shifts a booking and permits appending a city", () => {
    const r = annotateOps(state, [
      { op: "reorderStops", stopIds: ["b", "a"] },
      { op: "addStop", city: "Coimbra", country: "Portugal", airport: null, localCurrency: "EUR", nights: 1, position: null },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "ok"]);
    expect(r.state.days[0]).toEqual(state.days[0]);
    expect(r.state.days.at(-1)?.stopId).toBe(r.state.stops.at(-1)?.id);
  });
  it("keeps a booked departure day in its original city when append is rejected", () => {
    const s = structuredClone(state);
    s.days[2].items.push({ id: "return-flight", status: "booked" });
    const r = annotateOps(s, [{ op: "addStop", city: "Coimbra", country: "Portugal", airport: null, localCurrency: "EUR", nights: 1, position: null }]);
    expect(r.ops[0].status).toBe("skipped");
    expect(r.state).toEqual(s);
  });
  it("rejects moving the booked departure day to a different city on the same date", () => {
    const s = structuredClone(state);
    s.days[0].items = [];
    s.days[2].items.push({ id: "return-flight", status: "booked" });
    const r = annotateOps(s, [{ op: "reorderStops", stopIds: ["b", "a"] }]);
    expect(r.ops[0].status).toBe("skipped");
    expect(r.state).toEqual(s);
  });
});
