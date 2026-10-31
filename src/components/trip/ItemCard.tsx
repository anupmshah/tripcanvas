"use client";
import type { ItemDTO } from "@/lib/dto";
import { ICON } from "./shared";

type Props = {
  item: ItemDTO;
  pin?: number;
  color: string;
  selected?: boolean;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  extra?: React.ReactNode;
};

export default function ItemCard({
  item,
  pin,
  color,
  selected,
  onDetails,
  onEdit,
  onDelete,
  extra,
}: Props) {
  const booked = item.status === "booked";
  return (
    <div
      className={`rounded-md border-2 bg-white p-2 text-sm shadow-sm ${booked ? "border-emerald-500" : "border-dashed border-sky-400"} ${selected ? "ring-2 ring-amber-400" : ""}`}
    >
      <div className="flex items-start gap-1.5">
        <span
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
          style={{ background: pin ? color : "#94a3b8" }}
        >
          {pin ?? "–"}
        </span>
        <span>{ICON[item.type]}</span>
        <span className="flex-1 font-medium leading-tight">{item.title}</span>
        {booked && <span title="Booked — locked">🔒</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
        {booked ? (
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
            Booked{item.bookingRef ? ` · ref ${item.bookingRef}` : ""}
          </span>
        ) : (
          <span className="rounded bg-sky-100 px-1.5 py-0.5 font-medium text-sky-800">
            Proposed
          </span>
        )}
        {["unresolved", "pending"].includes(item.geoStatus) && (
          <span
            className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800"
            title="No matching OSM or wiki source yet"
          >
            ⚠ Location not verified
          </span>
        )}
        {["wikipedia", "wikivoyage"].includes(item.geoStatus) && (
          <span>Verified via {item.geoStatus}</span>
        )}
        {item.geoStatus === "unspecified" && (
          <span className="text-slate-500">No specific place yet</span>
        )}
        {(item.start || item.end) && (
          <span className="text-slate-500">
            {item.start}
            {item.end ? `–${item.end}` : ""}
          </span>
        )}
      </div>
      {item.notes && <p className="mt-1 text-xs text-slate-600">{item.notes}</p>}
      {extra}
      <div className="mt-1.5 flex gap-2 text-xs text-sky-700">
        <button onClick={onDetails} className="hover:underline">
          Details
        </button>
        <button onClick={onEdit} className="hover:underline">
          Edit
        </button>
        {!booked && (
          <button onClick={onDelete} className="text-red-600 hover:underline">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
