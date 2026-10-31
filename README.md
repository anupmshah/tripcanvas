# TripCanvas

Describe a trip, review an editable multi-city route, then generate an itinerary. Chat proposes changes for review; booked items stay locked. Next.js 15, React 19, Prisma 6, Neon Postgres, Leaflet/OpenStreetMap and dnd-kit. Windows, npm, Node 22 LTS.

## Install with Claude Code (easiest)

TripCanvas runs on your own computer with your own keys. In Claude Code:

```
/plugin marketplace add anupmshah/tripcanvas
/plugin install tripcanvas@tripcanvas
/tripcanvas:start
```

Claude clones the app, opens `.env` for you to fill in, checks your credentials with `npm run check-env` (without printing them), creates the database tables and starts the app. You need Node 20.6+, git, an OpenAI API key with billing credit, and a Postgres database (a free [Neon](https://neon.tech) project works). A Duffel token for live fares is optional. Never paste keys into chat.

TripCanvas has no login: it is a single-user app for your own machine. Do not expose it to the internet.

## Manual setup

Preserve an existing `.env`. For a new installation, copy `.env.example` to `.env` and fill its server-only settings. `OPENAI_API_KEY` uses `gpt-4.1`; `DUFFEL_ACCESS_TOKEN` is optional. Missing Duffel credentials keep Google Flights/Skyscanner links and use cached, labelled AI flight estimates (USD per adult/child/lap infant, multiplied by the party and converted for display). Live Duffel offers take precedence over estimates; editing a price saves Entered. Never commit credentials.

```powershell
npm install
npx prisma generate
npm run check-env
npm run db:push
npm run db:seed
npm run dev
```

Both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) must select `schema=tripcanvas`. Only that schema belongs to this app. Do not reset the database or alter other schemas. Stop the dev server before Prisma generation on Windows to avoid the query-engine DLL lock.

Open http://localhost:3000. If another local service owns IPv4 port 3000, use `npm run dev -- --hostname ::1 --port 3000`; localhost and http://[::1]:3000 reach this app. Set a useful `NOMINATIM_CONTACT` in `.env`.

## Try it

Start with: “Plan a USA trip for 2 adults and 1 kid for 15 days anytime between 15th December till 5th January. This is a first time to the USA and we are vegetarians.” Review dates, airports, party, budget and route; edit fields or type a revision. Only missing destination, duration or usable dates block creation. Home airport defaults from the profile. Manual creation remains available.

Accepting the route creates the trip and generates flights, stays, one activity per full day and vegetarian food choices. Locations try Nominatim by full name/city/country, then a bounded name search, then a relevant Wikipedia/Wikivoyage article. Flags remain only when no source resolves. Flagged items have Verify again (bypasses negative caches); Nominatim remains cached and throttled to one request/second. Wiki-only matches have no invented map coordinates. Generation failures preserve the trip and original request for retry. Stable preferences save only after confirmation.

Open the Lisbon → Porto demo for a populated example. Chat shows a diff with accept/reject. Drag proposed items between days, edit prices, and mark an item booked with its final price/reference. Booking happens on external sites. Pasting a confirmation only prefills the booking form; review it before saving. Booked items allow notes, but cannot be moved to another day or deleted.

Costs retain their original currency, source and timestamp. Display conversion uses cached daily FX rates. Live fares older than 30 minutes are flagged on reload. Budget totals exclude unpriced items and unplanned expenses; rates unavailable means a partial converted total. All estimates need checking with the provider. Stay prices are saved as full-stay totals: nightly rate × nights. Cards show that calculation; the daily chart spreads the total evenly across occupied nights without counting it twice in city totals. Editing a stay price accepts the nightly rate; booking accepts the final total paid. Empty days show zero.

Share creates a read-only presentation without booking references or chat. Notes are included: review them before sharing. This is a trusted single-user app without authentication; sharing is not an access-control boundary. Calendar exports use local floating times, without timezone IDs. PDF export opens the browser print dialog; choose Save as PDF.

## Verification

```powershell
npm run lint
npx tsc --noEmit
npm test
npm run smoke
node scripts/http-e2e.mjs
```

Smoke scripts 1–6 include 4b and call the running server (default `http://localhost:3000`, override `BASE_URL`). They use real OpenAI, geocoding, wiki, weather and FX calls; only Duffel uses fixtures in unit tests. Smoke/E2E runs create persistent test trips. There are five unit-test files.

With dev stopped, run `npm run build`, then `node scripts/check-client-secrets.mjs`. The scan checks browser bundles for configured secret values without printing them.

## Sources

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), geocoding via Nominatim (cached, at most one request/second). Place summaries from Wikipedia/Wikivoyage (CC BY-SA, with article links and fetch dates). City cards try Wikivoyage, then Wikipedia, then a cached, clearly labelled AI summary. City lookups strip country qualifiers and handle common aliases (New York → New York City); Wikipedia title search is the final public-source fallback. Weather from Open-Meteo. [Rates by Exchange Rate API](https://www.exchangerate-api.com). Links open the original booking sites; the app does not scrape them.

## Known limits

- No real Duffel credentials were available. Test fares are explicitly labelled; live inventory/checkout is unverified.
- AI route quality, estimates, hours and availability require review. Initial itineraries are compact and patches allow at most 60 operations; long trips may need follow-up chat.
- Child flight searches currently use age 10; extracted child ages can inform the plan and confirmed preferences but are not passed to Duffel. No payments, authentication, collaborative editing or deployment is included.
- Share links have no expiry/revoke UI. Calendar times have no timezone conversion. PDF output uses browser printing, not a server PDF service.
- Browser automation was unavailable in this environment. HTTP checks cover the workflows; native drag gestures, clipboard permissions and printed visual layout remain unverified.
- npm reports 10 dependency audit findings (1 moderate, 9 high). Breaking upgrades were not applied to the pinned stack.

## Formatting and size

`npm run format` formats src, tests and scripts with Prettier at width 100. `npm run lint` first runs `format:check`. Count formatted non-blank lines, not packed source lines.

After the four fixes, the trim reduced TS/TSX from 6,282 to 6,238 lines (API 682, lib 2,627, components 2,767, pages 162). CSS adds 31 lines. Backend is 3,309, above the 3,000 target; total remains above 6,000. This pass removed safe duplication without removing features. Further reduction needs a broader design pass, not code packing or moving code outside the measured directories.

Largest remaining files:

| File | Non-blank lines | Reason retained |
| --- | ---: | --- |
| `src/components/FreeTextStart.tsx` | 419 | Required draft fields, route editing and typed revisions. |
| `src/components/trip/DayColumns.tsx` | 276 | Drag-and-drop state, day columns and manual item creation. |
| `src/lib/patch/plan.ts` | 238 | City/day simulation and booked-item invariants. |
| `src/lib/demo.ts` | 225 | Named demo places, coordinates and labelled seed prices. |
| `src/components/NewTripForm.tsx` | 219 | Required secondary manual multi-city creation. |
