"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type City = {
  city: string;
  country: string;
  airport: string;
  localCurrency: string;
  nights: number;
};
const blank = (c?: City): City => ({
  city: "",
  country: c?.country ?? "",
  airport: "",
  localCurrency: c?.localCurrency ?? "EUR",
  nights: 2,
});
const input = "rounded border border-slate-300 px-2 py-1 text-sm";

export default function NewTripForm({ homeAirport }: { homeAirport: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState(homeAirport);
  const [start, setStart] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [budget, setBudget] = useState("");
  const [cities, setCities] = useState<City[]>([blank()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nights = cities.reduce((n, c) => n + (c.nights || 0), 0);
  const set = (i: number, p: Partial<City>) =>
    setCities(cities.map((c, k) => (k === i ? { ...c, ...p } : c)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= cities.length) return;
    const n = [...cities];
    [n[i], n[j]] = [n[j], n[i]];
    setCities(n);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || cities.map((c) => c.city).join(" + "),
          originAirport: origin,
          startDate: start,
          adults,
          children,
          infants,
          budgetAmount: budget ? Number(budget) : null,
          stops: cities.map((c) => ({ ...c, airport: c.airport || null })),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Failed");
      router.push(`/trip/${d.id}`);
    } catch (x) {
      setError((x as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-white p-4">
      <h2 className="font-semibold">New trip</h2>
      <div className="flex flex-wrap gap-2">
        <input
          className={input}
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className={`${input} w-20`}
          placeholder="From (IATA)"
          maxLength={3}
          required
          value={origin}
          onChange={(e) => setOrigin(e.target.value.toUpperCase())}
        />
        <input
          className={input}
          type="date"
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <label className="text-sm">
          Adults{" "}
          <input
            className={`${input} w-14`}
            type="number"
            min={1}
            value={adults}
            onChange={(e) => setAdults(+e.target.value)}
          />
        </label>
        <label className="text-sm">
          Children{" "}
          <input
            className={`${input} w-14`}
            type="number"
            min={0}
            value={children}
            onChange={(e) => setChildren(+e.target.value)}
          />
        </label>
        <label className="text-sm">
          Infants under 2{" "}
          <input
            className={`${input} w-14`}
            type="number"
            min={0}
            max={8}
            value={infants}
            onChange={(e) => setInfants(+e.target.value)}
          />
        </label>
        <input
          className={`${input} w-32`}
          type="number"
          min={1}
          placeholder="Budget (BHD)"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        {cities.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1">
            <span className="w-5 text-sm text-slate-500">{i + 1}.</span>
            <input
              className={`${input} w-36`}
              placeholder="City"
              required
              value={c.city}
              onChange={(e) => set(i, { city: e.target.value })}
            />
            <input
              className={`${input} w-32`}
              placeholder="Country"
              required
              value={c.country}
              onChange={(e) => set(i, { country: e.target.value })}
            />
            <input
              className={`${input} w-20`}
              placeholder="Airport"
              maxLength={3}
              value={c.airport}
              onChange={(e) => set(i, { airport: e.target.value.toUpperCase() })}
            />
            <input
              className={`${input} w-16`}
              placeholder="CCY"
              maxLength={3}
              required
              value={c.localCurrency}
              onChange={(e) => set(i, { localCurrency: e.target.value.toUpperCase() })}
            />
            <input
              className={`${input} w-16`}
              type="number"
              min={1}
              aria-label="nights"
              value={c.nights}
              onChange={(e) => set(i, { nights: +e.target.value })}
            />
            <span className="text-sm">nights</span>
            <button type="button" className="px-1" onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button
              type="button"
              className="px-1"
              onClick={() => move(i, 1)}
              aria-label="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="px-1 text-red-600"
              disabled={cities.length === 1}
              onClick={() => setCities(cities.filter((_, k) => k !== i))}
              aria-label="Remove city"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="text-sm text-sky-700 hover:underline"
          onClick={() => setCities([...cities, blank(cities.at(-1))])}
        >
          + Add city
        </button>
        <span className="ml-3 text-sm text-slate-500">{nights} nights total</span>
      </div>
      {error && (
        <p className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Creating… (looking up cities)" : "Create trip"}
      </button>
    </form>
  );
}
