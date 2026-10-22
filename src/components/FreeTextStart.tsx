"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TripDraftT } from "@/lib/llm/draft";
import { blockingQuestions } from "@/lib/llm/draft";
import { addDays } from "@/lib/dates";
const input = "rounded border border-slate-300 px-2 py-1 text-sm";
const example = "Plan a USA trip for 2 adults and 1 kid for 15 days anytime between 15th December till 5th January. This is a first time to the USA and we are vegetarians.";
export default function FreeTextStart() {
  const router = useRouter();
  const [text, setText] = useState(""); const [draft, setDraft] = useState<TripDraftT | null>(null);
  const [change, setChange] = useState("");
  const questions = draft ? blockingQuestions(draft) : [];
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  const set = (p: Partial<TripDraftT>) => setDraft((d) => d ? { ...d, ...p } : d);
  const city = (i: number, p: Partial<TripDraftT["route"][number]>) => draft && set({ route: draft.route.map((s, k) => i === k ? { ...s, ...p } : s) });
  async function request(action = "propose", fresh = false) {
    setBusy(action); setError("");
    let navigating = false;
    try {
      const r = await fetch("/api/trips/from-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, draft: fresh ? undefined : draft ?? undefined, change: fresh ? undefined : change || undefined, action }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Planning failed");
      if (data.id) { navigating = true; router.push(`/trip/${data.id}${data.warning ? "?initial=failed" : ""}`); }
      else { setDraft(data.draft); setChange(""); }
    } catch (e) { setError((e as Error).message); } finally { if (!navigating) setBusy(""); }
  }
  return <section className="space-y-3 rounded-xl border border-sky-200 bg-white p-5 shadow-sm">
    <h2 className="text-xl font-bold">Describe your trip</h2><p className="text-sm text-slate-600">Tell us where, who, and when. Review the dates and city route before creating anything.</p>
    <form onSubmit={(e) => { e.preventDefault(); setDraft(null); request("propose", true); }} className="space-y-2">
      <textarea aria-label="Describe your trip" className={`${input} min-h-28 w-full`} required maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={example} />
      <div className="flex gap-3"><button disabled={!!busy} className="rounded bg-sky-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy === "propose" ? "Choosing dates and a route…" : "Propose my trip"}</button><button type="button" disabled={!!busy} onClick={() => { setText(example); setDraft(null); }} className="text-sm text-sky-700">Use USA example</button></div>
    </form>
    {questions.length > 0 && <div className="rounded bg-amber-50 p-3 text-sm"><strong>A little more detail:</strong>{questions.map((q) => <p key={q}>{q}</p>)}</div>}
    {draft && <fieldset disabled={!!busy} className="space-y-3 border-t pt-3">
      <h3 className="font-semibold">Your proposed route · edit before accepting</h3>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs">Country / region <input className={input} value={draft.destination ?? ""} onChange={(e) => set({ destination: e.target.value || null })} /></label>
        <label className="text-xs">From (IATA) <input className={`${input} w-20`} maxLength={3} value={draft.originAirport} onChange={(e) => set({ originAirport: e.target.value.toUpperCase() })} /></label>
        <label className="text-xs">Adults <input className={`${input} w-14`} type="number" min={1} max={9} value={draft.adults} onChange={(e) => set({ adults: +e.target.value })} /></label>
        <label className="text-xs">Children <input className={`${input} w-14`} type="number" min={0} max={8} value={draft.children} onChange={(e) => set({ children: +e.target.value })} /></label>
        <label className="text-xs">Child ages, if known <input className={`${input} w-28`} placeholder="e.g. 7, 12" value={draft.childAges.join(", ")} onChange={(e) => set({ childAges: e.target.value ? e.target.value.split(",").map((v) => Number(v.trim())) : [] })} /></label>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <label>Length (calendar days) <input className={`${input} w-16`} type="number" min={2} max={61} value={draft.lengthDays ?? ""} onChange={(e) => set({ lengthDays: +e.target.value || null })} /></label>
        <label>Start <input className={input} type="date" value={draft.startDate ?? ""} min={draft.earliest ?? undefined} max={draft.latest ?? undefined} onChange={(e) => set({ startDate: e.target.value || null, endDate: e.target.value && draft.lengthDays ? addDays(e.target.value, draft.lengthDays - 1) : null })} /></label>
        <label>End <input className={input} type="date" value={draft.endDate ?? ""} min={draft.earliest ?? undefined} max={draft.latest ?? undefined} onChange={(e) => set({ endDate: e.target.value || null })} /></label>
      </div>
      <p className="text-xs text-slate-600">Window: {draft.earliest ?? "not specified"} → {draft.latest ?? "not specified"}. {draft.dateReason}</p>
      {draft.route.map((s, i) => <div key={i} className="flex flex-wrap items-center gap-1 rounded bg-slate-50 p-2 text-xs"><span>{i + 1}.</span>
        <input aria-label={`City ${i + 1}`} className={`${input} w-36`} value={s.city} onChange={(e) => city(i, { city: e.target.value })} /><input aria-label={`Country ${i + 1}`} className={`${input} w-32`} value={s.country} onChange={(e) => city(i, { country: e.target.value })} /><input aria-label={`Airport ${i + 1}`} className={`${input} w-16`} maxLength={3} value={s.airport ?? ""} onChange={(e) => city(i, { airport: e.target.value.toUpperCase() || null })} /><input aria-label={`Currency ${i + 1}`} className={`${input} w-16`} maxLength={3} value={s.localCurrency} onChange={(e) => city(i, { localCurrency: e.target.value.toUpperCase() })} />
        <input aria-label={`Nights ${i + 1}`} className={`${input} w-14`} type="number" min={1} max={30} value={s.nights} onChange={(e) => city(i, { nights: +e.target.value })} /> nights
        {i > 0 && <label>Arrive by <select className={input} value={s.transport ?? "train"} onChange={(e) => city(i, { transport: e.target.value as "train" | "flight" | "car" | "bus" })}>{["flight", "train", "bus", "car"].map((v) => <option key={v}>{v}</option>)}</select></label>}
        <button disabled={!!busy || i === 0} aria-label={`Move city ${i + 1} up`} onClick={() => { const r = [...draft.route]; [r[i - 1], r[i]] = [r[i], r[i - 1]]; set({ route: r }); }}>↑</button><button disabled={!!busy || draft.route.length === 1} onClick={() => set({ route: draft.route.filter((_, k) => k !== i) })}>Remove</button>
      </div>)}
      <p className="text-xs">{draft.route.reduce((n, s) => n + s.nights, 0)} nights total; expected {(draft.lengthDays ?? 1) - 1}. <button disabled={!!busy || draft.route.length >= 8} className="text-sky-700" onClick={() => set({ route: [...draft.route, { city: "", country: draft.route.at(-1)?.country ?? "", airport: null, localCurrency: draft.route.at(-1)?.localCurrency ?? "USD", nights: 2, transport: "train" }] })}>+ Add city</button></p>
      <div className="flex flex-wrap gap-2 text-xs"><label>Food <input className={input} value={draft.food} onChange={(e) => set({ food: e.target.value })} /></label><label>Interests <input className={input} value={draft.interests} onChange={(e) => set({ interests: e.target.value })} /></label><label>Pace <select className={input} value={draft.pace} onChange={(e) => set({ pace: e.target.value as TripDraftT["pace"] })}>{["relaxed", "balanced", "packed"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Budget (optional) <input className={`${input} w-24`} type="number" min={1} value={draft.budgetAmount ?? ""} onChange={(e) => set({ budgetAmount: +e.target.value || null })} /></label><label>Currency <input className={`${input} w-16`} maxLength={3} value={draft.budgetCurrency} onChange={(e) => set({ budgetCurrency: e.target.value.toUpperCase() })} /></label></div>
      <p className="text-xs text-slate-600">{draft.budgetAmount == null ? "No budget set — the first plan will show estimates for review. " : ""}Unknown child ages use age 10 for flight searches; verify ages and fares with the provider. Preferences are saved only after you confirm them in chat.</p>
      <form onSubmit={(e) => { e.preventDefault(); request(); }} className="flex gap-2"><input aria-label="Change the proposed trip" className={`${input} flex-1`} value={change} required maxLength={2000} onChange={(e) => setChange(e.target.value)} placeholder={questions.length ? "Your answers…" : "Type a change: swap DC for Chicago, fewer cities…"} /><button disabled={!!busy} className="rounded border px-3 text-sm">Update proposal</button></form>
      <button disabled={!!busy || questions.length > 0} onClick={() => request("create")} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">{busy === "create" ? "Building itinerary & checking places… this can take a few minutes" : "Accept route & create itinerary"}</button>
    </fieldset>}
    {error && <p role="alert" className="rounded bg-red-50 p-2 text-sm text-red-700">{error} Edit the draft or retry.</p>}
  </section>;
}
