import "server-only";
import { geocode } from "./nominatim";
import type { Stop } from "@prisma/client";

type StopCtx = Pick<Stop, "lat" | "lng" | "countryCode" | "city" | "country"> | null | undefined;

/** Verification step: does the place exist on OSM near the stop's city? */
export async function verifyPlace(
  item: { title: string; placeQuery?: string | null },
  stop: StopCtx,
  force = false,
) {
  const g = await geocode(item.placeQuery ?? "", {
    title: item.title,
    near: stop?.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : null,
    countryCode: stop?.countryCode,
    city: stop?.city,
    country: stop?.country,
    force,
  });
  if (g.found) return { geoStatus: g.source ?? "ok", lat: g.lat ?? null, lng: g.lng ?? null };
  return {
    geoStatus: g.unspecified ? "unspecified" : g.unavailable ? "pending" : "unresolved",
    lat: null,
    lng: null,
  };
}
