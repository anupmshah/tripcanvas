import { describe, expect, it } from "vitest";
import { ChatOutput, NewItem, PatchOp, Time, groundedPrefs } from "../src/lib/patch/schema";
import { annotateOps, offerFits, rejectPricierSwaps, type PState } from "../src/lib/patch/plan";
import { retryConflict } from "../src/lib/db";
import { jsonCorrections } from "../src/lib/llm/openai";

const state: PState = {
  startDate: "2027-03-01",
  stops: ["a", "b"].map((id) => ({
    id,
    city: id,
    country: "Portugal",
    countryCode: "pt",
    lat: null,
    lng: null,
    airport: null,
    localCurrency: "EUR",
    nights: 1,
  })),
  days: [
    { id: "d1", stopId: "a", items: [{ id: "hotel", status: "booked" }] },
    { id: "d2", stopId: "b", items: [{ id: "walk", status: "proposed" }] },
    { id: "d3", stopId: "b", items: [] },
  ],
};
const item = {
  type: "food" as const,
  title: "Dinner",
  placeQuery: null,
  start: null,
  end: null,
  notes: null,
  estimate: { low: 10, mid: 20, high: 30, currency: "EUR" },
  offerId: null,
};
describe("patch validation and booked protection", () => {
  it("includes every missing item field in the model correction, beyond eight errors", () => {
    const r = ChatOutput.safeParse({
      reply: "ok",
      preferenceCandidates: [],
      patch: {
        ops: Array.from({ length: 30 }, () => ({
          op: "add",
          dayIndex: 0,
          position: null,
          item: { ...item, notes: undefined },
        })),
      },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(jsonCorrections(r.error)).toContain("patch.ops.29.item.notes");
  });
  it("retries serialization conflicts but propagates unrelated errors", async () => {
    let attempts = 0;
    expect(
      await retryConflict(async () => {
        if (++attempts < 3) throw { code: "P2034" };
        return "saved";
      }),
    ).toBe("saved");
    expect(attempts).toBe(3);
    await expect(
      retryConflict(async () => {
        throw new Error("invalid");
      }),
    ).rejects.toThrow("invalid");
  });
  it("rejects invalid manual times and clears quotes for the final route/date", () => {
    for (const t of ["99:99", "24:00", "12:60", "9:00"])
      expect(Time.safeParse(t).success).toBe(false);
    expect(Time.parse("23:59")).toBe("23:59");
    const s = structuredClone(state);
    s.originAirport = "BAH";
    s.stops[0].airport = "LIS";
    s.stops[1].airport = "OPO";
    const offer = {
      provider: "duffel" as const,
      price: 100,
      currency: "USD",
      fetchedAt: new Date().toISOString(),
      deepLink: "https://example.com",
      isLive: true,
      leg: { origin: "BAH", dest: "LIS", depart: s.startDate, dayIndex: 0 },
    };
    expect(offerFits(s, 0, offer)).toBe(true);
    expect(offerFits(s, 1, offer)).toBe(false);
    s.stops[0].airport = "JFK";
    expect(offerFits(s, 0, offer)).toBe(false);
    s.stops[0].airport = "LIS";
    s.startDate = "2027-03-02";
    expect(offerFits(s, 0, offer)).toBe(false);
  });
  it("requires complete items and ordered estimates", () => {
    expect(NewItem.safeParse(item).success).toBe(true);
    expect(
      NewItem.safeParse({ ...item, estimate: { low: 30, mid: 20, high: 10, currency: "EUR" } })
        .success,
    ).toBe(false);
    expect(NewItem.safeParse({ type: "food", title: "Dinner" }).success).toBe(false);
    const badTime = NewItem.safeParse({ ...item, start: "2026-12-20T09:00:00" });
    expect(!badTime.success && badTime.error.issues[0].message).toContain("HH:MM");
    expect(PatchOp.safeParse({ op: "destroy" }).success).toBe(false);
    expect(
      ChatOutput.safeParse({ reply: "ok", patch: { ops: [] }, preferenceCandidates: [] }).success,
    ).toBe(true);
  });
  it("skips locked/unknown operations while keeping valid adds and stripping unknown offers", () => {
    const before = structuredClone(state);
    const r = annotateOps(state, [
      { op: "remove", itemId: "hotel", reason: "replace" },
      { op: "move", itemId: "hotel", toDayIndex: 1, position: null },
      { op: "remove", itemId: "missing", reason: "replace" },
      {
        op: "add",
        dayIndex: 1,
        position: null,
        item: { ...item, type: "flight", offerId: "invented" },
      },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "skipped", "skipped", "ok"]);
    expect(r.state.days[0]).toEqual(before.days[0]);
    expect(r.state.days[1].items[1].add?.item).toMatchObject({ offerId: null, estimate: null });
    expect(state).toEqual(before);
  });
  it("a rejected city change cannot mutate the accepted schedule", () => {
    const r = annotateOps(state, [
      {
        op: "addStop",
        city: "Coimbra",
        country: "Portugal",
        airport: null,
        localCurrency: "EUR",
        nights: 1,
        position: 0,
      },
      { op: "add", dayIndex: 2, position: null, item },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "ok"]);
    expect(r.state.days[2].stopId).toBe("b");
    expect(r.state.stops).toHaveLength(2);
  });
  it("rejects a reorder that shifts a booking and permits appending a city", () => {
    const r = annotateOps(state, [
      { op: "reorderStops", stopIds: ["b", "a"] },
      {
        op: "addStop",
        city: "Coimbra",
        country: "Portugal",
        airport: null,
        localCurrency: "EUR",
        nights: 1,
        position: null,
      },
    ]);
    expect(r.ops.map((o) => o.status)).toEqual(["skipped", "ok"]);
    expect(r.state.days[0]).toEqual(state.days[0]);
    expect(r.state.days.at(-1)?.stopId).toBe(r.state.stops.at(-1)?.id);
  });
  it("keeps a booked departure day in its original city when append is rejected", () => {
    const s = structuredClone(state);
    s.days[2].items.push({ id: "return-flight", status: "booked" });
    const r = annotateOps(s, [
      {
        op: "addStop",
        city: "Coimbra",
        country: "Portugal",
        airport: null,
        localCurrency: "EUR",
        nights: 1,
        position: null,
      },
    ]);
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

describe("budget swaps and preference grounding", () => {
  const S: PState = {
    startDate: "2026-12-17",
    stops: [
      {
        id: "ny",
        city: "New York",
        country: "USA",
        countryCode: "us",
        lat: 0,
        lng: 0,
        airport: "JFK",
        localCurrency: "USD",
        nights: 5,
      },
    ],
    days: Array.from({ length: 6 }, (_, i) => ({ id: `d${i}`, stopId: "ny", items: [] })),
  };
  const swap = (nightly: number) =>
    [
      { op: "remove", itemId: "old", reason: "over budget - swap for cheaper stay", status: "ok" },
      {
        op: "add",
        dayIndex: 0,
        position: null,
        status: "ok",
        item: {
          type: "stay",
          title: "Hotel stay at Pod 51",
          placeQuery: null,
          start: null,
          end: null,
          notes: null,
          offerId: null,
          estimate: { low: nightly, mid: nightly, high: nightly, currency: "USD", basis: "night" },
        },
      },
    ] as Parameters<typeof rejectPricierSwaps>[0];
  const old = [{ id: "old", stopId: "ny", total: 3000, currency: "USD" }];

  it("skips a 'cheaper' stay swap that costs more for the stay", () => {
    const out = rejectPricierSwaps(swap(1020), S, old); // 1020 x 5 = 5100 > 3000
    expect(out.map((o) => o.status)).toEqual(["skipped", "skipped"]);
    expect(out[1].reason).toBe("not cheaper than the current stay");
  });
  it("keeps a stay swap that is actually cheaper", () => {
    const out = rejectPricierSwaps(swap(400), S, old); // 400 x 5 = 2000 < 3000
    expect(out.map((o) => o.status)).toEqual(["ok", "ok"]);
  });
  it("drops preferences whose evidence the user never said", () => {
    const said = ["Plan a USA trip for 2 adults and 1 kid. We are vegetarians."];
    const kept = groundedPrefs(
      [
        { field: "food", value: "vegetarian", evidence: "we are vegetarians" },
        { field: "pace", value: "relaxed", evidence: "we hate early starts" },
      ],
      said,
    );
    expect(kept.map((p) => p.field)).toEqual(["food"]);
  });
});
