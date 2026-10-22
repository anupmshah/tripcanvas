import { assert, j, items, newDemoTrip, setStage } from "./smoke-lib.mjs";
setStage("stage 4: real FX, honest totals, flight fallback");
const fx = await j("/api/fx?to=BHD");
assert(
  fx.status === 200 && fx.data.rateDate && fx.data.rates.EUR > 0.3 && fx.data.rates.EUR < 0.5,
  "real dated EUR → BHD rate",
);
const { id, dto } = await newDemoTrip();
assert(
  dto.totals.displayCurrency === "BHD" && dto.totals.estimate.mid > 0 && dto.totals.live === 0,
  "totals split estimate/live in BHD",
);
assert(
  Math.abs(dto.totals.entered - 620 * fx.data.rates.EUR) < 0.1,
  "620 EUR entered hotel converted",
);
assert(
  dto.totals.perCity.length === 2 && dto.totals.perDay.length === 6,
  "totals group by city and day",
);
const a = await j(`/api/trips/${id}/flights`),
  b = await j(`/api/trips/${id}/flights`);
assert(
  a.status === 200 && b.status === 200 && b.data.cached,
  "flight search returns 200; second call cached",
);
assert(
  a.data.legs.length === 3 && a.data.legs[0].origin === "BAH" && a.data.legs.at(-1).dest === "BAH",
  "outbound, optional intercity and return legs",
);
const health = (await j("/api/health")).data;
if (!health.env.duffel)
  assert(
    a.data.source === "deeplink" && a.data.offers.every((o) => o.price === null && !o.isLive),
    "no Duffel token → unpriced deep links",
  );
else assert(a.data.offers.length > 0, "Duffel or safe fallback offers returned");
const editable = items(dto).find((i) => i.status === "proposed" && i.price != null);
const entered = await j(`/api/items/${editable.id}`, {
  method: "PATCH",
  body: { entered: { amount: 25.5, currency: "EUR" } },
});
assert(
  entered.status === 200 && entered.data.priceSource === "entered",
  "user price overrides estimate as Entered",
);
const now = (await j(`/api/trips/${id}`)).data;
assert(
  items(now).find((i) => i.id === editable.id).label.tone === "entered",
  "DTO has honest Entered price label",
);
const cheap = await j(`/api/trips/${id}`, { method: "PATCH", body: { budgetAmount: 1 } });
assert(
  cheap.status === 200 && cheap.data.totals.overBudget && cheap.data.totals.remaining < 0,
  "budget 1 triggers over-budget warning",
);
assert(
  (await j(`/api/trips/${id}`, { method: "PATCH", body: { budgetAmount: 1500 } })).data.totals
    .overBudget === false,
  "budget restored",
);
assert(
  (
    await j(`/api/trips/${id}/items`, {
      method: "POST",
      body: {
        dayIndex: 0,
        type: "flight",
        title: "Invented fare",
        offerId: "fake",
        legId: "outbound",
      },
    })
  ).status === 400,
  "cannot invent a live offer",
);
console.log("STAGE 4 SMOKE PASSED");
