"use client";
import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DayDTO, ItemDTO, TripDTO } from "@/lib/dto";
import { fmtDay } from "@/lib/dates";
import ItemCard from "./ItemCard";
import TravelLeg from "./TravelLeg";
import { pinNumbers, stopColor, type Weather } from "./shared";

type Handlers = {
  onDetails: (i: ItemDTO) => void;
  onEdit: (i: ItemDTO) => void;
  onDelete: (i: ItemDTO) => void;
  selected?: string | null;
  renderExtra?: (i: ItemDTO) => React.ReactNode;
};

function Sortable({ item, children }: { item: ItemDTO; children: React.ReactNode }) {
  const booked = item.status === "booked";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: booked,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      {...attributes}
      {...(booked ? {} : listeners)}
    >
      {children}
    </div>
  );
}

function AddItem({
  tripId,
  dayIndex,
  onAdded,
}: {
  tripId: string;
  dayIndex: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("activity");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-xs text-sky-700 hover:underline">
        + Add item
      </button>
    );
  return (
    <form
      className="space-y-1 rounded border bg-slate-50 p-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        try {
          const r = await fetch(`/api/trips/${tripId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dayIndex, type, title }),
          });
          if (!r.ok) throw new Error((await r.json()).error ?? "Add failed");
          setTitle("");
          setOpen(false);
          onAdded();
        } catch (e) {
          setErr((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="w-full rounded border text-xs"
      >
        {["activity", "food", "stay", "transport", "flight"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Place or title"
        required
        className="w-full rounded border px-1 text-xs"
      />
      {err && <p className="text-xs text-red-700">{err}</p>}
      <div className="flex gap-2 text-xs">
        <button
          disabled={busy}
          className="rounded bg-sky-700 px-2 py-0.5 text-white disabled:opacity-50"
        >
          {busy ? "Checking place…" : "Add"}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Column({
  dto,
  day,
  weather,
  h,
  reload,
}: {
  dto: TripDTO;
  day: DayDTO;
  weather: Weather;
  h: Handlers;
  reload: () => void;
}) {
  const { setNodeRef } = useDroppable({ id: `day:${day.id}` });
  const stop = dto.stops.find((s) => s.id === day.stopId)!;
  const color = stopColor(dto, day.stopId);
  const pins = pinNumbers(day);
  const w = weather[day.date];
  return (
    <section
      className="w-72 shrink-0 rounded-lg border bg-slate-100"
      style={{ borderTop: `4px solid ${color}` }}
    >
      <header className="p-2">
        <div className="font-semibold">
          Day {day.index + 1} · {fmtDay(day.date)}
        </div>
        <div className="text-xs" style={{ color }}>
          {stop.city}
          {day.index === dto.days.length - 1 ? " · departure day" : ""}
        </div>
        {w && (
          <div className="text-xs text-slate-600" title="Open-Meteo forecast">
            {Math.round(w.tMax)}°/{Math.round(w.tMin)}°{" "}
            {w.precipProb != null ? `🌧${w.precipProb}%` : ""}
          </div>
        )}
      </header>
      <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-16 space-y-0.5 p-2 pt-0">
          {day.items.map((it, k) => (
            <div key={it.id}>
              {k > 0 && <TravelLeg a={day.items[k - 1]} b={it} />}
              <Sortable item={it}>
                <ItemCard
                  item={it}
                  pin={pins.get(it.id)}
                  color={color}
                  selected={h.selected === it.id}
                  onDetails={() => h.onDetails(it)}
                  onEdit={() => h.onEdit(it)}
                  onDelete={() => h.onDelete(it)}
                  extra={h.renderExtra?.(it)}
                />
              </Sortable>
            </div>
          ))}
        </div>
      </SortableContext>
      <div className="p-2 pt-0">
        <AddItem tripId={dto.trip.id} dayIndex={day.index} onAdded={reload} />
      </div>
    </section>
  );
}

export default function DayColumns({
  dto,
  setDto,
  reload,
  weather,
  toast,
  ...h
}: Handlers & {
  dto: TripDTO;
  setDto: (d: TripDTO) => void;
  reload: () => void;
  weather: Record<string, Weather>;
  toast: (m: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const from = dto.days.find((d) => d.items.some((i) => i.id === active.id));
    const overId = String(over.id);
    const to = overId.startsWith("day:")
      ? dto.days.find((d) => d.id === overId.slice(4))
      : dto.days.find((d) => d.items.some((i) => i.id === overId));
    if (!from || !to) return;
    const item = from.items.find((i) => i.id === active.id)!;
    const overIdx = overId.startsWith("day:")
      ? to.items.length
      : to.items.findIndex((i) => i.id === overId);
    let days: DayDTO[];
    if (from.id === to.id) {
      const oldIdx = from.items.findIndex((i) => i.id === active.id);
      days = dto.days.map((d) =>
        d.id === from.id
          ? { ...d, items: arrayMove(d.items, oldIdx, Math.min(overIdx, d.items.length - 1)) }
          : d,
      );
    } else {
      days = dto.days.map((d) =>
        d.id === from.id
          ? { ...d, items: d.items.filter((i) => i.id !== item.id) }
          : d.id === to.id
            ? { ...d, items: [...d.items.slice(0, overIdx), item, ...d.items.slice(overIdx)] }
            : d,
      );
    }
    const before = dto;
    setDto({ ...dto, days }); // optimistic
    const changed = days.filter((d) => d.id === from.id || d.id === to.id);
    try {
      const r = await fetch(`/api/trips/${dto.trip.id}/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: changed.map((d) => ({ dayId: d.id, itemIds: d.items.map((i) => i.id) })),
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Move failed");
      reload();
    } catch (e) {
      setDto(before);
      toast((e as Error).message);
    }
  }

  return (
    <DndContext
      id="trip-dnd"
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-3">
        {dto.days.map((d) => (
          <Column
            key={d.id}
            dto={dto}
            day={d}
            h={h}
            reload={reload}
            weather={weather[d.stopId] ?? {}}
          />
        ))}
      </div>
    </DndContext>
  );
}
