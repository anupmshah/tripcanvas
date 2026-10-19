"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      className="rounded border border-sky-700 px-3 py-1.5 text-sm text-sky-700 disabled:opacity-50"
      onClick={async () => {
        setBusy(true);
        const r = await fetch("/api/dev/demo", { method: "POST" });
        router.push(`/trip/${(await r.json()).id}`);
      }}
    >
      {busy ? "Creating…" : "Open demo trip (Lisbon + Porto)"}
    </button>
  );
}
