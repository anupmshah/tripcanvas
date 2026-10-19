import { describe, expect, it } from "vitest";
import { ChatOutput, NewItem, PatchOp } from "../src/lib/patch/schema";
import { annotateOps, type PState } from "../src/lib/patch/plan";

const state: PState = {
  startDate: "2027-03-01",
  stops: ["a", "b"].map((id) => ({ id, city: id, country: "Portugal", countryCode: "pt", lat: null, lng: null, airport: null, localCurrency: "EUR", nights: 1 })),
  days: [{ id: "d1", stopId: "a", items: [{ id: "hotel", status: "booked" }] }, { id: "d2", stopId: "b", items: [{ id: "walk", status: "proposed" }] }, { id: "d3", stopId: "b", items: [] }],
};
const item = { type: "food" as const, title: "Dinner", placeQuery: null, start: null, end: null, notes: null, estimate: { low: 10, mid: 20, high: 30, currency: "EUR" }, offerId: null };
describe("patch validation and booked protection", () => {
  it("requires complete items and ordered estimates", () => {
    expect(NewItem.safeParse(item).success).toBe(true);
    expect(NewItem.safeParse({ ...item, estimate: { low: 30, mid: 20, high: 10, currency: "EUR" } }).success).toBe(false);
    expect(NewItem.safeParse({ type: "food", title: "Dinner" }).success).toBe(false);
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
