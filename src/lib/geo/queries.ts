export function verificationQueries(query: string, ctx: { city?: string; country?: string }) {
  const name = query.split(",")[0].trim();
  return [query.includes(",") ? query.trim() : [name, ctx.city, ctx.country].filter(Boolean).join(", "), name];
}
const words = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function wikiMatches(query: string, title: string, extract: string) {
  const name = words(query.split(",")[0]), tokens = name.split(" ").filter((s) => s.length > 1 && !["the", "of", "in", "at", "and"].includes(s));
  const article = words(title).split(" ");
  return !!name && (words(extract).includes(name) || (tokens.length > 0 && tokens.filter((s) => article.includes(s)).length / tokens.length >= 0.6));
}
export const locationVerified = (status: string) => ["ok", "wikipedia", "wikivoyage"].includes(status);
export function canReadGeoCache(hit: { found: boolean; fetchedAt: Date } | null, force = false, now = Date.now()) {
  return !!hit && (hit.found || !force) && now - hit.fetchedAt.getTime() < (hit.found ? 30 : 1) * 864e5;
}
