"use client";
import { useState } from "react";
import type { z } from "zod";
import type { PrefCandidate } from "@/lib/patch/schema";
export type Candidate = z.infer<typeof PrefCandidate>;
export default function PreferencePrompt({
  candidates,
  onDone,
}: {
  candidates: Candidate[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState(candidates.map(() => true));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-2 rounded border border-violet-200 bg-violet-50 p-2 text-xs">
      <strong>Remember for future trips?</strong>
      {candidates.map((c, i) => (
        <label key={i} className="block">
          <input
            type="checkbox"
            checked={selected[i]}
            onChange={(e) => setSelected(selected.map((v, k) => (k === i ? e.target.checked : v)))}
          />{" "}
          {c.field} → {c.value}
          <span className="block text-slate-500">You said: “{c.evidence}”</span>
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy}
        className="mr-3 text-violet-800"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/profile", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                Object.fromEntries(
                  candidates.flatMap((c, i) => (selected[i] ? [[c.field, c.value]] : [])),
                ),
              ),
            });
            if (!r.ok) throw new Error((await r.json()).error ?? "Save failed");
            onDone();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save selected
      </button>
      <button onClick={onDone}>Not now</button>
    </div>
  );
}
