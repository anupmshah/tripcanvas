import { execSync } from "node:child_process";
import { assert, j, items, newDemoTrip, setStage, BASE_URL } from "./smoke-lib.mjs";

setStage("stage 1: scaffold + data model + multi-city");
const h = await j("/api/health");
assert(h.status === 200 && h.data.ok && h.data.db === true, "health ok, db true");
assert(
  typeof h.data.env.openai === "boolean" && !JSON.stringify(h.data).includes("sk-"),
  "health exposes booleans only",
);
const p = await j("/api/profile");
assert(p.data.displayCurrency === "BHD", "profile displayCurrency BHD");

const { id, dto } = await newDemoTrip();
assert(
  dto.stops.length === 2 && dto.stops[0].city === "Lisbon" && dto.stops[1].city === "Porto",
  "demo has 2 stops Lisbon → Porto",
);
assert(dto.days.length === 6, "demo has 6 days (5 nights + departure day)");
assert(items(dto).length === 17, `demo has 17 items (got ${items(dto).length})`);
assert(items(dto).filter((i) => i.status === "booked").length === 1, "exactly 1 booked item");
const [a, b] = dto.stops;
assert(
  a.endDate === b.startDate && b.endDate === dto.trip.endDate && a.startDate === dto.trip.startDate,
  "stop date ranges are contiguous",
);
const lisbonDays = dto.days.filter((d) => d.stopId === a.id).length;
assert(
  lisbonDays === 3 && dto.days.filter((d) => d.stopId === b.id).length === 3,
  "days map to stops (3 + 2 nights + departure day)",
);
assert(
  dto.trip.destination === "Portugal: Lisbon → Porto",
  `destination label (${dto.trip.destination})`,
);
const page = await fetch(`${BASE_URL}/trip/${id}`);
const html = await page.text();
assert(
  page.status === 200 && html.includes("Belém Tower"),
  "GET /trip/<id> 200 and contains Belém Tower",
);
assert((await fetch(`${BASE_URL}/trip/nope`)).status === 404, "unknown trip page is 404");

// 3-city trip creation (real Nominatim geocoding)
const three = {
  title: "East coast",
  originAirport: "BAH",
  startDate: "2027-03-01",
  adults: 2,
  children: 0,
  budgetAmount: 3000,
  stops: [
    { city: "New York", country: "USA", airport: "JFK", localCurrency: "USD", nights: 3 },
    { city: "Washington", country: "USA", airport: "DCA", localCurrency: "USD", nights: 2 },
    { city: "Orlando", country: "USA", airport: "MCO", localCurrency: "USD", nights: 4 },
  ],
};
const bad = await j("/api/trips", { method: "POST", body: { ...three, endDate: "2027-03-08" } });
assert(
  bad.status === 400 && /must match/.test(bad.data.error),
  "nights not summing to trip length → 400",
);
const unk = await j("/api/trips", {
  method: "POST",
  body: {
    ...three,
    stops: [{ ...three.stops[0], city: "Zzzxqy Nowhereville", country: "Qqqland" }],
  },
});
assert(unk.status === 400, "unresolvable city → 400");
const c = await j("/api/trips", { method: "POST", body: { ...three, endDate: "2027-03-10" } });
assert(c.status === 201, "3-city trip created");
const t3 = (await j(`/api/trips/${c.data.id}`)).data;
assert(t3.stops.length === 3 && t3.days.length === 10, `3 stops, 10 days (got ${t3.days.length})`);
assert(
  t3.stops.every((s) => s.lat != null && s.countryCode === "us"),
  "every stop geocoded with country code",
);
assert(
  t3.days.map((d) => d.stopId).join() ===
    [0, 0, 0, 1, 1, 2, 2, 2, 2, 2].map((i) => t3.stops[i].id).join(),
  "days assigned to stops contiguously",
);
assert(
  t3.trip.destination === "USA: New York → Washington → Orlando" &&
    t3.trip.endDate === "2027-03-10",
  "label + end date",
);
assert(
  t3.days.every((d, i) => d.index === i),
  "day indexes 0..n-1",
);
const list = await j("/api/trips");
assert(
  list.data.trips.some((t) => t.id === c.data.id),
  "trip list includes new trip",
);

let ignored = true;
try {
  execSync("git check-ignore .env", { stdio: "pipe" });
} catch {
  ignored = false;
}
assert(ignored, ".env is git-ignored");
console.log("\nSTAGE 1 SMOKE PASSED");
