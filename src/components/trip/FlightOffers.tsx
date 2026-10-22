"use client";
import { useCallback, useEffect, useState } from "react";
import type { TripDTO } from "@/lib/dto";
import type { flightsForTrip } from "@/lib/price/legs";
import { formatMoney } from "@/lib/money/currency";
type Result = Awaited<ReturnType<typeof flightsForTrip>>;
export default function FlightOffers({
  dto,
  reload,
}: {
  dto: TripDTO;
  reload: () => Promise<void>;
}) {
  const [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const r = await fetch(`/api/trips/${dto.trip.id}/flights`);
      if (!r.ok) throw new Error("Could not load flight options");
      setResult(await r.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [dto.trip.id]);
  useEffect(() => {
    load();
  }, [load, dto.trip.endDate, dto.trip.destination]);
  return (
    <details className="rounded border bg-white p-2 text-xs">
      <summary className="cursor-pointer font-semibold">Flight offers · external booking</summary>
      <button onClick={load} disabled={busy} className="my-2 text-sky-700">
        {busy ? "Loading…" : "Refresh / retry"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result?.error && (
        <p className="text-amber-700">{result.error}. Check directly with a provider.</p>
      )}
      {result?.legs.map((l) => (
        <section key={l.id} className="my-2 border-t pt-2">
          <h3 className="font-semibold">
            {l.origin} → {l.dest} · {l.depart}
            {l.optional ? " · optional flight; train/bus/car also possible" : ""}
          </h3>
          {l.offers.map((o, i) => (
            <div key={i} className="my-1 flex flex-wrap items-center gap-2">
              <a
                href={o.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-700 underline"
              >
                {o.summary ?? "Provider"}
              </a>
              <span>
                {o.price != null && o.currency
                  ? `${o.provider !== "duffel" ? "TEST fares — not real prices · " : "Live · "}${formatMoney(o.price, o.currency)} · ${o.fetchedAt.slice(0, 16)} UTC`
                  : "Check price on provider"}
              </span>
              {o.offerId && (
                <button
                  disabled={busy}
                  className="rounded border px-2"
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const r = await fetch(`/api/trips/${dto.trip.id}/items`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          dayIndex: l.dayIndex,
                          type: "flight",
                          title: `${l.origin} → ${l.dest}`,
                          offerId: o.offerId,
                          legId: l.id,
                          placeQuery: `${l.dest} airport`,
                        }),
                      });
                      if (!r.ok) throw new Error((await r.json()).error);
                      await reload();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Add to Day {l.dayIndex + 1}
                </button>
              )}
            </div>
          ))}
        </section>
      ))}
    </details>
  );
}
