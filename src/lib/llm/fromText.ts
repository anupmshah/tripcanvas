import "server-only";
import { prisma } from "../db";
import { today } from "../dates";
import { geocode } from "../geo/nominatim";
import { createTrip } from "../trips";
import type { StopInput } from "../stops";
import { applyPatch } from "../patch/apply";
import { callJson } from "./openai";
import { LlmInvalidOutput } from "./openai";
import { chat } from "./chat";
import { DraftFields, TripDraft, resolveDraftDates, type TripDraftT } from "./draft";

export async function proposeTrip(text: string, previous?: TripDraftT, change?: string) {
  const profile = await prisma.profile.upsert({ where: { id: "default" }, create: {}, update: {} });
  return callJson(DraftFields.transform(resolveDraftDates).pipe(TripDraft), [
    {
      role: "system",
      content: `Extract intent and propose a practical multi-city trip. Return one JSON object with EVERY key:
{destination:string|null,originAirport:IATA,adults:number,children:number,infants:number,childAges:number[],lengthDays:number|null,earliest:YYYY-MM-DD|null,latest:YYYY-MM-DD|null,startDate:YYYY-MM-DD|null,endDate:YYYY-MM-DD|null,dateReason:string,budgetAmount:number|null,budgetCurrency:ISO,interests:string,food:string,pace:relaxed|balanced|packed,firstVisit:boolean,notes:string,route:[{city:string,country:string,airport:IATA|null,localCurrency:ISO,nights:integer,transport:flight|train|bus|car|null}],preferenceCandidates:[{field:budgetStyle|pace|interests|food|party|homeAirport|dislikes,value:string,evidence:string}]}.
Today is ${today()}. Use upcoming dates when the year is omitted. Dec 15 to Jan 5 crosses a year boundary. Distinguish WINDOW from fixed dates: preserve earliest/latest and PICK concrete start/end INSIDE it, explaining the choice without claiming cheaper fares or availability. lengthDays is INCLUSIVE days: 15 days = 14 nights; end=start+14. Sum route nights to lengthDays-1. Provide 3-4 cities for a first-time 15-day USA family trip, logical geography, season and family pace; choose real cities and IATA airports. First city's transport=null; others describe arrival mode. Use 1-8 cities; 1-30 nights each. A typed change revises the prior draft before creation; keep other intent.
Use Profile.homeAirport by default. Party defaults 2 adults if unspecified. children excludes infants under 2; infants defaults 0. Extract infants separately and never double count them. Budget is OPTIONAL: null if not supplied, currency=profile.displayCurrency. Unknown child ages=[]; no need to ask to plan (flight search currently assumes age 10 if unknown). Missing food/interests/pace use profile. Only destination, duration, or missing date/window can block: retain nulls when absent. Do NOT ask about budget, interests or child ages. Stable user-stated preferences go in preferenceCandidates for confirmation, not automatic saving. Vegetarian -> food; family/ages -> party; first-time destination -> interests. Do not invent the child's age. No prices or opening hours.
Profile: ${JSON.stringify(profile)}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        originalRequest: text,
        previousDraft: previous ?? null,
        change: change ?? null,
      }),
    },
  ]);
}

export async function createFromDraft(d: TripDraftT, text: string) {
  const verified: StopInput[] = [];
  for (const s of d.route) {
    const geo = await geocode(`${s.city}, ${s.country}`);
    if (!geo.found)
      throw new Error(`City not verified on OpenStreetMap: ${s.city}. Edit it or retry.`);
    verified.push({ ...s, lat: geo.lat!, lng: geo.lng!, countryCode: geo.countryCode });
  }
  const { trip } = await prisma.$transaction(
    (tx) =>
      createTrip(tx, {
        title: `${d.destination}: ${d.route.map((s) => s.city).join(" + ")}`,
        originAirport: d.originAirport,
        startDate: d.startDate!,
        adults: d.adults,
        children: d.children,
        infants: d.infants ?? 0,
        budgetAmount: d.budgetAmount,
        budgetCurrency: d.budgetCurrency,
        stops: verified,
      }),
    { timeout: 45_000 },
  );
  let warning: string | undefined;
  try {
    const result = await chat(
      trip.id,
      text,
      "chat",
      `Generate the FIRST itinerary for this accepted route, without changing any cities or nights. Accepted draft: ${JSON.stringify(d)}.
Search offers supplied by the server FIRST; include outbound and return flights (unpriced if no live offers), then a stay on the first day in EVERY city (estimate is the nightly rate for the whole party, with basis="night"; server multiplies by nights), then exactly ONE NAMED activity on EVERY full day (ALL dayIndex values 0 through ${d.lengthDays! - 2}, including travel/arrival days). Add one named food item per city within remaining budget. This means ${d.lengthDays! - 1} activity ops, plus stays, flights, intercity transport and a few food ops; keep it compact but cover EVERY full day. Intercity arrival mode is specified in the draft: use it. For vegetarian guests ALL food item notes MUST say "Vegetarian options; confirm with venue" and suggest vegetarian/vegan food, never meat or seafood. Every placeQuery is a real named place plus city/country; activities must not be generic. All estimates are whole-party low/mid/high in that stop's currency. Maximum 60 operations. Put flight ops first, stays next, activities/food after. Return stable preferences from the original request for confirmation.`,
    );
    if (!result) throw new Error("Trip not found");
    const prefs = [
      ...new Map(
        [...d.preferenceCandidates, ...result.preferenceCandidates].map((p) => [p.field, p]),
      ).values(),
    ];
    await prisma.pendingPatch.update({
      where: { id: result.patch.id },
      data: { prefsJson: JSON.stringify(prefs) },
    });
    if (!(await applyPatch(result.patch.id)))
      throw new Error("Initial proposal could not be applied");
  } catch (e) {
    console.error(
      "Initial itinerary failed",
      e instanceof LlmInvalidOutput
        ? e.message
        : { kind: (e as Error).constructor.name, code: (e as { code?: string }).code },
    );
    await prisma.chatMessage.create({ data: { tripId: trip.id, role: "user", content: text } });
    await prisma.pendingPatch.create({
      data: {
        tripId: trip.id,
        opsJson: "[]",
        prefsJson: JSON.stringify(d.preferenceCandidates),
        status: "applied",
      },
    });
    warning =
      "Your trip is saved, but the first itinerary could not finish. Open chat and retry generation.";
  }
  return { id: trip.id, warning };
}
