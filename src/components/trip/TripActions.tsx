"use client";
import { useState } from "react";
export default function TripActions({ tripId }: { tripId: string }) {
  const [url, setUrl] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <div className="flex flex-wrap items-center gap-3 text-xs"><button disabled={busy} className="rounded border bg-white px-2 py-1" onClick={async () => {
    setBusy(true); setError("");
    try { const r = await fetch(`/api/trips/${tripId}/share`, { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); const full = new URL(d.url, window.location.origin).href; setUrl(full); try { await navigator.clipboard.writeText(full); } catch { /* the visible link can still be copied */ } } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }}>{busy ? "Creating link…" : "Share"}</button><a href={`/trip/${tripId}/print`} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">Export PDF</a><a href={`/api/trips/${tripId}/ics`} className="text-sky-700 underline">.ics</a>
    {url && <label className="flex items-center gap-2">Read-only link <input aria-label="Share link" value={url} readOnly onFocus={(e) => e.target.select()} className="w-64 rounded border p-1" /><a href={url} target="_blank" rel="noopener noreferrer" className="text-sky-700 underline">Open</a></label>}{error && <p role="alert" className="text-red-700">{error} Retry.</p>}
  </div>;
}
