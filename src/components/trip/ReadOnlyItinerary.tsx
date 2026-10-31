import type { TripDTO } from "@/lib/dto";
import { formatMoney } from "@/lib/money/currency";
import { locationVerified } from "@/lib/geo/queries";
import PriceLabel from "./PriceLabel";
export default function ReadOnlyItinerary({ dto }: { dto: TripDTO }) {
  const { trip: t, totals } = dto;
  return (
    <main className="read-only mx-auto max-w-4xl space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p>{t.destination}</p>
        <p className="text-sm">
          {t.startDate} → {t.endDate} · {t.adults} adults · {t.children} children
        </p>
      </header>
      <section className="rounded border bg-white p-3 text-sm">
        <strong>Cost subtotal: {formatMoney(totals.total, totals.displayCurrency)}</strong>
        <p>
          {totals.test > 0 &&
            `TEST fares (not real): ${formatMoney(totals.test, totals.displayCurrency)} · `}
          Live {formatMoney(totals.live, totals.displayCurrency)} · Entered{" "}
          {formatMoney(totals.entered, totals.displayCurrency)} · Estimate{" "}
          {formatMoney(totals.estimate.mid, totals.displayCurrency)} (low–high{" "}
          {formatMoney(totals.estimate.low, totals.displayCurrency)}–
          {formatMoney(totals.estimate.high, totals.displayCurrency)})
        </p>
        <p>
          {totals.unpricedCount} unpriced · FX rates {totals.rateDate ?? "unavailable"}
          {totals.unconvertible.length
            ? ` · Partial subtotal; cannot convert ${totals.unconvertible.join(", ")}`
            : ""}
        </p>
        {totals.overBudget && (
          <p>Over budget by {formatMoney(-totals.remaining!, totals.displayCurrency)}</p>
        )}
      </section>
      {dto.days.map((d) => (
        <section key={d.id} className="print-day space-y-2 rounded border bg-white p-3">
          <h2 className="font-bold">
            Day {d.index + 1} · {d.date} · {dto.stops.find((s) => s.id === d.stopId)?.city}
          </h2>
          {d.items.length === 0 && <p className="text-sm text-slate-500">No items yet.</p>}
          {d.items.map((i) => (
            <article key={i.id} className="print-item border-t pt-2 text-sm">
              <h3 className="font-semibold">
                {i.start ? `${i.start}${i.end ? `–${i.end}` : ""} · ` : ""}
                {i.title}{" "}
                <span className="text-xs font-normal">
                  ({i.type} · {i.status})
                </span>
              </h3>
              <PriceLabel item={i} displayCurrency={totals.displayCurrency} />
              {i.geoStatus === "unspecified" ? (
                <p className="text-xs text-slate-500">No specific place yet</p>
              ) : (
                !locationVerified(i.geoStatus) && (
                  <p className="text-xs text-amber-800">Location not verified</p>
                )
              )}
              {i.notes && <p>{i.notes}</p>}
            </article>
          ))}
        </section>
      ))}
      <footer className="text-xs text-slate-500">
        Itinerary times are suggestions in local time. Estimates are not quotes; verify availability
        with the provider. Data: © OpenStreetMap contributors / Nominatim; Wikipedia and Wikivoyage
        (CC BY-SA); Open-Meteo; Rates by Exchange Rate API.
      </footer>
    </main>
  );
}
