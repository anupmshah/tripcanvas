import "server-only";
import { geocode } from "./nominatim";

type StopCtx = { lat: number | null; lng: number | null; countryCode: string | null; city?: string; country?: string } | null | undefined;

/** Verification step: does the place exist on OSM near the stop's city? */
export async function verifyPlace(query: string, stop: StopCtx, force = false) {
  const g = await geocode(query, { near: stop?.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null, countryCode: stop?.countryCode, city: stop?.city, country: stop?.country, force });
  if (g.found) return { geoStatus: g.source ?? "ok", lat: g.lat ?? null, lng: g.lng ?? null };
  return { geoStatus: g.unavailable ? ("pending" as const) : ("unresolved" as const), lat: null, lng: null };
}
