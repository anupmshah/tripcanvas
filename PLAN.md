# TripCanvas — Implementation Plan (for the builder)

Source of truth: `SPEC.md`. This plan picks the simplest architecture that satisfies it.

## 0. Ground rules (read first; these exist because the last project failed)
- **Real app first.** A stage is done only when its smoke script passes against `npm run dev` on real routes, with real external APIs. Mocks are allowed only for the Duffel fallback test.
- **Trust the LLM, then label it.** Zod checks the *shape* of LLM output. If one op is bad (unknown id, touches a booked item), **skip that op with a reason and keep the rest**. Never throw away a whole good result. Every LLM number is stored as `priceSource="estimate"`, and the LLM can never set `live` or `entered`.
- **No speculative abstraction.** Write an interface only where the spec asks for one (PriceProvider). Use plain functions everywhere else. Budget: < 4,000 lines of TS/TSX in `src/`, ≤ 5 test files.
- **If you're stuck after 3 attempts on the same failure,** stop and write it down under "Known gaps" in README. Don't build workarounds on top of workarounds.
- Pin versions: `next@15`, `react@19`, `prisma@6` + `@prisma/client@6` (Prisma 7 requires driver adapters and prisma.config.ts, which adds Windows risk), `react-leaflet@5`, `leaflet@1.9`, `@dnd-kit/core` + `@dnd-kit/sortable`, `zod@3`, `openai@latest`, `tsx`, `vitest`. Use Node 22 LTS (it has global `fetch`).
- Commit after each green stage.

## 1. File structure
```
.env.example  .gitattributes(* text=auto eol=lf)  README.md  PLAN.md  SPEC.md
package.json  tsconfig.json  next.config.ts  eslint.config.mjs  postcss.config.mjs  vitest.config.ts
prisma/schema.prisma  prisma/seed.ts                 # seed.ts calls createDemoTrip()
scripts/smoke-lib.mjs                                # BASE_URL (default http://localhost:3000), assert(), j(), newDemoTrip()
scripts/smoke-stage1.mjs … smoke-stage6.mjs  scripts/smoke-all.mjs
tests/fixtures/duffel-offers.json  tests/fixtures/duffel-error-422.json
tests/patch.test.ts  tests/price-fallback.test.ts  tests/currency.test.ts  tests/price-label.test.ts
src/app/layout.tsx  page.tsx (trip list + new-trip form + "Open demo")  globals.css
src/app/profile/page.tsx
src/app/trip/[id]/page.tsx (server: loads TripDTO → <TripWorkspace/>)   src/app/trip/[id]/print/page.tsx
src/app/share/[token]/page.tsx
src/app/api/**/route.ts                              # see §3
src/components/trip/  TripWorkspace.tsx DayColumns.tsx ItemCard.tsx TravelLeg.tsx MapPanel.tsx(dynamic wrapper)
                      MapView.tsx(leaflet) BudgetPanel.tsx ChatPanel.tsx DiffModal.tsx PreferencePrompt.tsx
                      PriceLabel.tsx BookingLinks.tsx MarkBookedDialog.tsx ItemEditor.tsx PlaceCard.tsx
src/lib/  db.ts env.ts(server-only) dto.ts(getTripDTO) demo.ts rateLimit.ts http.ts(json/error helpers)
src/lib/patch/  schema.ts plan.ts(pure: annotate ops vs trip) apply.ts(transaction)
src/lib/llm/    openai.ts(callJson w/ Zod+retry) prompts.ts chat.ts extract.ts
src/lib/geo/    nominatim.ts travel.ts(haversine + mode speed)
src/lib/info/   wiki.ts weather.ts
src/lib/money/  fx.ts currency.ts totals.ts priceLabel.ts
src/lib/price/  types.ts duffel.ts deeplink.ts fixture.ts index.ts(searchFlightsWithFallback + cache + limiter)
src/lib/links/  deeplinks.ts
src/lib/export/ ics.ts
```

