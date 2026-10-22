# TripCanvas

Describe a trip, review an editable multi-city route, then generate an itinerary. Chat proposes changes for review; booked items stay locked. Next.js 15, React 19, Prisma 6, Neon Postgres, Leaflet/OpenStreetMap and dnd-kit. Windows, npm, Node 22 LTS.

## Windows setup

Preserve an existing `.env`. For a new installation, copy `.env.example` to `.env` and fill its server-only settings. `OPENAI_API_KEY` uses `gpt-4.1`; `DUFFEL_ACCESS_TOKEN` is optional. Missing Duffel credentials keep Google Flights/Skyscanner links and use cached, labelled AI flight estimates (USD per adult/child/lap infant, multiplied by the party and converted for display). Live Duffel offers take precedence over estimates; editing a price saves Entered. Never commit credentials.

```powershell
npm install
npx prisma generate
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

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), geocoding via Nominatim (cached, at most one request/second). Place summaries from Wikipedia/Wikivoyage (CC BY-SA, with article links and fetch dates). Weather from Open-Meteo. [Rates by Exchange Rate API](https://www.exchangerate-api.com). Links open the original booking sites; the app does not scrape them.

## Known limits

- No real Duffel credentials were available. Test fares are explicitly labelled; live inventory/checkout is unverified.
- AI route quality, estimates, hours and availability require review. Initial itineraries are compact and patches allow at most 60 operations; long trips may need follow-up chat.
- Child flight searches use age 10 when ages are unknown. No payments, authentication, collaborative editing or deployment is included.
- Share links have no expiry/revoke UI. Calendar times have no timezone conversion. PDF output uses browser printing, not a server PDF service.
- Browser automation was unavailable in this environment. HTTP checks cover the workflows; native drag gestures, clipboard permissions and printed visual layout remain unverified.
