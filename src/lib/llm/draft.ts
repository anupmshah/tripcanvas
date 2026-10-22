import { z } from "zod";
import { addDays, diffDays, isDate } from "../dates";
import { PrefCandidate } from "../patch/schema";
const DateText = z.string().refine(isDate, "Use YYYY-MM-DD").nullable();
export const DraftStop = z.object({
  city: z.string().min(1).max(80),
  country: z.string().min(1).max(80),
  airport: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  localCurrency: z.string().regex(/^[A-Z]{3}$/),
  nights: z.number().int().min(1).max(30),
  transport: z.enum(["flight", "train", "bus", "car"]).nullable(),
});
export const DraftFields = z.object({
  infants: z.number().int().min(0).max(8).optional(),
  destination: z.string().max(100).nullable(),
  originAirport: z.string().regex(/^[A-Z]{3}$/),
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(8),
  childAges: z.array(z.number().int().min(0).max(17)).max(8),
  lengthDays: z.number().int().min(2).max(61).nullable(),
  earliest: DateText,
  latest: DateText,
  startDate: DateText,
  endDate: DateText,
  dateReason: z.string().max(500),
  budgetAmount: z.number().positive().nullable(),
  budgetCurrency: z.string().regex(/^[A-Z]{3}$/),
  interests: z.string().max(500),
  food: z.string().max(300),
  pace: z.enum(["relaxed", "balanced", "packed"]),
  firstVisit: z.boolean(),
  notes: z.string().max(1000),
  route: z.array(DraftStop).max(8),
  preferenceCandidates: z.array(PrefCandidate).max(5),
});
export const TripDraft = DraftFields.superRefine((d, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: "custom", message });
  if (
    d.startDate &&
    d.endDate &&
    d.lengthDays &&
    diffDays(d.startDate, d.endDate) + 1 !== d.lengthDays
  )
    bad("lengthDays counts inclusive calendar days, so end-start = lengthDays-1");
  if (d.earliest && d.startDate && d.startDate < d.earliest)
    bad("Start must be inside the date window");
  if (d.latest && d.endDate && d.endDate > d.latest) bad("End must be inside the date window");
  if (
    d.lengthDays &&
    d.route.length &&
    d.route.reduce((n, s) => n + s.nights, 0) !== d.lengthDays - 1
  )
    bad("Route nights must sum to lengthDays-1");
});
export type TripDraftT = z.infer<typeof TripDraft>;
export const FromTextInput = z
  .object({
    text: z.string().trim().min(1).max(2000),
    draft: DraftFields.optional(),
    change: z.string().max(2000).optional(),
    action: z.enum(["propose", "create"]).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.action === "create" && d.draft) {
      const result = TripDraft.safeParse(d.draft);
      if (!result.success)
        result.error.issues.forEach((i) => ctx.addIssue({ ...i, path: ["draft", ...i.path] }));
    }
  });
export function resolveDraftDates(d: TripDraftT): TripDraftT {
  if (!d.lengthDays || !d.startDate) return d;
  let startDate = d.startDate;
  if (d.earliest && startDate < d.earliest) startDate = d.earliest;
  if (d.latest && addDays(startDate, d.lengthDays - 1) > d.latest)
    startDate = addDays(d.latest, 1 - d.lengthDays);
  if (d.earliest && startDate < d.earliest)
    return {
      ...d,
      startDate: null,
      endDate: null,
      dateReason:
        "The window is shorter than the requested trip. Widen the window or shorten the trip.",
    };
  return {
    ...d,
    startDate,
    endDate: addDays(startDate, d.lengthDays - 1),
    dateReason:
      startDate === d.startDate
        ? d.dateReason
        : "Adjusted the proposed start to fit the full trip inside your window. Fares have not been checked.",
  };
}
export function blockingQuestions(d: TripDraftT) {
  return [
    !d.destination && "Which country or region would you like to visit?",
    !d.lengthDays && "How many calendar days should the trip last?",
    (!d.startDate || !d.endDate) && "What dates or travel window can you use?",
  ].filter((q): q is string => !!q);
}
