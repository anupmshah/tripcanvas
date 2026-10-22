"use client";
import { useEffect, useState } from "react";
import type { ItemDTO } from "@/lib/dto";

type Info = { found: boolean; title?: string; extract?: string; url?: string; thumbnailUrl?: string; fetchedAt: string };

export default function PlaceCard({ item, city, onClose }: { item: ItemDTO; city: string; onClose: () => void }) {
  const [info, setInfo] = useState<Info | null | "error">(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const tries = [item.title, item.placeQuery?.split(",")[0]?.trim()].filter((t, i, a): t is string => !!t && a.indexOf(t) === i);
        let last: Info | null = null;
        for (const t of tries) {
          const r = await fetch(`/api/place-info?title=${encodeURIComponent(t)}&source=wikipedia`);
          last = await r.json();
          if (last?.found) break;
        }
        if (live) setInfo(last);
      } catch { if (live) setInfo("error"); }
    })();
    return () => { live = false; };
  }, [item.title, item.placeQuery]);

  return (
    <aside className="fixed right-0 top-0 z-[1000] h-full w-96 overflow-auto border-l bg-white p-4 shadow-xl" role="dialog" aria-label="Place details">
      <button onClick={onClose} className="float-right text-slate-500" aria-label="Close">✕</button>
      <h2 className="text-lg font-semibold">{item.title}</h2>
      <p className="text-xs text-slate-500">{city}{item.geoStatus === "ok" ? " · location verified on OpenStreetMap" : ["wikipedia", "wikivoyage"].includes(item.geoStatus) ? ` · verified via ${item.geoStatus}` : ""}</p>
      {info === null && <p className="mt-3 animate-pulse text-sm text-slate-500">Loading from Wikipedia…</p>}
      {info === "error" && <p className="mt-3 text-sm text-slate-500">Info unavailable right now.</p>}
      {info && info !== "error" && !info.found && <p className="mt-3 text-sm text-slate-500">No Wikipedia article found for this place.</p>}
      {info && info !== "error" && info.found && (
        <div className="mt-3 space-y-2 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {info.thumbnailUrl && <img src={info.thumbnailUrl} alt={info.title} className="w-full rounded" />}
          <p>{info.extract}</p>
          <p className="text-xs text-slate-500">
            Source: <a className="text-sky-700 underline" href={info.url} target="_blank" rel="noopener noreferrer">Wikipedia — {info.title}</a> (CC BY-SA) · fetched {info.fetchedAt.slice(0, 10)}
          </p>
        </div>
      )}
    </aside>
  );
}
