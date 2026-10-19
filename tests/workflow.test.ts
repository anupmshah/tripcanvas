import { expect, it } from "vitest";
import { TripDraft, blockingQuestions, resolveDraftDates } from "../src/lib/llm/draft";
import { linksForItem, airlineSite } from "../src/lib/links/deeplinks";
const draft = {
  destination: "USA", originAirport: "BAH", adults: 2, children: 1, childAges: [], lengthDays: 15,
  earliest: "2026-12-15", latest: "2027-01-05", startDate: "2026-12-16", endDate: "2026-12-30", dateReason: "Fits the window; prices have not been checked.",
  budgetAmount: null, budgetCurrency: "BHD", interests: "First USA visit", food: "vegetarian", pace: "balanced", firstVisit: true, notes: "",
  route: [{ city: "New York", country: "USA", airport: "JFK", localCurrency: "USD", nights: 5, transport: null }, { city: "Washington", country: "USA", airport: "DCA", localCurrency: "USD", nights: 4, transport: "train" }, { city: "Orlando", country: "USA", airport: "MCO", localCurrency: "USD", nights: 5, transport: "flight" }],
  preferenceCandidates: [{ field: "food", value: "vegetarian", evidence: "we are vegetarians" }],
};
it("accepts a 15-day window trip without asking for budget or child ages", () => {
  expect(TripDraft.safeParse(draft).success).toBe(true);
  expect(blockingQuestions(TripDraft.parse(draft))).toEqual([]);
  expect(TripDraft.safeParse({ ...draft, endDate: "2027-01-06" }).success).toBe(false);
  expect(TripDraft.safeParse({ ...draft, route: [{ ...draft.route[0], nights: 2 }] }).success).toBe(false);
});
it("asks only for the missing destination, duration and date window", () => {
  expect(blockingQuestions({ ...draft, destination: null, lengthDays: null, earliest: null, latest: null, startDate: null, endDate: null } as any)).toHaveLength(3);
});
it("derives inclusive end dates and fits the selected start inside a window", () => {
  expect(resolveDraftDates({ ...draft, startDate: "2026-12-20", endDate: "2027-01-04" } as any)).toMatchObject({ startDate: "2026-12-20", endDate: "2027-01-03" });
  expect(resolveDraftDates({ ...draft, startDate: "2027-01-01" } as any)).toMatchObject({ startDate: "2026-12-22", endDate: "2027-01-05" });
});
it("builds booking links from the item's own stop, dates and party", () => {
  const trip = { originAirport: "BAH", adults: 2, children: 1 };
  const stops = [{ id: "lis", order: 0, city: "Lisbon", airport: "LIS", endDate: "2026-12-20" }, { id: "opo", order: 1, city: "Porto", airport: "OPO", endDate: "2026-12-23" }];
  const day = { index: 3, date: "2026-12-20", stopId: "opo" };
  const links = linksForItem({ type: "stay", title: "Hotel A & B" }, day, trip, stops, 6);
  const booking = new URL(links[0].url);
  expect(booking.searchParams.get("ss")).toBe("Hotel A & B, Porto");
  expect(booking.searchParams.get("checkin")).toBe("2026-12-20");
  expect(booking.searchParams.get("checkout")).toBe("2026-12-23");
  expect(booking.searchParams.get("group_children")).toBe("1");
  const ret = linksForItem({ type: "flight", title: "Return" }, { ...day, index: 6, date: "2026-12-23" }, trip, stops, 6);
  expect(decodeURIComponent(ret[0].url)).toContain("OPO to BAH on 2026-12-23");
  expect(new URL(airlineSite("TP", "TAP")).hostname).toBe("www.flytap.com");
});
