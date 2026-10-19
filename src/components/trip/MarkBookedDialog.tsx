"use client";
import { useState } from "react";
import type { ItemDTO } from "@/lib/dto";
const field = "w-full rounded border p-2 text-sm";
export default function MarkBookedDialog({ item, defaultCurrency, onClose, onSaved }: { item: ItemDTO; defaultCurrency: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [ref, setRef] = useState(""); const [price, setPrice] = useState(""); const [currency, setCurrency] = useState(item.currency ?? defaultCurrency);
  const [text, setText] = useState(""); const [details, setDetails] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function extract() {
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/items/${item.id}/extract-confirmation`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      if (d.bookingRef) setRef(d.bookingRef); if (d.price != null) setPrice(String(d.price)); if (d.currency) setCurrency(d.currency);
      setDetails([d.date, d.start, d.end, d.notes].filter(Boolean).join(" · "));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[2100] grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Mark as booked"><form className="max-h-[90vh] w-full max-w-md space-y-3 overflow-y-auto rounded-lg bg-white p-5" onSubmit={async (e) => {
    e.preventDefault(); setBusy(true); setError("");
    try { const r = await fetch(`/api/items/${item.id}/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingRef: ref, price: Number(price), currency }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await onSaved(); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}><h2 className="font-semibold">Mark as booked · {item.title}</h2><p className="text-xs text-slate-600">Record a booking you made on the provider’s site. Review the details before saving; this locks the item.</p>
    <label className="block text-sm">Confirmation reference<input className={field} required maxLength={100} value={ref} onChange={(e) => setRef(e.target.value)} /></label>
    <div className="flex gap-2"><label className="text-sm">Final total for the party<input className={field} type="number" min={0} step="0.001" required value={price} onChange={(e) => setPrice(e.target.value)} /></label><label className="text-sm">Currency<input className={`${field} w-20`} required minLength={3} maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} /></label></div>
    <details className="space-y-2 rounded border p-2"><summary className="cursor-pointer text-sm">Paste confirmation (optional)</summary><p className="text-xs text-slate-500">AI extracts fields for review. Extraction does not save.</p><textarea aria-label="Paste confirmation" className={`${field} min-h-24`} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} /><button type="button" disabled={busy || !text.trim()} onClick={extract} className="rounded border px-3 py-1 text-sm">Extract with AI</button>{details && <p className="text-xs">Extracted context: {details}</p>}</details>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={onClose}>Cancel</button><button disabled={busy} className="rounded bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-50">{busy ? "Working…" : "Save booked"}</button></div>
  </form></div>;
}
