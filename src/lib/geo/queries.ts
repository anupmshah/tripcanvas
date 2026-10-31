export function verificationQueries(
  query: string,
  ctx: { city?: string; country?: string },
  title = "",
) {
  const clean = (s: string) =>
    s
      .split(",")[0]
      .trim()
      .replace(
        /^(?:(?:cheaper|budget|vegetarian|vegan)\s+)*(?:hotel stay|stay|breakfast|lunch|dinner|meal|italian)\s+at\s+/i,
        "",
      )
      .replace(/^(?:visit|stroll(?: through)?|tour(?: of)?)\s+/i, "")
      .replace(/\s+(?:stroll|visit|walk|tour)$/i, "");
  const weak = (s: string) =>
    !s ||
    words(s) === words(ctx.city ?? "") ||
    /^(?:(?:budget|cheaper|vegetarian|vegan)\s+)*(?:hotel(?: stay)?|stay|breakfast|lunch|dinner|meal|restaurant|activity|sightseeing)(?:\s+in\b.*)?$/i.test(
      s,
    );
  let name = clean(query);
  if (weak(name)) {
    name = clean(title);
    query = "";
  }
  if (weak(name)) return ["", ""];
  const short = name.replace(
    /\s+(?:(?:vegetarian|vegan|italian|sushi)\s+)*(?:restaurant|bar|kitchen|marketplace)$/i,
    "",
  );
  return [
    query.includes(",")
      ? [
          name,
          ...query
            .split(",")
            .slice(1)
            .map((s) => s.trim()),
        ].join(", ")
      : [name, ctx.city, ctx.country].filter(Boolean).join(", "),
    name,
    ...(short !== name && !weak(short) ? [short] : []),
  ];
}
const words = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function wikiMatches(query: string, title: string, extract: string) {
  const name = words(query.split(",")[0]),
    tokens = name
      .split(" ")
      .filter((s) => s.length > 1 && !["the", "of", "in", "at", "and"].includes(s));
  const article = words(title).split(" ");
  return (
    !!name &&
    (words(extract).includes(name) ||
      (tokens.length > 0 &&
        tokens.filter((s) => article.includes(s)).length / tokens.length >= 0.6))
  );
}
export const locationVerified = (status: string) =>
  ["ok", "wikipedia", "wikivoyage"].includes(status);
export function canReadGeoCache(
  hit: { found: boolean; fetchedAt: Date } | null,
  force = false,
  now = Date.now(),
) {
  return (
    !!hit && (hit.found || !force) && now - hit.fetchedAt.getTime() < (hit.found ? 30 : 1) * 864e5
  );
}
