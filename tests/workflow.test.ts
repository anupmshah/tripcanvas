import { expect, it } from "vitest";
import {
  TripDraft,
  FromTextInput,
  blockingQuestions,
  resolveDraftDates,
} from "../src/lib/llm/draft";
import { linksForItem, airlineSite } from "../src/lib/links/deeplinks";
import { makeIcs } from "../src/lib/export/ics";
import {
  verificationQueries,
  wikiMatches,
  locationVerified,
  canReadGeoCache,
} from "../src/lib/geo/queries";
import { cityTitles } from "../src/lib/info/wiki";
it("normalises city aliases and removes country qualifiers for guide lookups", () => {
  expect(cityTitles("New York, USA")).toEqual(["New York City", "New York"]);
  expect(cityTitles("NYC, United States")[0]).toBe("New York City");
  expect(cityTitles("Porto, Portugal")).toEqual(["Porto"]);
});
it("tries a complete place query before the bounded name and accepts only a relevant wiki match", () => {
  expect(verificationQueries("Magic Kingdom Park", { city: "Orlando", country: "USA" })).toEqual([
    "Magic Kingdom Park, Orlando, USA",
    "Magic Kingdom Park",
  ]);
  expect(
    verificationQueries("Torre de Belém, Lisbon", { city: "Porto", country: "Portugal" })[0],
  ).toBe("Torre de Belém, Lisbon");
  expect(
    wikiMatches(
      "Universal's Islands of Adventure, Orlando, USA",
      "Islands of Adventure",
      "A theme park in Orlando",
    ),
  ).toBe(true);
  expect(wikiMatches("Imaginary restaurant 9z71q", "New York City", "A city in the USA")).toBe(
    false,
  );
  expect(locationVerified("wikipedia")).toBe(true);
  expect(locationVerified("pending")).toBe(false);
  const hit = { found: false, fetchedAt: new Date() };
  expect(canReadGeoCache(hit)).toBe(true);
  expect(canReadGeoCache(hit, true)).toBe(false);
  expect(canReadGeoCache({ ...hit, found: true }, true)).toBe(true);
});
const draft = {
  destination: "USA",
  originAirport: "BAH",
  adults: 2,
  children: 1,
  childAges: [],
  lengthDays: 15,
  earliest: "2026-12-15",
  latest: "2027-01-05",
  startDate: "2026-12-16",
  endDate: "2026-12-30",
  dateReason: "Fits the window; prices have not been checked.",
  budgetAmount: null,
  budgetCurrency: "BHD",
  interests: "First USA visit",
  food: "vegetarian",
  pace: "balanced",
  firstVisit: true,
  notes: "",
  route: [
    {
      city: "New York",
      country: "USA",
      airport: "JFK",
      localCurrency: "USD",
      nights: 5,
      transport: null,
    },
    {
      city: "Washington",
      country: "USA",
      airport: "DCA",
      localCurrency: "USD",
      nights: 4,
      transport: "train",
    },
    {
      city: "Orlando",
      country: "USA",
      airport: "MCO",
      localCurrency: "USD",
      nights: 5,
      transport: "flight",
    },
  ],
  preferenceCandidates: [{ field: "food", value: "vegetarian", evidence: "we are vegetarians" }],
};
it("lets chat rebalance edited nights but refuses inconsistent creation", () => {
  const edited = { ...draft, lengthDays: 20 };
  expect(FromTextInput.safeParse({ text: "USA", action: "propose", draft: edited }).success).toBe(
    true,
  );
  expect(FromTextInput.safeParse({ text: "USA", action: "create", draft: edited }).success).toBe(
    false,
  );
});
it("accepts a 15-day window trip without asking for budget or child ages", () => {
  expect(TripDraft.safeParse(draft).success).toBe(true);
  expect(blockingQuestions(TripDraft.parse(draft))).toEqual([]);
  expect(TripDraft.safeParse({ ...draft, endDate: "2027-01-06" }).success).toBe(false);
  expect(TripDraft.safeParse({ ...draft, route: [{ ...draft.route[0], nights: 2 }] }).success).toBe(
    false,
  );
});
it("asks only for the missing destination, duration and date window", () => {
  expect(
    blockingQuestions({
      ...draft,
      destination: null,
      lengthDays: null,
      earliest: null,
      latest: null,
      startDate: null,
      endDate: null,
    } as any),
  ).toHaveLength(3);
});
it("derives inclusive end dates and fits the selected start inside a window", () => {
  expect(
    resolveDraftDates({ ...draft, startDate: "2026-12-20", endDate: "2027-01-04" } as any),
  ).toMatchObject({ startDate: "2026-12-20", endDate: "2027-01-03" });
  expect(resolveDraftDates({ ...draft, startDate: "2027-01-01" } as any)).toMatchObject({
    startDate: "2026-12-22",
    endDate: "2027-01-05",
  });
});
it("builds booking links from the item's own stop, dates and party", () => {
  const trip = { originAirport: "BAH", adults: 2, children: 1 };
  const stops = [
    { id: "lis", order: 0, city: "Lisbon", airport: "LIS", endDate: "2026-12-20" },
    { id: "opo", order: 1, city: "Porto", airport: "OPO", endDate: "2026-12-23" },
  ];
  const day = { index: 3, date: "2026-12-20", stopId: "opo" };
  const links = linksForItem({ type: "stay", title: "Hotel A & B" }, day, trip, stops, 6);
  const booking = new URL(links[0].url);
  expect(booking.searchParams.get("ss")).toBe("Hotel A & B, Porto");
  expect(booking.searchParams.get("checkin")).toBe("2026-12-20");
  expect(booking.searchParams.get("checkout")).toBe("2026-12-23");
  expect(booking.searchParams.get("group_children")).toBe("1");
  const ret = linksForItem(
    { type: "flight", title: "Return" },
    { ...day, index: 6, date: "2026-12-23" },
    trip,
    stops,
    6,
  );
  expect(decodeURIComponent(ret[0].url)).toContain("OPO to BAH on 2026-12-23");
  expect(new URL(airlineSite("TP", "TAP")).hostname).toBe("www.flytap.com");
});
it("exports safe folded UTF-8 ICS with all-day and overnight local events", () => {
  const result = makeIcs({
    trip: { title: "Test" },
    stops: [{ id: "s", city: "Porto" }],
    days: [
      {
        date: "2026-12-20",
        stopId: "s",
        items: [
          {
            id: "a",
            title: "Walk, museum;\r\nBEGIN:VEVENT",
            start: "23:30",
            end: "00:30",
            notes: "é🗺".repeat(100),
          },
          { id: "b", title: "Untimed visit", start: null, end: null, notes: null },
        ],
      },
    ],
  });
  expect(result.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(result.match(/^BEGIN:VEVENT/gm)).toHaveLength(2);
  expect(result).toContain("SUMMARY:Walk\\, museum\\;\\nBEGIN:VEVENT");
  expect(result).toContain("DTEND:20261221T003000");
  expect(result).toContain("DTSTART;VALUE=DATE:20261220");
  expect(result.replaceAll("\r\n", "").includes("\n")).toBe(false);
  expect(result.split("\r\n").every((s) => Buffer.byteLength(s, "utf8") <= 75)).toBe(true);
});
