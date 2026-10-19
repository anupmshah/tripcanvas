"use client";
import { useEffect, useState } from "react";
import type { TripDTO } from "@/lib/dto";
import DiffModal, { type Proposal } from "./DiffModal";
import PreferencePrompt, { type Candidate } from "./PreferencePrompt";
export default function ChatPanel({ dto, reload }: { dto: TripDTO; reload: () => Promise<void> }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [patch, setPatch] = useState<Proposal | null>(null); const [prefs, setPrefs] = useState<Candidate[]>([]);
  const url = `/api/trips/${dto.trip.id}/chat`;
  useEffect(() => { fetch(url).then((r) => { if (!r.ok) throw new Error("Could not load chat"); return r.json(); }).then((d) => { setMessages(d.messages); setPrefs(d.preferenceCandidates ?? []); if (d.pending) setPatch(d.pending); }).catch((e) => setError(e.message)); }, [url]);
  async function send(mode: "chat" | "regenerate") {
    const message = mode === "regenerate" ? "Regenerate proposed items, keeping all booked items and my city route." : text;
    setBusy(true); setError("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, mode }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error ?? "Chat failed");
      setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: d.reply }]); setText("");
      setPrefs(d.preferenceCandidates); if (d.patch.ops.length) setPatch(d.patch);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r bg-white p-3">
    <h2 className="font-semibold">Plan with chat</h2><p className="text-xs text-slate-500">Ask for places, cheaper swaps, or another city. Review changes before saving.</p>
    <button className="rounded border p-2 text-xs disabled:opacity-50" disabled={busy || !!patch} onClick={() => send("regenerate")}>Regenerate proposed</button>
    <div className="flex-1 space-y-3">{messages.map((m, i) => <p key={i} className={`whitespace-pre-wrap rounded p-2 text-sm ${m.role === "user" ? "bg-sky-50" : "bg-slate-100"}`}><strong className="block text-xs">{m.role === "user" ? "You" : "TripCanvas"}</strong>{m.content}</p>)}</div>
    {prefs.length > 0 && <PreferencePrompt key={JSON.stringify(prefs)} candidates={prefs} onDone={() => setPrefs([])} />}
    {error && <p role="alert" className="text-xs text-red-700">{error} Try again.</p>}
    <form onSubmit={(e) => { e.preventDefault(); send("chat"); }} className="space-y-2"><textarea aria-label="Chat message" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} required placeholder="Add a seafood dinner…" className="w-full rounded border p-2 text-sm" /><button disabled={busy || !!patch} className="w-full rounded bg-sky-700 p-2 text-sm text-white disabled:opacity-50">{busy ? "Planning & verifying places…" : "Send"}</button></form>
    {patch && <DiffModal patch={patch} dto={dto} onDone={() => { setPatch(null); reload(); }} />}
  </aside>;
}
