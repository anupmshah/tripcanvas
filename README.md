# TripCanvas

AI trip planner: chat planner + editable multi-city itinerary + map + cost estimates + external booking links.
(Full setup / attribution / known gaps are filled in at stage 6.)

```
npm install
copy .env.example .env      # then fill OPENAI_API_KEY
npm run db:push && npm run db:seed
npm run dev
```

## Database (Neon Postgres)
Set `DATABASE_URL` (pooled host) and `DIRECT_URL` (direct host) in `.env`, each ending with `schema=tripcanvas`
so TripCanvas only touches its own Postgres schema. `npm run db:push` creates the tables; `npm run db:seed` adds the demo trip.
Stop `next dev` before `prisma generate` on Windows (EPERM on the query-engine DLL).

## Progress

Stages 1 and 2 provide the multi-city model, editor, map, and free place/weather data.
Stage 3 adds real OpenAI chat, reviewable patches, protected booked items, city operations,
and confirmed preference memory. Run `npm run smoke` against the dev server.

## Known gaps / incomplete

Costs/providers, booking links/extraction, share/export, and the final production gate
are the next stages. Browser tools are unavailable in this environment; the user has
authorized the final end-to-end workflow over HTTP.