## 2. Prisma schema (SQLite; enums as strings, so no SQLite enum/Json issues; dates as `YYYY-MM-DD` strings to avoid TZ bugs)
```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"  url = env("DATABASE_URL") }   // "file:./dev.db" → prisma/dev.db

model Profile {
  id              String   @id @default("default")    // single user, no auth
  budgetStyle     String   @default("moderate")       // budget|moderate|luxury
  pace            String   @default("balanced")       // relaxed|balanced|packed
  interests       String   @default("")               // comma-separated
  food            String   @default("")
  party           String   @default("2 adults")
  homeAirport     String   @default("BAH")
  dislikes        String   @default("")
  displayCurrency String   @default("BHD")
  updatedAt       DateTime @updatedAt
}
model Trip {
  id             String   @id @default(cuid())
  title          String
  destination    String                // "Lisbon, Portugal"
  destLat        Float?
  destLng        Float?
  originAirport  String                // IATA
  destAirport    String                // IATA
  startDate      String                // YYYY-MM-DD
  endDate        String
  adults         Int      @default(2)
  children       Int      @default(0)
  budgetAmount   Float?
  budgetCurrency String   @default("BHD")
  localCurrency  String   @default("EUR")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  days     Day[]
  items    Item[]
  messages ChatMessage[]
  patches  PendingPatch[]
  shares   ShareLink[]
}
model Day {
  id     String @id @default(cuid())
  tripId String
  index  Int                            // 0-based
  date   String                         // YYYY-MM-DD
  trip   Trip   @relation(fields: [tripId], references: [id], onDelete: Cascade)
  items  Item[]
  @@unique([tripId, index])
}
model Item {
  id             String    @id @default(cuid())
  tripId         String
  dayId          String
  order          Int
  type           String                 // stay|flight|activity|food|transport
  title          String
  placeQuery     String?                // "Torre de Belém, Lisbon, Portugal" (geocode input)
  lat            Float?
  lng            Float?
  geoStatus      String    @default("pending")   // ok|unresolved|pending
  start          String?                // "HH:MM" local
  end            String?
  notes          String?
  status         String    @default("proposed")  // proposed|booked
  price          Float?                 // TOTAL for whole party; for estimates = mid
  priceLow       Float?
  priceHigh      Float?
  currency       String?                // original ISO currency, never overwritten by conversion
  priceSource    String?                // live|estimate|entered; null = unpriced
  priceFetchedAt DateTime?
  provider       String?                // duffel|duffel-test|fixture|llm|user
  offerId        String?
  bookingRef     String?
  sourceUrl      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  day  Day  @relation(fields: [dayId], references: [id], onDelete: Cascade)
  @@index([tripId])
  @@index([dayId, order])
}
model ChatMessage  { id String @id @default(cuid())  tripId String  role String /* user|assistant */  content String  patchId String?  createdAt DateTime @default(now())  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade) }
model PendingPatch { id String @id @default(cuid())  tripId String  opsJson String /* AnnotatedOp[] */  prefsJson String @default("[]")  status String @default("pending") /* pending|applied|rejected */  createdAt DateTime @default(now())  decidedAt DateTime?  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade) }
model ShareLink    { token String @id  tripId String  createdAt DateTime @default(now())  trip Trip @relation(fields: [tripId], references: [id], onDelete: Cascade) }
model GeocodeCache   { key String @id /* normalized query + rounded viewbox */  found Boolean  lat Float?  lng Float?  displayName String?  fetchedAt DateTime @default(now()) }
model PlaceInfoCache { key String @id /* "wikipedia:en:Belém Tower" */  source String  found Boolean  title String?  extract String?  url String?  thumbnailUrl String?  fetchedAt DateTime }
model FxRate         { base String @id /* "USD" */  ratesJson String  rateDate String  fetchedAt DateTime }
model OfferCache     { key String @id /* sha1(origin,dest,dates,pax) */  provider String  offersJson String  fetchedAt DateTime }
```
Write each model on multiple lines as normal Prisma (the one-line form above just saves space). Use `prisma db push`, not migrations.

