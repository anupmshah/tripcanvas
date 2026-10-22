import { assert, j, items, newDemoTrip, setStage } from "./smoke-lib.mjs";
setStage("stage 5: booking links, booked locks, real confirmation extraction");
const { id, dto } = await newDemoTrip();
const allowed = [
  "www.google.com",
  "www.skyscanner.net",
  "www.booking.com",
  "www.airbnb.com",
  "www.getyourguide.com",
  "www.flytap.com",
  "www.gulfair.com",
];
for (const day of dto.days)
  for (const item of day.items.filter((i) => ["flight", "stay", "activity"].includes(i.type))) {
    assert(item.links.length >= 1, `${item.type} has booking links`);
    const stop = dto.stops.find((s) => s.id === day.stopId);
    for (const link of item.links) {
      const u = new URL(link.url);
      assert(
        u.protocol === "https:" && allowed.includes(u.hostname),
        `allowed HTTPS link: ${link.label}`,
      );
      const decoded = decodeURIComponent(link.url);
      if (link.label !== "Find airline site")
        assert(
          decoded.includes(day.date) || decoded.includes(day.date.slice(2).replaceAll("-", "")),
          "item's date prefilled",
        );
      if (item.type === "stay")
        assert(
          decoded.includes(stop.city) && decoded.includes(stop.endDate),
          "stay uses own city and stop checkout",
        );
    }
  }
const activity = items(dto).find((i) => i.type === "activity");
const booked = await j(`/api/items/${activity.id}/book`, {
  method: "POST",
  body: { bookingRef: "SMK-1", price: 25.5, currency: "EUR" },
});
assert(
  booked.status === 200 && booked.data.status === "booked" && booked.data.priceSource === "entered",
  "booking saves final price as Entered",
);
assert(
  (await j(`/api/items/${activity.id}`, { method: "DELETE" })).status === 409,
  "booked activity cannot be deleted",
);
assert(
  (
    await j(`/api/trips/${id}/layout`, {
      method: "POST",
      body: { days: [{ dayId: dto.days[4].id, itemIds: [activity.id] }] },
    })
  ).status === 409,
  "booked activity cannot change day",
);
const target = items(dto).find((i) => i.type === "stay" && i.status === "proposed");
const before = (await j(`/api/trips/${id}`)).data.days
  .flatMap((d) => d.items)
  .find((i) => i.id === target.id);
const r = await j(`/api/items/${target.id}/extract-confirmation`, {
  method: "POST",
  body: {
    text: "Provider confirmation email. Booking reference: QX7P2L. Hotel Infante Sagres, Porto. Total paid: EUR 245.50. Check-in 14:30. Thank you.",
  },
});
assert(
  r.status === 200 &&
    r.data.bookingRef === "QX7P2L" &&
    r.data.price === 245.5 &&
    r.data.currency === "EUR" &&
    r.data.start === "14:30",
  "real OpenAI extracts reference, paid price, currency and time",
);
const after = (await j(`/api/trips/${id}`)).data.days
  .flatMap((d) => d.items)
  .find((i) => i.id === target.id);
assert(
  JSON.stringify(before) === JSON.stringify(after),
  "extracting a confirmation does not save or change item",
);
assert(
  (
    await j(`/api/items/${activity.id}/book`, {
      method: "POST",
      body: { bookingRef: "overwrite", price: 1, currency: "EUR" },
    })
  ).status === 409,
  "cannot overwrite an already booked item",
);
const late = items(dto).find((i) => i.title === "MAAT");
const proposal = await j(`/api/trips/${id}/chat`, {
  method: "POST",
  headers: { "x-forwarded-for": `stage5-${id}` },
  body: { message: "Remove MAAT from my itinerary; no other changes.", mode: "chat" },
});
assert(
  proposal.status === 200 &&
    proposal.data.patch.ops.some(
      (o) => o.op === "remove" && o.itemId === late.id && o.status === "ok",
    ),
  "real chat proposes removal before item is booked",
);
assert(
  (
    await j(`/api/items/${late.id}/book`, {
      method: "POST",
      body: { bookingRef: "LATE-1", price: 22, currency: "EUR" },
    })
  ).status === 200,
  "item booked after proposal",
);
const getLate = async () => items((await j(`/api/trips/${id}`)).data).find((i) => i.id === late.id);
const locked = await getLate();
const decision = await j(`/api/patches/${proposal.data.patch.id}/apply`, { method: "POST" });
assert(
  decision.status === 200 && decision.data.skipped.some((s) => /booked/i.test(s.reason)),
  "apply re-reads and skips newly booked item",
);
assert(
  JSON.stringify(await getLate()) === JSON.stringify(locked),
  "late booking byte-identical after patch",
);
console.log("STAGE 5 SMOKE PASSED");
