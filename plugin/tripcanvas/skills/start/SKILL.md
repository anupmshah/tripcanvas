---
name: start
description: Install, configure and launch TripCanvas, a local multi-city trip planner, using the user's own OpenAI key and Postgres database. Use when the user wants to plan a trip with TripCanvas, set it up, fix its credentials, or start it again.
---

# TripCanvas

TripCanvas is a Next.js app that runs on the user's machine. The user describes a trip in one sentence, reviews an editable multi-city route, and gets a day-by-day itinerary with a map, labelled cost estimates, a budget, chat edits, booking links, sharing, a calendar file and a print view.

It uses the **user's own credentials**. You never supply keys, and you never ask the user to paste a key into chat.

## 1. Find or install the app

Ask where to keep it if it's not obvious; the default is a `TripCanvas` folder in the user's home directory. If that folder already has `package.json` with `"name": "tripcanvas"`, use it and skip to step 2.

```
git clone https://github.com/anupmshah/tripcanvas.git TripCanvas
cd TripCanvas
npm install
```

Needs Node 20.6 or later and git. If either is missing, say so and stop.

## 2. Credentials (the user fills them in, not you)

If `.env` doesn't exist, copy `.env.example` to `.env`. Open `.env` in the user's editor (on Windows `notepad .env`, on macOS `open -e .env`, otherwise their `$EDITOR`) and tell them what goes in each line:

| Setting | Required | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | yes | platform.openai.com → API keys. The account needs billing credit. |
| `DATABASE_URL` | yes | Any Postgres. Free option: neon.tech → new project → Connect → Prisma → **pooled** string. Append `&schema=tripcanvas`. |
| `DIRECT_URL` | yes | The **direct** (non-pooled) string from the same Neon screen, also with `&schema=tripcanvas`. For plain Postgres, use the same URL as `DATABASE_URL`. |
| `NOMINATIM_CONTACT` | yes | The user's email or website; OpenStreetMap's usage policy asks for it. |
| `DUFFEL_ACCESS_TOKEN` | no | duffel.com. Without it, flights show labelled AI estimates plus Google Flights / Skyscanner links. |

Tell the user: never paste keys into the chat; save the file and reply "done". The app only touches the `tripcanvas` schema, so a shared database is safe.

Then verify, without printing any secret:

```
npx prisma generate
npm run check-env
```

`check-env` prints `ok`/`FAIL` lines and `ENV OK` at the end. On `FAIL`, explain the line in plain words, reopen `.env`, and check again. Do not read `.env` aloud or echo its values.

## 3. First-time database setup

Only when `check-env` passes:

```
npm run db:push
npm run db:seed
```

`db:push` creates TripCanvas's tables inside the `tripcanvas` schema only. Never add `--force-reset` or `--accept-data-loss`.

## 4. Start it

Run `npm run dev` as a long-running background process and wait for the line containing `Local:`. Then give the user the URL (normally http://localhost:3000). If port 3000 is busy, Next picks another port; use the one it prints.

## 5. Using it

Tell the user, briefly:

1. Type a trip in the "Describe your trip" box, e.g. *"Plan a USA trip for 2 adults and 1 kid for 15 days anytime between 15th December and 5th January. First time in the USA, we are vegetarians."* Pressing Tab in the empty box fills in this example.
2. Review the proposed dates and cities (edit any field, or type a change), then **Accept route & create itinerary**.
3. Use the chat for changes ("swap Orlando for Chicago", "we're over budget, suggest cheaper hotels"). Every change is shown for review first; booked items are never changed.
4. Set a budget in the Budget panel; Share, `.ics` and Export PDF are at the top of the trip.

Prices are AI estimates unless marked Live or Entered; the user must check prices and bookings with the provider. The app has no login: it is meant for one person on their own computer, so don't expose it to the internet.

## Troubleshooting

- `check-env` says OpenAI rejected the key (401): the key was revoked or mistyped; create a new one.
- OpenAI 429 / quota: the OpenAI account needs billing credit.
- Database could not connect: wrong URL, missing `sslmode=require` for Neon, or the Neon project is paused (open it in the Neon console to wake it).
- On Windows, stop `npm run dev` before `npx prisma generate`, otherwise the Prisma engine file is locked.
