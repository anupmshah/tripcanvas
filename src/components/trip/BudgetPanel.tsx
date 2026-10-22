"use client";
import { useState } from "react";
import type { TripDTO } from "@/lib/dto";
import { formatMoney } from "@/lib/money/currency";
export default function BudgetPanel({
  dto,
  reload,
}: {
  dto: TripDTO;
  reload: () => Promise<void>;
}) {
  const t = dto.totals,
    fmt = (n: number) => formatMoney(n, t.displayCurrency);
  const [amount, setAmount] = useState(String(dto.trip.budgetAmount ?? ""));
  const [currency, setCurrency] = useState(dto.trip.budgetCurrency);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const max = Math.max(1, ...t.perDay.map((d) => d.amount));
  return (
    <section className="space-y-2 rounded-lg border p-3 text-xs">
      <h2 className="text-base font-semibold">Budget · {t.displayCurrency}</h2>
      {t.overBudget && (
        <p role="alert" className="rounded bg-red-50 p-2 font-semibold text-red-700">
          Over budget by {fmt(-t.remaining!)}. Ask chat for cheaper swaps.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-1">
        <dt>Budget</dt>
        <dd>{t.budget == null ? "Not set" : fmt(t.budget)}</dd>
        <dt>Live</dt>
        <dd>{fmt(t.live)}</dd>
        {t.test > 0 && (
          <>
            <dt>TEST fares (not real)</dt>
            <dd>{fmt(t.test)}</dd>
          </>
        )}
        <dt>Entered</dt>
        <dd>{fmt(t.entered)}</dd>
        <dt>Estimate (low / mid / high)</dt>
        <dd>
          {fmt(t.estimate.low)} / {fmt(t.estimate.mid)} / {fmt(t.estimate.high)}
        </dd>
        <dt className="font-bold">Estimated total including flights</dt>
        <dd className="font-bold">{fmt(t.total)}</dd>
        {t.remaining != null && (
          <>
            <dt>Remaining</dt>
            <dd>{fmt(t.remaining)}</dd>
          </>
        )}
      </dl>
      <p className="text-slate-600">
        {t.unpricedCount} unpriced · Costs are totals for the whole party. Subtotals exclude
        unpriced items and unplanned expenses.
      </p>
      {t.unconvertible.length > 0 && (
        <div className="rounded bg-amber-50 p-2">
          Rates unavailable for {t.unconvertible.join(", ")} — converted subtotal is partial.
          <div>
            Original currency totals:{" "}
            {Object.entries(t.originalTotals)
              .map(([c, n]) => formatMoney(n, c))
              .join(" · ")}
          </div>
        </div>
      )}
      <h3 className="font-medium">Per day</h3>
      {t.perDay.map((d) => (
        <div key={d.index}>
          <div className="flex justify-between">
            <span>Day {d.index + 1}</span>
            <span>{fmt(d.amount)}</span>
          </div>
          <div className="h-1 rounded bg-slate-100">
            <div
              className="h-1 rounded bg-sky-600"
              style={{ width: `${(d.amount / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      <h3 className="font-medium">Per city</h3>
      {t.perCity.map((s) => (
        <div key={s.stopId} className="flex justify-between">
          <span>{s.city}</span>
          <span>{fmt(s.amount)}</span>
        </div>
      ))}
      {dto.rates ? (
        <p className="text-slate-500">
          {Object.entries(dto.rates.conversions)
            .map(([c, n]) =>
              n == null
                ? `${c}: rate unavailable`
                : `1 ${c} = ${n.toFixed(4)} ${t.displayCurrency}`,
            )
            .join(" · ")}{" "}
          · rates {dto.rates.rateDate} ·{" "}
          <a
            href="https://www.exchangerate-api.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Rates by Exchange Rate API
          </a>
        </p>
      ) : (
        <p>Rates unavailable — original currency totals shown above.</p>
      )}
      <form
        className="flex flex-wrap gap-1 border-t pt-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            const r = await fetch(`/api/trips/${dto.trip.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                budgetAmount: amount ? Number(amount) : null,
                budgetCurrency: currency,
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
        <input
          aria-label="Budget amount"
          className="w-24 rounded border p-1"
          type="number"
          min="0.001"
          step="0.001"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          aria-label="Budget currency"
          className="w-14 rounded border p-1"
          maxLength={3}
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
        <button disabled={busy} className="rounded border px-2">
          {busy ? "Saving…" : "Set budget"}
        </button>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