## 3. Key interfaces (TypeScript)
```ts
// src/lib/patch/schema.ts — nullable rather than optional, so the LLM always emits every key
export const Estimate = z.object({ low: z.number().nonnegative(), mid: z.number().nonnegative(),
  high: z.number().nonnegative(), currency: z.string().length(3) })
  .refine(e => e.low <= e.mid && e.mid <= e.high, "low<=mid<=high");
export const NewItem = z.object({
  type: z.enum(["stay","flight","activity","food","transport"]), title: z.string().min(1).max(120),
  placeQuery: z.string().max(200).nullable(), start: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  end: z.string().regex(/^\d{2}:\d{2}$/).nullable(), notes: z.string().max(500).nullable(),
  estimate: Estimate.nullable(),          // total for party, local currency; stored as priceSource "estimate"
  offerId: z.string().nullable(),         // flights only: must match an offer the server supplied
});
export const PatchOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), dayIndex: z.number().int().min(0), position: z.number().int().min(0).nullable(), item: NewItem }),
  z.object({ op: z.literal("move"), itemId: z.string(), toDayIndex: z.number().int().min(0), position: z.number().int().min(0).nullable() }),
  z.object({ op: z.literal("remove"), itemId: z.string(), reason: z.string().max(200) }),
]);
export const Patch = z.object({ ops: z.array(PatchOp).max(20) });
export const PrefCandidate = z.object({ field: z.enum(["budgetStyle","pace","interests","food","party","homeAirport","dislikes"]),
  value: z.string().max(200), evidence: z.string().max(200) });
export const ChatOutput = z.object({ reply: z.string().max(2000), patch: Patch, preferenceCandidates: z.array(PrefCandidate).max(5) });
export type AnnotatedOp = z.infer<typeof PatchOp> & { status: "ok" | "skipped"; reason?: string;
  geo?: { found: boolean; lat?: number; lng?: number; displayName?: string }; offer?: PriceOffer };
// plan.ts (pure, unit-tested): annotateOps(trip: TripDTO, ops, offers): AnnotatedOp[]
//   move/remove on booked item → skipped "booked items are locked"; unknown itemId/dayIndex → skipped;
//   add with offerId not in offers → offerId dropped, item unpriced (never invent a live price).
// apply.ts: applyPatch(patchId) — in one prisma.$transaction it re-reads item statuses (an item may have
//   been booked since the proposal), re-runs annotateOps, writes, and sets status=applied. Returns {applied, skipped}.

// src/lib/llm/openai.ts — server-only
callJson<T>(schema: z.ZodType<T>, messages: ChatMsg[], opts?: { maxAttempts?: number /*3*/ }): Promise<T>
//  chat.completions.create({ model: env.OPENAI_MODEL, response_format: { type: "json_object" }, messages })
//  Don't set temperature (newer models reject it). On JSON/Zod failure, append the bad output plus
//  "Fix these issues: <zod issues>" and retry. After maxAttempts → throw LlmInvalidOutput (route returns 502).

// src/lib/price/types.ts
export type PriceOffer = { provider: "duffel"|"duffel-test"|"fixture"|"deeplink"; price: number|null; currency: string|null;
  fetchedAt: string; deepLink: string; isLive: boolean; offerId?: string; airline?: { name: string; iata?: string }; summary?: string };
export interface PriceProvider { name: string;
  searchFlights(origin: string, dest: string, dates: { depart: string; return?: string },
                travellers: { adults: number; children: number }): Promise<PriceOffer[]> }
// duffel.ts: DuffelProvider(token). POST https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000
//   headers: Authorization: Bearer <token>, "Duffel-Version": DUFFEL_VERSION (= "v2", a const in duffel.ts),
//   Accept: application/json, Content-Type: application/json.  AbortSignal.timeout(20000).
//   body {data:{slices:[{origin,destination,departure_date},{…return}], passengers:[{type:"adult"}×n, {age:10}×children],
//   cabin_class:"economy", max_connections:1}} → take the 5 cheapest data.offers. Map: price=Number(total_amount),
//   currency=total_currency, airline=owner{name,iata_code}, deepLink=googleFlights(ctx). If the token starts with
//   "duffel_test_", provider="duffel-test" and the UI label says "Live (Duffel TEST mode — not real fares)".
// deeplink.ts: DeepLinkProvider → [{provider:"deeplink", price:null, currency:null, isLive:false, deepLink: googleFlights}, {…skyscanner}]
// fixture.ts: FixtureProvider reads tests/fixtures/duffel-offers.json through the same normalizer (PRICE_PROVIDER=fixture).
// index.ts:
searchFlightsWithFallback(p): Promise<{ offers: PriceOffer[]; source: string; cached: boolean; error?: string }>
//  1) OfferCache hit < 15 min → return it.  2) No token → DeepLink.  3) Global limiter: at most 1 Duffel call every 3 s
//  and 20/hour. Over the limit → DeepLink with error "rate limited".  4) Duffel throws/non-2xx/0 offers → DeepLink
//  with an error message. NEVER throws.

// src/lib/money
type Rates = { base: "USD"; rateDate: string; rates: Record<string, number> };
getRates(): Promise<Rates | null>      // GET https://open.er-api.com/v6/latest/USD, FxRate cache, 12h TTL, stale-if-error; rateDate from time_last_update_utc
convert(amount: number, from: string, to: string, r: Rates): number | null   // amount / r[from] * r[to]; null if unknown
formatMoney(amount: number, ccy: string): string   // Intl.NumberFormat("en-GB",{style:"currency",currency}) (BHD → 3 dp)
priceLabel(src: "live"|"estimate"|"entered"|null, fetchedAt: Date|null, now: Date):
  { text: string; tone: "live"|"stale"|"estimate"|"entered"|"none"; mayHaveChanged: boolean }  // live & age > 30 min → mayHaveChanged
computeTotals(trip: TripWithItems, r: Rates|null, displayCcy: string): { displayCurrency; rateDate: string|null;
  live: number; entered: number; estimate: { low: number; mid: number; high: number }; total: number /* live+entered+estimate.mid */;
  perDay: { index: number; date: string; amount: number }[]; unpricedCount: number; unconvertible: string[];
  budget: number|null; remaining: number|null; overBudget: boolean }

// src/lib/geo/nominatim.ts — server-only
geocode(query: string, near?: { lat: number; lng: number }): Promise<{ found: boolean; lat?: number; lng?: number; displayName?: string; cached: boolean }>
//  GET https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=…[&viewbox=lng-.75,lat+.75,lng+.75,lat-.75&bounded=1]
//  User-Agent: `TripCanvas/0.1 (${env.NOMINATIM_CONTACT})`. Serialize calls through a promise chain stored on globalThis
//  (it survives HMR), ≥1100 ms apart. Check GeocodeCache first and cache misses too (found=false).
// travel.ts: legEstimate(a, b) → { km, minutes, mode: "walk"|"taxi/transit" }: km = haversine × 1.3; walk 4.5 km/h if km<1.5, else 25 km/h. UI text always says "est."

// src/lib/info/wiki.ts — UA header set; PlaceInfoCache TTL 7 days
getPlaceInfo(title: string, source: "wikipedia"|"wikivoyage"): Promise<{ found: boolean; title?: string; extract?: string; url?: string; thumbnailUrl?: string; source: string; fetchedAt: string }>
//  wikipedia: GET https://en.wikipedia.org/w/rest.php/v1/search/title?q=…&limit=1 → key → /api/rest_v1/page/summary/{key}
//  wikivoyage: GET https://en.wikivoyage.org/api/rest_v1/page/summary/{City}   (destination card)
// weather.ts: getForecast(lat, lng, start, end) → { available: true; days: { date; tMax; tMin; precipProb }[]; fetchedAt } | { available: false; reason }
//  https://api.open-meteo.com/v1/forecast?latitude&longitude&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date&end_date
//  Outside the 16-day horizon → available:false, "Forecast appears ~16 days before". Never invent weather.

// src/lib/links/deeplinks.ts — pure. ctx = { destination, city, originIata, destIata, depart, ret, checkIn, checkOut, adults, children, query? }
googleFlights = `https://www.google.com/travel/flights?q=${enc(`Flights from ${o} to ${d} on ${depart} through ${ret} for ${adults} adults`)}`
skyscanner    = `https://www.skyscanner.net/transport/flights/${o.lc}/${d.lc}/${yymmdd(depart)}/${yymmdd(ret)}/?adultsv2=${adults}&cabinclass=economy`
airlineSite(iata?, name)  // small map: GF gulfair.com, TP flytap.com, EK emirates.com, QR qatarairways.com, EY etihad.com,
                          // TK turkishairlines.com, BA, LH, AF, KL, IB, U2, FR; fallback google.com/search?q=<name> official site
