"use client";
import { useState } from "react";
export default function VerifyAgain({ id, reload }: { id: string; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="text-xs">
      <button
        disabled={busy}
        className="text-amber-800 underline"
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await fetch(`/api/items/${id}/verify`, { method: "POST" });
            if (!r.ok) throw new Error("Could not verify. Retry.");
            const d = await r.json();
            await reload();
            if (["pending", "unresolved"].includes(d.geoStatus))
              setError("No source resolved yet. Check the place name.");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Verifying…" : "Verify again"}
      </button>
      {error && <p role="status">{error}</p>}
    </div>
  );
}
