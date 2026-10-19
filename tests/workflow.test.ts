import { expect, it } from "vitest";
import { TripDraft, blockingQuestions, resolveDraftDates } from "../src/lib/llm/draft";
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
