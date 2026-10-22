import { assert, j, items, newDemoTrip, setStage } from "./smoke-lib.mjs";
setStage("stage 3: real chat, patch safety, multi-city");
const { id, dto } = await newDemoTrip();
const hotel = items(dto).find((i) => i.status === "booked");
const post = (message, ip = `smoke-chat-${id}`) =>
  j(`/api/trips/${id}/chat`, {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: { message, mode: "chat" },
  });
const r = await post(
  "Add a seafood dinner in Cascais on day 4, and also delete the Hotel Avenida Palace.",
);
assert(r.status === 200, `real OpenAI chat 200 (${r.status}: ${r.data.error ?? "ok"})`);
assert(
  typeof r.data.reply === "string" && r.data.patch.ops.length >= 1,
  "reply and patch ops returned",
);
assert(
  r.data.patch.ops.some((o) => o.op === "add" && o.dayIndex === 3 && o.status === "ok"),
  "human day 4 maps to dayIndex 3",
);
for (const op of r.data.patch.ops) {
  assert(
    ["add", "remove", "move", "addStop", "removeStop", "reorderStops", "setStopNights"].includes(
      op.op,
    ) && ["ok", "skipped"].includes(op.status),
    "valid annotated operation",
  );
  if (op.op === "add")
    assert(
      Number.isInteger(op.dayIndex) &&
        ["type", "title", "placeQuery", "start", "end", "notes", "estimate", "offerId"].every(
          (k) => k in op.item,
        ),
      "complete add shape",
    );
  if (op.itemId === hotel.id) assert(op.status === "skipped", "booked hotel operation skipped");
}
console.log(r.data.reply, JSON.stringify(r.data.patch.ops, null, 2));
const applied = await j(`/api/patches/${r.data.patch.id}/apply`, { method: "POST" });
assert(applied.status === 200 && applied.data.applied > 0, "accepted patch");
const now = (await j(`/api/trips/${id}`)).data;
assert(
  JSON.stringify(items(now).find((i) => i.id === hotel.id)) === JSON.stringify(hotel),
  "booked hotel byte-identical",
);
assert(items(now).length !== items(dto).length, "item count changed");
assert((await j(`/api/trips/${id}/chat`)).data.messages.length === 2, "two persisted messages");
assert(
  (await j(`/api/patches/${r.data.patch.id}/apply`, { method: "POST" })).status === 409,
  "patch cannot apply twice",
);

const city = await post(
  "Append Coimbra, Portugal as a new final city for one night. Keep all existing items and cities; no other changes.",
);
assert(
  city.status === 200 && city.data.patch.ops.some((o) => o.op === "addStop" && o.status === "ok"),
  "real chat proposes a new city",
);
assert(
  (await j(`/api/patches/${city.data.patch.id}/apply`, { method: "POST" })).status === 200,
  "city patch applied",
);
const expanded = (await j(`/api/trips/${id}`)).data;
assert(
  expanded.stops.length === 3 && expanded.days.length === 7,
  "chat adds third city and derives contiguous days",
);
assert(
  JSON.stringify(items(expanded).find((i) => i.id === hotel.id)) === JSON.stringify(hotel),
  "booking survives city change",
);
const profile = (await j("/api/profile")).data;
await j("/api/profile", { method: "PUT", body: { food: "" } });
const reorder = await post(
  "We're vegetarian on all our trips; remember that preference. Reverse the city order, starting with Coimbra and ending with Lisbon. Keep my booked hotel unchanged.",
);
assert(reorder.status === 200, "real reorder request returns a safe proposal");
const pref = reorder.data.preferenceCandidates.find((p) => p.field === "food");
assert(pref && /vegetarian/i.test(pref.value), "real chat extracts stable vegetarian preference");
assert((await j("/api/profile")).data.food === "", "preference is not auto-saved");
assert(
  (await j("/api/profile", { method: "PUT", body: { food: pref.value } })).status === 200,
  "confirmed preference saved",
);
assert((await j("/api/profile")).data.food === pref.value, "saved preference persisted");
await j("/api/profile", { method: "PUT", body: { food: profile.food } });
assert(
  (await j(`/api/patches/${reorder.data.patch.id}/apply`, { method: "POST" })).status === 200,
  "safe reorder proposal handled",
);
assert(
  JSON.stringify(items((await j(`/api/trips/${id}`)).data).find((i) => i.id === hotel.id)) ===
    JSON.stringify(hotel),
  "booking survives reorder request",
);

const ip = `smoke-limit-${id}`;
for (let i = 0; i < 10; i++)
  assert(
    (
      await j(`/api/trips/${id}/chat`, {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: {},
      })
    ).status === 400,
    `invalid request ${i + 1} → 400 before LLM`,
  );
const limited = await j(`/api/trips/${id}/chat`, {
  method: "POST",
  headers: { "x-forwarded-for": ip },
  body: {},
});
assert(limited.status === 429 && limited.data.retryAfterSec > 0, "11th invalid request → 429");
console.log("STAGE 3 SMOKE PASSED");