bookingCom = `https://www.booking.com/searchresults.html?ss=${enc(title+", "+city)}&checkin=${in}&checkout=${out}&group_adults=${a}&group_children=${c}&no_rooms=1`
airbnb     = `https://www.airbnb.com/s/${enc(destination)}/homes?checkin=${in}&checkout=${out}&adults=${a}&children=${c}`
getYourGuide = `https://www.getyourguide.com/s/?q=${enc(title+" "+city)}&date_from=${date}&date_to=${date}`  // date params best-effort
linksForItem(item, trip): { label: string; url: string }[]
//  flight → GF, Skyscanner, Airline. stay → Booking.com, Airbnb (check-in = item's day date, check-out = trip.endDate).
//  activity → GetYourGuide. food/transport → none.
```

## 4. API routes (all are Node runtime route handlers; keys are read only in `src/lib/env.ts`, which imports `server-only`; no `NEXT_PUBLIC_*` vars)
| Route | Request → Response |
|---|---|
| `GET /api/health` | → `{ok, db:true, env:{openai:bool, duffel:bool, duffelMode:"test"\|"live"\|null}}` (booleans only) |
| `GET/PUT /api/profile` | PUT partial Profile (Zod) → Profile |
| `GET/POST /api/trips` | POST `{title,destination,originAirport,destAirport,startDate,endDate,adults,children,budgetAmount?,localCurrency}` → creates Days, geocodes destination → `{id}` |
| `POST /api/dev/demo` | dev only (404 in production) → `{id}`: a fresh demo trip, so smoke runs stay idempotent |
| `GET/PATCH /api/trips/[id]` | GET → `TripDTO = {trip, days[{…, items[ItemDTO & {links, label}]}], totals, rates:{rateDate}\|null}`; PATCH `{title?, budgetAmount?, budgetCurrency?}` |
| `POST /api/trips/[id]/items` | `{dayIndex,type,title,placeQuery?,start?,end?,notes?}` → geocodes → ItemDTO |
| `PATCH /api/items/[id]` | `{title?,notes?,start?,end?,entered?:{amount,currency}}` → booked items: 409 except notes |
| `DELETE /api/items/[id]` | → 204; 409 if booked |
| `POST /api/trips/[id]/layout` | DnD: `{days:[{dayId, itemIds[]}]}` → 200; 409 if a booked item would change day |
| `GET /api/geocode?q=&tripId=` | → `{found,lat,lng,displayName,cached}` |
| `GET /api/place-info?title=&source=` | → PlaceInfo |
| `GET /api/weather?tripId=` | → forecast union |
| `GET /api/fx?to=BHD` | → `{rateDate, base, rates:{EUR,USD,GBP,…→to}}` or 503 `{error}` |
| `GET/POST /api/trips/[id]/chat` | GET → messages. POST `{message (1..2000), mode:"chat"\|"regenerate"}` → `{reply, patch:{id, ops:AnnotatedOp[]}, preferenceCandidates[]}`. Rate limited (`CHAT_RATE_LIMIT_PER_MIN`, default 10/IP) **before** body validation → 429 `{retryAfterSec}`. 502 on LLM invalid after retries |
| `POST /api/patches/[id]/apply` · `/reject` | → `{applied:n, skipped:[{index,reason}]}` / `{ok}`; 409 if not pending |
| `GET /api/trips/[id]/flights` | → `{offers:PriceOffer[], source, cached, error?}` (never 500 because of a provider) |
| `POST /api/items/[id]/book` | `{bookingRef, price, currency}` → status=booked, priceSource=entered, provider=user |
| `POST /api/items/[id]/extract-confirmation` | `{text ≤ 8000}` → `{bookingRef,price,currency,date,start,end,notes}` (all nullable). Only pre-fills the form; **never saves** |
| `POST /api/trips/[id]/share` | → `{token, url:"/share/<token>"}` |
| `GET /api/trips/[id]/ics` | → `text/calendar` attachment, one VEVENT per item (all-day if no time) |

**Chat route flow:**
1. Rate-limit and validate the request.
2. Load the profile, the TripDTO (with totals), and the last 10 messages.
3. If the trip has no flight item, call `searchFlightsWithFallback` and pass the top 3 offers with their offerIds. *Generation order:* the prompt says "pick flights from the live offers first, then stay + activities within remaining = budget − flights".
4. Call `callJson(ChatOutput)`.
5. Run `annotateOps` on the result.
6. Geocode each ok add (`placeQuery ?? title + ", " + destination`, biased to the destination's viewbox). Unresolved adds are **flagged**, not dropped: they get `geoStatus=unresolved`, an amber badge, and no map pin.
7. Save the PendingPatch and both ChatMessages, then respond.

**Prompt rules** (`prompts.ts`):
- JSON only, in the exact example shape.
- Never move or remove items where `status=booked`.
- Estimates are low/mid/high totals for the whole party in `trip.localCurrency`, scaled to `profile.budgetStyle`.
- Never state opening hours, availability, or flight prices. Flights get a price only via an offerId.
- If `totals.overBudget`, propose cheaper swaps (a remove plus an add).
- `mode=regenerate` means: remove and replace *proposed* items only.
- `preferenceCandidates` lists only stable preferences the user stated that differ from the profile.

## 5. UI (`/trip/[id]`, desktop-first; one client root `TripWorkspace` holds the TripDTO and calls `reload()` after every mutation — no state library)
```
┌ Header: title · dates · 2 adults · Budget 1,500.000 BHD │ [Regenerate proposed] [Share] [Export PDF] [.ics] ┐
├ Chat (w-80) ┬ Day columns (horizontal scroll, w-72 each) ─────────┬ Map (sticky, h-[55vh]) ───────────────┤
│ messages     │ Day 1 · Thu 29 Oct · 21°/15° 🌧20%               │ numbered divIcon pins, colour per day,  │
│ pref prompt  │  [ItemCard] → TravelLeg "1.2 km · ~16 min walk   │ polyline per day, click pin → card      │
│ input+send   │   (est.)" → [ItemCard] …   [+ Add item]          │ "© OpenStreetMap contributors"          │
│ spinner/err  │                                                   ├ Budget panel ───────────────────────────┤
│              │                                                   │ Live │ Estimate (low–mid–high) │ Entered │
│              │                                                   │ per-day bars · over-budget red banner  │
│              │                                                   │ "1 EUR = 0.4105 BHD · rates 2026-10-19,│
│              │                                                   │  open.er-api.com" · N unpriced         │
└──────────────┴───────────────────────────────────────────────────┴─────────────────────────────────────────┘
```
- **ItemCard.** Type icon, title, time, PriceLabel, BookingLinks (open with `target=_blank rel=noopener`), [Mark as booked], [Details → PlaceCard drawer: Wikipedia extract, thumbnail, "Source: Wikipedia · fetched 2026-10-19" link].
  - **Proposed:** dashed sky border and a "Proposed" badge; draggable.
  - **Booked:** solid emerald border, "Booked · ref ABC123" badge and a 🔒 icon; not draggable and no delete.
  - **Unresolved:** amber "Location not verified on OSM" badge.
- **PriceLabel.** Shows the price in the original currency plus "≈ X BHD".
  - Chips: `Live · 14:05` (green), `Live · may have changed` (amber, when older than 30 min), `Estimate · €40–90` (violet, with an "AI estimate" tooltip), `Entered · 19 Oct` (slate), `No price — check on provider` (grey).
  - Duffel test mode adds "TEST fares" to the label.
- **DnD.** `<DndContext id="trip-dnd">` (a stable id avoids a hydration mismatch). Each column is a SortableContext. On drag end, optimistically reorder, then POST /layout; on 409, revert with a toast.
- **DiffModal.** Opens after each chat reply that has ops.
  - `+ add` (green) shows the day, the estimate range, and geo status.
  - `→ move` (blue) shows "Day 2 → Day 3".
  - `− remove` (red).
  - `skipped` (grey) shows its reason.
  - Buttons: [Accept all ok ops] [Reject].
- **PreferencePrompt.** An inline card in the chat: a checkbox per candidate ("Pace → relaxed — you said 'we hate early starts'"), with [Save selected] (PUT /api/profile) and [Not now].
- **MarkBookedDialog.** Fields: ref, final price, currency (defaults to the item currency), plus a "Paste confirmation" textarea with an [Extract] button that pre-fills the fields; the user reviews and then saves.
- **Flights.** A "Flight offers" section above the columns lists offers from `/flights`: an [Add to Day 1] button adds a live-priced flight; deeplink-only offers show "Check price on provider".
- **Loading and error states.** Every fetch has a spinner/skeleton and an inline error with [Retry]. External failures degrade instead of breaking: no pin, "Info unavailable", "Rates unavailable — totals per currency".
- **`/profile`** is a plain form. **`/share/[token]`** and **`/trip/[id]/print`** render a server-only `ReadOnlyItinerary` (no chat, DnD, or buttons). The print page has print CSS and calls `window.print()` on load. That's the "Export PDF" button (browser "Save as PDF").

## 6. Seeded demo trip (`src/lib/demo.ts`; dates are dynamic: start = today + 10 days, so the weather forecast and Duffel both work)
"Lisbon long weekend". BAH→LIS, 5 days, 2 adults, budget 1,500 BHD, local currency EUR, profile displayCurrency BHD. Seeded coordinates are pre-filled with geoStatus=ok, and smoke 2 re-verifies them against live Nominatim. Estimates are labelled `estimate` (provider "llm-seed").

| Day | Items (type · title · placeQuery → approx lat,lng · price) |
|---|---|
| 1 | flight · Bahrain → Lisbon · "Lisbon Airport, Portugal" 38.7742,-9.1342 · unpriced ▸ **stay · Hotel Avenida Palace (BOOKED, ref DEMO-4821, 620 EUR entered)** · "Hotel Avenida Palace, Lisbon" 38.7149,-9.1413 ▸ food · Time Out Market dinner · "Time Out Market Lisboa" 38.7069,-9.1459 · 40/60/90 |
| 2 | activity · Belém Tower · "Torre de Belém, Lisbon" 38.6916,-9.2160 · 20/24/30 ▸ activity · Jerónimos Monastery · "Mosteiro dos Jerónimos, Lisbon" 38.6979,-9.2068 · 20/24/30 ▸ food · Pastéis de Belém · "Pastéis de Belém, Lisbon" 38.6975,-9.2032 · 8/12/18 ▸ activity · MAAT · "MAAT, Lisbon" 38.6957,-9.1941 · 20/22/30 |
| 3 | activity · São Jorge Castle · "Castelo de São Jorge, Lisbon" 38.7139,-9.1335 · 30/30/36 ▸ activity · Miradouro de Santa Luzia · "Miradouro de Santa Luzia, Lisbon" 38.7118,-9.1302 · 0/0/0 ▸ activity · Fado Museum · "Museu do Fado, Lisbon" 38.7106,-9.1281 · 10/12/16 |
| 4 | transport · Train to Sintra · "Estação do Rossio, Lisbon" 38.7141,-9.1410 · 8/10/14 ▸ activity · Pena Palace · "Palácio Nacional da Pena, Sintra" 38.7876,-9.3906 · 40/45/60 ▸ activity · Quinta da Regaleira · "Quinta da Regaleira, Sintra" 38.7963,-9.3961 · 30/30/40 |
| 5 | activity · Oceanário · "Oceanário de Lisboa" 38.7636,-9.0937 · 50/56/64 ▸ flight · Lisbon → Bahrain · "Bahrain International Airport" 26.2708,50.6336 · unpriced |

`prisma/seed.ts` upserts the default Profile (BHD) and calls `createDemoTrip(prisma)`; `package.json` has `"prisma":{"seed":"tsx prisma/seed.ts"}`.

## 7. Stages
Every stage gate runs with `npm run dev` in another terminal:
`npm run lint && npm run typecheck && npm test && node scripts/smoke-stageN.mjs`, plus **all earlier smoke scripts** (regression), plus the manual browser checks listed. Smoke scripts use `fetch` against `BASE_URL`, each creates its own trip via `POST /api/dev/demo`, and they exit 1 on the first failed assert with a clear message.

Scripts:
- `dev`: `next dev`
- `build`, `start`
- `lint`: `eslint .` (works on Next 15 and 16)
- `typecheck`: `tsc --noEmit`
- `test`: `vitest run --passWithNoTests`
- `db:push`: `prisma db push`
- `db:seed`: `prisma db seed`
- `smoke`: `node scripts/smoke-all.mjs`

**Stage 1 — Scaffold + data model.**
- *Deliverables:* create-next-app (TS, Tailwind, App Router, src/, eslint), the pinned deps, `.env.example`, `.gitattributes`, the Prisma schema, `db.ts` (globalThis singleton), `env.ts`, `demo.ts` and seed, the `health` / `profile` / `trips` / `trips/[id]` (GET) / `dev/demo` routes, the home page (trip list + create form + profile link), the `/profile` form, and a minimal `/trip/[id]` that lists days and items (server-rendered). README skeleton.
- *Smoke 1:*
  - health ok, and db true.
  - Profile has displayCurrency `BHD`.
  - The demo trip has 5 days and 15 items, exactly 1 of them booked.
  - `GET /trip/<id>` returns 200 and the HTML contains "Belém Tower".
  - A POST to `/api/trips` creates the right number of days.
  - `git check-ignore .env` succeeds (via `child_process`).

**Stage 2 — Editor + map.**
- *Deliverables:* `nominatim.ts` (queue + cache + UA), `travel.ts`, `wiki.ts`, `weather.ts`; the `geocode`, `place-info`, `weather`, `layout`, item POST/PATCH/DELETE routes; TripWorkspace, DayColumns (dnd-kit), ItemCard (proposed/booked/unresolved styles), TravelLeg, MapPanel/MapView, PlaceCard, ItemEditor; the destination Wikivoyage card in the header; weather in the day headers.
- *Smoke 2:*
  - Every seeded placeQuery returns found:true from `/api/geocode`, within 3 km of the seed coords. Log the timing: uncached calls must take ≥ 1 s each, and the second pass must be all `cached:true` and fast.
  - `place-info?title=Belém Tower&source=wikipedia` returns found, an extract, a `wikipedia.org` url, and fetchedAt; `source=wikivoyage&title=Lisbon` returns found.
  - Weather returns available:true with 5 days.
  - `layout` moving a proposed item from day 2 to day 3 → 200 and it is reflected in the GET; moving the booked hotel → 409.
  - DELETE on the booked item → 409.
  - Adding the item "Zzzxqy Nonexistent Place" → geoStatus `unresolved`.
- *Manual:* the map renders pins 1..n per day with no console errors; a drag between days survives a refresh; the place card opens.

**Stage 3 — Chat patches + preference memory + verification.**
- *Deliverables:* `patch/schema|plan|apply`, `llm/openai|prompts|chat`, `rateLimit.ts`, the chat GET/POST and patch apply/reject routes, ChatPanel, DiffModal, PreferencePrompt, and the Regenerate button (mode=regenerate).
- *Tests:* `tests/patch.test.ts`
  - The schema accepts valid ops and rejects bad ones (low>mid, unknown op, missing keys).
  - `annotateOps` skips move/remove on a booked item but keeps the other ops; unknown ids are skipped; an unknown offerId is stripped.
  - `applyPatch` logic leaves the booked item byte-identical (tested on the pure plan output).
- *Smoke 3:*
  1. Make **one REAL OpenAI call** on a fresh demo trip: `"Add a seafood dinner in Cascais on day 4, and also delete the Hotel Avenida Palace."`
  2. Assert 200, a `reply` string, ≥ 1 op, and that every op re-parses with PatchOp (copy the Zod shape into the script or check the shape by hand).
  3. Assert that any op whose itemId is the hotel is `skipped`.
  4. Apply the patch, then check the hotel fields are deep-equal to before, the item count changed, and chat GET has +2 messages.
  5. Send 10 POSTs with an empty body (400, no LLM cost); the 11th → 429.
  6. Print the reply and the ops so a human can eyeball them.
- *Manual:* the chat → diff → accept flow updates the columns and map; a preference prompt appears for "we're vegetarian"; Save updates /profile.

**Stage 4 — Costs + Duffel.**
- *Deliverables:* `money/*`, `price/*`, the `fx` and `flights` routes, the item `entered` PATCH, `computeTotals` in the DTO, BudgetPanel, PriceLabel, the flight offers section, the add-flight-from-offer path (server copies price/currency/fetchedAt from OfferCache by offerId and sets priceSource live), and offers + totals + remaining budget passed into the chat prompt.
- *Tests:*
  - `price-fallback.test.ts` (mocks `fetch` with `vi.spyOn(globalThis,"fetch")`): no token → deeplink; 500 → deeplink plus error; fixture 422 → deeplink; network throw → deeplink; abort/timeout → deeplink; success fixture → normalized offers with isLive:true and Number prices; nothing throws; a second call within 15 min is served from the cache (mock the db cache through a small injected `cache` param, or run against the test SQLite).
  - `currency.test.ts`: EUR→BHD and BHD→EUR round-trip; unknown currency → null; BHD formats with 3 dp.
  - `price-label.test.ts`: live at 29 min is fine; live at 31 min → mayHaveChanged; an estimate is never tone live.
- *Smoke 4:*
  - `/api/fx?to=BHD` → rateDate set; EUR→BHD is between 0.3 and 0.5.
  - The DTO totals have live/estimate/entered, displayCurrency BHD, and entered ≈ 620 EUR converted.
  - `/flights` returns 200 twice, with `cached:true` the second time. With a Duffel token: offers carry numeric prices and isLive. Without one: source deeplink and price null. **Real call**, never a 500.
  - PATCH an item's entered price → its label source is `entered`.
  - PATCH the budget to 1 → overBudget true; then restore it.
- *Manual:* labels and timestamps show; the "may have changed" chip appears after 30 min (or with a temporarily backdated priceFetchedAt in SQLite).

**Stage 5 — Booking links + mark booked + paste extraction.**
- *Deliverables:* `links/deeplinks.ts`, `links` in ItemDTO, BookingLinks, the `book` and `extract-confirmation` routes (`llm/extract.ts` via callJson), MarkBookedDialog.
- *Smoke 5:*
  - Every flight/stay/activity item in the DTO has ≥ 1 link. Each URL parses with `new URL`, has an https host from the allowed list, and contains the trip dates (Skyscanner uses yymmdd) and `2` adults where applicable.
  - Book a proposed activity with `{bookingRef:"SMK-1", price:25.5, currency:"EUR"}` → status booked, source entered; DELETE → 409; layout move to another day → 409.
  - Make a **real** extract call with a sample confirmation text (provider email: "Booking reference: QX7P2L … Total paid: EUR 245.50 … 14:30") → bookingRef `QX7P2L`, price 245.5, currency EUR; the item is unchanged in the DB.
- *Manual:* every button opens a new tab with prefilled search fields.

**Stage 6 — Share + export + polish.**
- *Deliverables:* the `share` route and `/share/[token]`, `export/ics.ts` and the `ics` route, the `/trip/[id]/print` page, a pass over loading/error states, and the full README (Windows setup, env vars, attribution: OSM/Nominatim, Wikipedia/Wikivoyage CC BY-SA, Open-Meteo, "Rates by Exchange Rate API") with a **"Known gaps / incomplete"** section that is honest.
- *Smoke 6:*
  - Share → `/share/<token>` returns 200, contains the trip title, and does NOT contain "Mark as booked" or the chat textarea; `/share/bogus` → 404.
  - The ics response has content-type `text/calendar`, starts with `BEGIN:VCALENDAR`, uses CRLF line endings, and has a VEVENT count equal to the item count.
  - The print page returns 200.
- *Final gate:* `npm run build` succeeds. Then scan `.next/static/**` for the literal values of OPENAI_API_KEY and DUFFEL_ACCESS_TOKEN read from `.env` — there must be 0 hits. Run `npm run smoke` (all stages) green.

## 8. Windows risks / gotchas
- **Prisma:** `prisma generate` fails with `EPERM … query_engine-windows.dll.node` while `next dev` is running. Stop the dev server first. Keep `DATABASE_URL="file:./dev.db"` (relative to `prisma/`). Stay on Prisma 6. The existing `.env` has the user's keys, so **append** `DATABASE_URL` if it's missing; never overwrite or print it.
- **Leaflet SSR:** `window is not defined`. `MapPanel.tsx` is `"use client"` and calls `dynamic(() => import("./MapView"), { ssr: false })`; Next 15 forbids `ssr:false` in Server Components. Import `leaflet/dist/leaflet.css` in MapView. Use `L.divIcon` numbered pins, which also avoids broken default marker PNG paths. Fit bounds when items change. Give `MapContainer` a stable `key` to dodge "Map container is already initialized" under StrictMode.
- **dnd-kit:** set a stable `DndContext id` to avoid aria-describedby hydration warnings. Don't render DnD in share/print.
- **npm scripts:** no `VAR=x cmd`, `rm -rf`, `cp`, or single-quoted globs. Put logic in `.mjs` scripts. `&&` is fine. If PowerShell blocks `npm.ps1`, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or use `npm.cmd`.
- **Port 3000 busy:** find the owner with `netstat -ano | findstr :3000` and run `taskkill /PID <pid> /F`, or use `npm run dev -- -p 3001` with `$env:BASE_URL="http://localhost:3001"` for the smoke scripts.
- **The project lives under Documents (possibly OneDrive-synced),** which can lock `.next`/`node_modules` and cause EBUSY. Pause sync or exclude those folders. Don't delete `dev.db` while the server runs; use `POST /api/dev/demo` instead of resets.
- **Line endings:** CRLF can corrupt `.ics` assertions and shell shebangs. Use `.gitattributes eol=lf` and build ICS lines explicitly with `\r\n`.
- **In-memory state** (rate limiter, Nominatim queue) must live on `globalThis` so HMR doesn't reset or duplicate it.

## 9. Explicit non-goals (do NOT build)
- Auth, multi-user, real-time collaboration, or mobile/responsive polish beyond "doesn't break".
- Live prices for hotels, activities, or food (estimates only); scraping of any kind; Google Places, Booking, Expedia, or Skyscanner APIs.
- In-app booking or payments, or booking through Duffel orders (offer search only).
- Server-side PDF libraries (the print page is the PDF export), migrations, i18n, or editing trip dates after creation.
- Per-op diff selection, undo history, streaming chat, LLM function calling or agents, vector memory.
- Playwright/E2E frameworks, more than 5 unit test files, mocking Nominatim/Wikipedia/OpenAI in tests, or a validation layer beyond §3.
- Background jobs, deployment configs, Docker, analytics.
- Weather beyond the 16-day forecast, airport autocomplete (the user types IATA codes), or historical price charts.

## 10. AMENDMENT — Multi-city is REQUIRED (user decision, supersedes anything above)
A trip covers one or more cities in order (e.g. New York → Washington → Orlando). Build this from Stage 1; do not retrofit later.

Schema changes:
- New model `Stop { id, tripId, order Int, city String, country String, lat Float?, lng Float?, airport String? /*IATA*/, localCurrency String, startDate String, endDate String /*YYYY-MM-DD, nights = end-start*/ }`, `@@unique([tripId, order])`, cascade on trip delete.
- `Trip.destination` becomes a display label ("USA: New York → Orlando"); drop `destLat/destLng/destAirport/localCurrency` from Trip (they live on Stop). Keep `originAirport` (home).
- `Day` gets `stopId` (the city you sleep in that night; travel days belong to the arriving stop). Generated from stops' date ranges, contiguous, no gaps/overlaps.
- `Item` keeps `dayId`; geocoding uses the day's stop city/country as context (Nominatim `countrycodes` + viewbox around the stop).

Behaviour:
- Trip creation form: add/remove/reorder cities with nights each; nights must sum to trip length.
- Chat patch ops add `addStop`, `removeStop` (only if it has no booked items), `reorderStops`, `setStopNights`; days are re-derived and proposed items on removed days are dropped; booked items are never touched — a stop op that would orphan or move a booked item is skipped with a reason.
- Flights: `searchFlights` per leg — home→first city, each inter-city leg the LLM/user marks as `flight` (others become a `transport` item: train/bus/car with estimate), last city→home. Generation order per spec §11 applies across all legs.
- Estimates (stay/food/activities/local transport) are per stop in that stop's local currency.
- Deep links per stop/leg (hotel links use that city + its dates).
- Map: all stops shown; pins numbered per day and coloured per city; inter-city legs drawn as dashed lines.
- Budget view also groups totals per city.
- Seeded demo trip: Bahrain → Lisbon (3 nights) → Porto (2 nights), 2 adults, BHD 1,500, train Lisbon→Porto, one booked hotel in Lisbon.
- Smoke tests must cover: creating a 3-city trip, chat adding a city, booked item surviving a stop reorder.

## 11. AMENDMENT — Free-text start is the PRIMARY entry point (user decision)
The home page leads with one large text box: "Describe your trip". Example the user gave, which must work end to end:
"Plan a USA trip for 2 adults and 1 kid for 15 days anytime between 15th December till 5th January. This is a first time to the USA and we are vegetarians."

Flow (server route POST /api/trips/from-text, OpenAI + Zod, retried on invalid output):
1. Extract a TripDraft: origin (default Profile.homeAirport), destination country/region, travellers (adults, children + ages if given), length in days, date WINDOW (earliest/latest) vs fixed dates, budget (optional, in display currency), interests, food (e.g. vegetarian), pace, first-visit flag, anything else as notes.
2. Ask only for what is truly missing and blocks planning (show 1–3 short questions inline); everything else gets a sensible default the user can see and edit. If a window is given, the LLM picks concrete start/end dates inside it (say why: e.g. avoid Christmas price peaks / fit 15 days) — editable.
3. Propose a multi-city route (cities in order + nights each + transport between, sized to trip length and party; e.g. first-time family USA 15 days → 3–4 cities with logical geography and season). Show it as an editable card; user can edit fields or type a change ("swap DC for Chicago", "fewer cities") which re-proposes before anything is created.
4. On accept: create Trip + Stops + Days, then generate the first itinerary via the existing chat-patch pipeline (spec §11 order: flights per leg first via PriceProvider, then stays, then activities/food within remaining budget; estimates labelled), geocode-verify every stop, and open the trip editor.
5. Stable preferences found in the text (vegetarian, kid age, first-time visitor) go through the existing preference-confirm prompt to save to Profile; vegetarian must also steer food items.
The old manual "create trip" form stays as a secondary "enter details manually" option.
Smoke test: POST the exact example text → trip with ≥3 US cities, dates inside 15 Dec–5 Jan totalling 15 days, 3 travellers, vegetarian food items, every full day has ≥1 named activity, every priced item labelled.
