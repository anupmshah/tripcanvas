export type LL = { lat: number; lng: number };
export function haversineKm(a: LL, b: LL) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Rough estimate only: road factor 1.3, walk 4.5 km/h under 1.5 km else 25 km/h. */
export function legEstimate(a: LL, b: LL) {
  const km = haversineKm(a, b) * 1.3;
  const walk = km < 1.5;
  return { km, minutes: Math.max(1, Math.round((km / (walk ? 4.5 : 25)) * 60)), mode: walk ? ("walk" as const) : ("taxi/transit" as const) };
}
