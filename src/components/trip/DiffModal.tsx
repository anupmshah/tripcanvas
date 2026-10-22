"use client";
import { useState } from "react";
import type { AnnotatedOp } from "@/lib/patch/schema";
import type { TripDTO } from "@/lib/dto";
export type Proposal = { id: string; ops: AnnotatedOp[] };
export default function DiffModal({ patch, dto, onDone }: { patch: Proposal; dto: TripDTO; onDone: () => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ applied: number; skipped: { index: number; reason: string }[] } | null>(null);
  const itemName = (id: string) => dto.days.flatMap((d) => d.items).find((i) => i.id === id)?.title ?? id;
  async function decide(action: string) {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/patches/${patch.id}/${action}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Decision failed");
      if (action === "apply" && d.skipped?.length) setResult(d); else onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[2000] grid place-items-center bg-black/40 p-5" role="dialog" aria-modal="true" aria-label="Review proposed changes"><div className="max-h-[85vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
    <h2 className="text-lg font-bold">Review proposed changes</h2><p className="text-xs text-slate-600">Your itinerary changes only when you accept. Booked items stay locked.</p>
    {patch.ops.map((o, i) => <div key={i} className={`rounded border p-2 text-sm ${o.status === "skipped" ? "bg-slate-100 text-slate-500" : o.op === "remove" ? "bg-red-50" : "bg-emerald-50"}`}>
      <strong>{o.op}</strong>{"itemId" in o && ` · ${itemName(o.itemId)}`}
      {o.op === "add" && <> · {o.item.title} → Day {o.dayIndex + 1}{o.item.estimate && <div>Estimate: {o.item.estimate.low}–{o.item.estimate.high} {o.item.estimate.currency}</div>}<div>{o.geo?.found ? "Verified on OpenStreetMap" : "Location not verified on OSM"}</div></>}
      {o.op === "move" && ` · Day ${(dto.days.find((d) => d.items.some((x) => x.id === o.itemId))?.index ?? 0) + 1} → Day ${o.toDayIndex + 1}`}
      {o.op === "addStop" && ` · ${o.city}, ${o.country} · ${o.nights} nights`}
      {o.op === "setStopNights" && ` · ${dto.stops.find((s) => s.id === o.stopId)?.city} → ${o.nights} nights`}
      {o.op === "removeStop" && ` · ${dto.stops.find((s) => s.id === o.stopId)?.city}`}
      {o.op === "reorderStops" && ` · ${o.stopIds.map((id) => dto.stops.find((s) => s.id === id)?.city).join(" → ")}`}
      {o.reason && <p>{o.status === "skipped" ? "Skipped: " : ""}{o.reason}</p>}
    </div>)}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {result ? <div role="status"><p>{result.applied} changes applied.</p>{result.skipped.map((s) => <p key={s.index}>Change {s.index + 1} skipped: {s.reason}</p>)}<button onClick={onDone}>Close and refresh</button></div> : <div className="flex gap-3"><button disabled={busy} onClick={() => decide("apply")} className="rounded bg-sky-700 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Saving…" : "Accept all ok ops"}</button><button disabled={busy} onClick={() => decide("reject")}>Reject</button></div>}
  </div></div>;
}
