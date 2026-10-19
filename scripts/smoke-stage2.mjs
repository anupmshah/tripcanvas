import { assert, j, findItem, newDemoTrip, setStage } from "./smoke-lib.mjs";

setStage("stage 2: editor + map + external data");
const { id, dto } = await newDemoTrip();
const km = (a, b) => {
  const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// Verify every seeded place against live Nominatim, with the day's city as context
const all = dto.days.flatMap((d) => d.items.map((i) => ({ ...i, stopId: d.stopId })));
const timings = [];
for (const pass of [1, 2]) {
  let uncached = 0; const t0 = Date.now();
  for (const it of all) {
    const t = Date.now();
    const r = await j(`/api/geocode?q=${encodeURIComponent(it.placeQuery)}&stopId=${it.stopId}`);
    assert(r.status === 200 && r.data.found === true, `[pass ${pass}] found "${it.placeQuery}"`);
    const d = km([it.lat, it.lng], [r.data.lat, r.data.lng]);
    assert(d < 3, `   within 3 km of seed (${d.toFixed(2)} km)`);
    if (pass === 1 && !r.data.cached) { uncached++; timings.push(Date.now() - t); }
    if (pass === 2) assert(r.data.cached === true, "   second pass served from cache");
  }
  if (pass === 1) {
    const slow = timings.filter((t) => t >= 1000).length;
    console.log(`  timing: ${uncached} uncached, ${slow} took ≥1s, total ${(Date.now() - t0) / 1000}s`);
    assert(uncached === 0 || slow >= uncached - 1, "uncached geocodes are throttled to ≥1s each");
  } else console.log(`  second pass total ${Date.now() - t0}ms`);
}

// Wikipedia / Wikivoyage
const wp = await j("/api/place-info?title=" + encodeURIComponent("Belém Tower") + "&source=wikipedia");
assert(wp.data.found && wp.data.extract && /wikipedia\.org/.test(wp.data.url) && wp.data.fetchedAt, "wikipedia place info for Belém Tower");
const wv = await j("/api/place-info?title=Porto&source=wikivoyage");
assert(wv.data.found && /wikivoyage\.org/.test(wv.data.url), "wikivoyage place info for Porto");
assert((await j("/api/place-info?title=x&source=bogus")).status === 400, "bad source → 400");

// Weather per stop
const wx = await j(`/api/weather?tripId=${id}`);
assert(wx.status === 200 && wx.data.stops.length === 2, "weather returns both stops");
assert(wx.data.stops.every((s) => s.available === true), "forecast available for each stop (trip starts in 10 days)");
assert(wx.data.stops.reduce((n, s) => n + s.days.length, 0) === 6, "forecast covers all 6 days");

// Layout: move proposed item day 2 → day 3; booked hotel is locked
const castle = findItem(dto, "Belém Tower"), day2 = dto.days[1], day3 = dto.days[2];
const lay = (days) => j(`/api/trips/${id}/layout`, { method: "POST", body: { days } });
let r = await lay([
  { dayId: day2.id, itemIds: day2.items.map((i) => i.id).filter((x) => x !== castle.id) },
  { dayId: day3.id, itemIds: [castle.id, ...day3.items.map((i) => i.id)] },
]);
assert(r.status === 200, "layout move day 2 → 3 accepted");
let now = (await j(`/api/trips/${id}`)).data;
assert(now.days[2].items[0].id === castle.id && now.days[1].items.every((i) => i.id !== castle.id), "move reflected in GET (and survives reload)");
const hotel = findItem(dto, "Hotel Avenida Palace");
const day1 = dto.days[0];
r = await lay([{ dayId: day1.id, itemIds: day1.items.map((i) => i.id).filter((x) => x !== hotel.id) }, { dayId: day3.id, itemIds: [hotel.id] }]);
assert(r.status === 409, "moving the booked hotel to another day → 409");
r = await lay([{ dayId: day1.id, itemIds: [...day1.items.map((i) => i.id)].reverse() }]);
assert(r.status === 200, "reordering within a day (booked included) is fine");
// Cross-city drag (Lisbon item onto a Porto day) works for proposed items
const mm = findItem(dto, "MAAT"), porto = dto.days[4];
r = await lay([{ dayId: dto.days[1].id, itemIds: now.days[1].items.map((i) => i.id).filter((x) => x !== mm.id) }, { dayId: porto.id, itemIds: [...porto.items.map((i) => i.id), mm.id] }]);
assert(r.status === 200, "proposed item can be dragged to a day in another city");

// CRUD
r = await j(`/api/items/${hotel.id}`, { method: "DELETE" });
assert(r.status === 409, "DELETE booked item → 409");
r = await j(`/api/items/${hotel.id}`, { method: "PATCH", body: { title: "Hacked" } });
assert(r.status === 409, "PATCH booked title → 409");
r = await j(`/api/items/${hotel.id}`, { method: "PATCH", body: { notes: "Late check-in" } });
assert(r.status === 200 && r.data.notes === "Late check-in", "booked item notes editable");
r = await j(`/api/trips/${id}/items`, { method: "POST", body: { dayIndex: 4, type: "activity", title: "Zzzxqy Nonexistent Place" } });
assert(r.status === 201 && r.data.geoStatus === "unresolved" && r.data.lat === null, "nonexistent place → geoStatus unresolved");
const bad = r.data.id;
r = await j(`/api/trips/${id}/items`, { method: "POST", body: { dayIndex: 4, type: "activity", title: "Ribeira", placeQuery: "Ribeira, Porto" } });
assert(r.status === 201 && r.data.geoStatus === "ok" && r.data.lat > 41 && r.data.lat < 41.3, "Porto place geocoded in Porto context");
r = await j(`/api/trips/${id}/items`, { method: "POST", body: { dayIndex: 99, type: "food", title: "x" } });
assert(r.status === 404, "bad dayIndex → 404");
r = await j(`/api/items/${bad}`, { method: "DELETE" });
assert(r.status === 204, "DELETE proposed item → 204");
console.log("\nSTAGE 2 SMOKE PASSED");
