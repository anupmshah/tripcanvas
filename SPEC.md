# TripCanvas — product spec (from the user, verbatim)

Build a web app called TripCanvas: an AI trip planner that combines a chat planner with saved preferences, an editable day-by-day itinerary with a map, a running cost estimate, and booking links that lead to the original source sites.

Stack: Next.js (App Router, TypeScript), Tailwind, SQLite with Prisma, Leaflet with OpenStreetMap tiles, dnd-kit for drag and drop. Use npm only, no Docker, must run on Windows. Env vars in .env (provide .env.example): OPENAI_API_KEY, DUFFEL_ACCESS_TOKEN (optional). Keys are read server-side only, never sent to the browser, never committed.

Rules: no Booking.com, Expedia, Skyscanner or Google Places API. No paid scrapers, no scraping of Airbnb or Google Flights. Free data only: Nominatim (OSM) for geocoding with 1 request per second throttle and caching, Wikivoyage and Wikipedia REST for place info, Open-Meteo for weather, open.er-api.com for currency rates. Never present an invented price, hours or availability as fact.

Data model: Profile (budget style, pace, interests, food, party, home airport, dislikes, display currency default BHD). Trip (destination, dates, travellers, budget). Day. Item (type stay/flight/activity/food/transport, title, lat, lng, start, end, notes, status proposed or booked, price, currency, priceSource live|estimate|entered, priceFetchedAt, bookingRef, sourceUrl).

Features:
1. Chat planner: server route calls OpenAI with the profile and current trip JSON and returns a structured patch (add, move, remove items) validated with Zod, retried on invalid output. Show a diff the user accepts or rejects. Never change or delete booked items.
2. Preference memory: after each chat, extract new stable preferences and ask the user to confirm saving them.
3. Editor: day columns with drag and drop between days, map with numbered pins per day, estimated travel time between stops (haversine and mode speed, labelled estimate), place cards from Wikivoyage/Wikipedia with source link and fetched date.
4. Proposed vs booked: different colours and badges. Regenerating the plan touches only proposed items.
5. Verification: before showing a stop, check it exists via OSM geocoding and drop or flag ones that do not resolve.
Costs:
6. PriceProvider interface: searchFlights(origin, dest, dates, travellers) returning normalized offers {provider, price, currency, fetchedAt, deepLink, isLive}. Implement DuffelProvider (flight offer requests with the access token, pin the Duffel-Version header). If the token is missing or a call fails, fall back to DeepLinkProvider (no prices, shows "check on provider") without crashing.
7. Estimates for hotels, activities, food and local transport: ask the LLM for a low/mid/high range in local currency based on destination and the user's budget style. Store as priceSource estimate, user can overwrite with a real price (entered).
8. Every price shows a label and time: Live, Estimate or Entered, never an estimate presented as live. Flag offers older than 30 minutes as "may have changed". Cache offers 15 minutes and rate-limit provider calls.
9. Currency: keep the original currency, convert to the display currency with the daily cached rate, show the rate date.
10. Budget view: totals split live / estimate / entered, cost per day bar, warning when over budget. The chat planner receives budget and totals and proposes cheaper swaps when over.
11. Generation order: pick flights from live offers first, then hotel and activities within the remaining budget.

Booking (external only): each flight, stay and activity has buttons that open prefilled deep links in a new tab (Google Flights, Skyscanner, airline site, Booking.com, Airbnb, GetYourGuide) built from destination, dates and travellers. A Mark as booked form saves the confirmation ref and the final price. A paste-confirmation box lets the LLM extract details into the item.

Also: read-only share link, export to PDF and .ics, rate limiting on the chat route, loading and error states, one seeded demo trip, README with Windows setup.

Process: build in stages (scaffold and data model, editor and map, chat patches, costs and Duffel, booking links, share and export). After each stage run lint, typecheck and a smoke test, fix failures before continuing. Mock the price provider with fixtures and add a test for the fallback when Duffel errors. At the end list what is incomplete.
