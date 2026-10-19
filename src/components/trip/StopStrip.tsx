"use client";
import { useEffect, useState } from "react";
import type { Stop } from "@prisma/client";
import { fmtDay } from "@/lib/dates";
import { PALETTE } from "./shared";

type Info = { found: boolean; extract?: string; url?: string; fetchedAt: string };

function StopCard({ stop, color }: { stop: Stop; color: string }) {
  const [info, setInfo] = useState<Info | null | "error">(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/place-info?title=${encodeURIComponent(stop.city)}&source=wikivoyage`).then((r) => r.json()).then((d) => live && setInfo(d)).catch(() => live && setInfo("error"));
    return () => { live = false; };
  }, [stop.city]);
  const nights = Math.round((Date.parse(stop.endDate) - Date.parse(stop.startDate)) / 864e5);
  return (
    <div className="w-72 shrink-0 rounded-lg border bg-white p-2 text-xs" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="font-semibold">{stop.city}, {stop.country} <span className="font-normal text-slate-500">· {nights} night{nights === 1 ? "" : "s"} · {fmtDay(stop.startDate)} → {fmtDay(stop.endDate)}</span></div>
      {info === null && <p className="animate-pulse text-slate-400">Loading Wikivoyage…</p>}
      {info === "error" || (info && !info.found) ? <p className="text-slate-400">Info unavailable</p> : null}
      {info && info !== "error" && info.found && (
        <p className="line-clamp-3 text-slate-600">{info.extract} <a className="text-sky-700 underline" href={info.url} target="_blank" rel="noopener noreferrer">Wikivoyage</a> · fetched {info.fetchedAt.slice(0, 10)}</p>
      )}
    </div>
  );
}

export default function StopStrip({ stops }: { stops: Stop[] }) {
  return <div className="flex gap-2 overflow-x-auto pb-2">{stops.map((s, i) => <StopCard key={s.id} stop={s} color={PALETTE[i % PALETTE.length]} />)}</div>;
}
