"use client";
import { useState } from "react";

type P = { budgetStyle: string; pace: string; interests: string; food: string; party: string; homeAirport: string; dislikes: string; displayCurrency: string };
const f = "w-full rounded border border-slate-300 px-2 py-1 text-sm";

export default function ProfileForm({ initial }: { initial: P }) {
  const [p, setP] = useState<P>(initial);
  const [msg, setMsg] = useState("");
  const up = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setP({ ...p, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Saving…");
    const r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    setMsg(r.ok ? "Saved ✓" : `Error: ${(await r.json()).error}`);
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block text-sm">Budget style
        <select className={f} value={p.budgetStyle} onChange={up("budgetStyle")}><option>budget</option><option>moderate</option><option>luxury</option></select>
      </label>
      <label className="block text-sm">Pace
        <select className={f} value={p.pace} onChange={up("pace")}><option>relaxed</option><option>balanced</option><option>packed</option></select>
      </label>
      <label className="block text-sm">Interests (comma-separated)<input className={f} value={p.interests} onChange={up("interests")} /></label>
      <label className="block text-sm">Food preferences<input className={f} value={p.food} onChange={up("food")} /></label>
      <label className="block text-sm">Party<input className={f} value={p.party} onChange={up("party")} /></label>
      <label className="block text-sm">Home airport (IATA)<input className={f} maxLength={3} value={p.homeAirport} onChange={up("homeAirport")} /></label>
      <label className="block text-sm">Dislikes<input className={f} value={p.dislikes} onChange={up("dislikes")} /></label>
      <label className="block text-sm">Display currency<input className={f} maxLength={3} value={p.displayCurrency} onChange={up("displayCurrency")} /></label>
      <button className="rounded bg-sky-700 px-3 py-1.5 text-sm text-white">Save</button>
      <span className="ml-2 text-sm text-slate-600" role="status">{msg}</span>
    </form>
  );
}
