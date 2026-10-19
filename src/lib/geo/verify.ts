import "server-only";
import { geocode } from "./nominatim";

type StopCtx = { lat: number | null; lng: number | null; countryCode: string | null } | null | undefined;

/** Verification step: does the place exist on OSM near the stop's city? */
export async function verifyPlace(query: string, stop: StopCtx) {
  const g = await geocode(query, { near: stop?.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null, countryCode: stop?.countryCode });
  if (g.found) return { geoStatus: "ok" as const, lat: g.lat!, lng: g.lng! };
  return { geoStatus: g.unavailable ? ("pending" as const) : ("unresolved" as const), lat: null, lng: null };
}
