"use client";
import { useCallback, useEffect, useState } from "react";
import type { ItemDTO, TripDTO } from "@/lib/dto";
import DayColumns from "./DayColumns";
import ItemEditor from "./ItemEditor";
import MapPanel from "./MapPanel";
import PlaceCard from "./PlaceCard";
import StopStrip from "./StopStrip";
import ChatPanel from "./ChatPanel";
import BudgetPanel from "./BudgetPanel";
import PriceLabel from "./PriceLabel";
import FlightOffers from "./FlightOffers";
import type { Weather } from "./shared";

export default function TripWorkspace({ initial }: { initial: TripDTO }) {
  const [dto, setDto] = useState(initial);
  const [msg, setMsg] = useState("");
  const [weather, setWeather] = useState<Record<string, Weather>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [details, setDetails] = useState<ItemDTO | null>(null);
  const [editing, setEditing] = useState<ItemDTO | null>(null);
  const id = dto.trip.id;

  const toast = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(""), 4000); }, []);
  const reload = useCallback(async () => {
    const r = await fetch(`/api/trips/${id}`);
    if (r.ok) setDto(await r.json()); else toast("Could not refresh the trip");
  }, [id, toast]);

  useEffect(() => {
    fetch(`/api/weather?tripId=${id}`).then((r) => r.json()).then((d) => {
      const out: Record<string, Weather> = {};
      for (const s of d.stops ?? []) if (s.available) out[s.stopId] = Object.fromEntries(s.days.map((x: any) => [x.date, x]));
      setWeather(out);
    }).catch(() => undefined); // weather is optional: degrade silently
  }, [id, dto.trip.endDate]);

  async function del(item: ItemDTO) {
    const r = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    if (!r.ok) toast((await r.json()).error ?? "Delete failed"); else reload();
  }

  const t = dto.trip;
  return (
    <div className="flex h-[calc(100vh-41px)]">
      <ChatPanel dto={dto} reload={reload} />
      <section className="min-w-0 flex-1 space-y-2 overflow-y-auto p-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-xl font-bold">{t.title}</h1>
          <span className="text-sm text-slate-600">{t.destination} · {t.startDate} → {t.endDate} · {t.adults} adult{t.adults === 1 ? "" : "s"}{t.children ? ` + ${t.children} child` : ""}{t.budgetAmount ? ` · Budget ${t.budgetAmount.toLocaleString("en-GB")} ${t.budgetCurrency}` : ""}</span>
        </div>
        <StopStrip stops={dto.stops} />
        <FlightOffers dto={dto} reload={reload} />
        {msg && <div className="rounded bg-red-50 p-2 text-sm text-red-700" role="alert">{msg}</div>}
        <DayColumns dto={dto} setDto={setDto} reload={reload} weather={weather} toast={toast} selected={selected}
          onDetails={setDetails} onEdit={setEditing} onDelete={del} renderExtra={(i) => <PriceLabel item={i} displayCurrency={dto.totals.displayCurrency} />} />
      </section>
      <aside className="w-[28rem] shrink-0 space-y-3 overflow-y-auto border-l bg-white p-3">
        <MapPanel dto={dto} onSelect={setSelected} />
        <BudgetPanel dto={dto} reload={reload} />
      </aside>
      {details && <PlaceCard item={details} city={dto.stops.find((s) => s.id === dto.days.find((d) => d.items.some((i) => i.id === details.id))?.stopId)?.city ?? ""} onClose={() => setDetails(null)} />}
      {editing && <ItemEditor item={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}
