import { legEstimate } from "@/lib/geo/travel";
import type { ItemDTO } from "@/lib/dto";

export default function TravelLeg({ a, b }: { a: ItemDTO; b: ItemDTO }) {
  if (a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const e = legEstimate({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng });
  return (
    <div className="py-0.5 pl-3 text-xs text-slate-500" title="Straight-line distance × 1.3 at walking / city speed — an estimate, not a route">
      ↓ {e.km.toFixed(1)} km · ~{e.minutes} min {e.mode} (est.)
    </div>
  );
}
