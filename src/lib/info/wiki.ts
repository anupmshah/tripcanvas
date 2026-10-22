import "server-only";
import { prisma } from "../db";
import { env } from "../env";
import { z } from "zod";
import { callJson } from "../llm/openai";
import { wikiMatches } from "../geo/queries";

export type PlaceInfo = { found: boolean; title?: string; extract?: string; url?: string; thumbnailUrl?: string; source: string; fetchedAt: string };
const TTL = 7 * 864e5;
const UA = () => ({ "User-Agent": `TripCanvas/0.1 (${env.NOMINATIM_CONTACT})`, Accept: "application/json" });

async function getJson(url: string) {
  const r = await fetch(url, { headers: UA(), signal: AbortSignal.timeout(10000) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function getPlaceInfo(title: string, source: "wikipedia" | "wikivoyage", force = false): Promise<PlaceInfo> {
  const key = `${source}:en:${title.trim().toLowerCase()}`;
  const hit = await prisma.placeInfoCache.findUnique({ where: { key } });
  if (hit && (hit.found || !force) && Date.now() - hit.fetchedAt.getTime() < TTL)
    return { found: hit.found, title: hit.title ?? undefined, extract: hit.extract ?? undefined, url: hit.url ?? undefined, thumbnailUrl: hit.thumbnailUrl ?? undefined, source, fetchedAt: hit.fetchedAt.toISOString() };

  const host = source === "wikipedia" ? "en.wikipedia.org" : "en.wikivoyage.org";
  let page: any = null;
  try {
    let pageKey = title.trim().replace(/ /g, "_");
    page = await getJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(pageKey)}`);
    if ((!page?.extract || page.type === "disambiguation") && source === "wikipedia") {
      const s = await getJson(`https://${host}/w/rest.php/v1/search/title?q=${encodeURIComponent(title)}&limit=1`);
      pageKey = s?.pages?.[0]?.key ?? "";
      if (pageKey) page = await getJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(pageKey)}`);
    }
  } catch {
    return { found: false, source, fetchedAt: new Date().toISOString() }; // degrade, don't cache failures
  }
  const found = !!page && page.type !== "disambiguation" && !!page.extract;
  const now = new Date();
  const data = found
    ? { title: page.title as string, extract: page.extract as string, url: (page.content_urls?.desktop?.page as string) ?? `https://${host}/wiki/${encodeURIComponent(page.title)}`, thumbnailUrl: page.thumbnail?.source as string | undefined }
    : { title: undefined, extract: undefined, url: undefined, thumbnailUrl: undefined };
  await prisma.placeInfoCache.upsert({
    where: { key },
    create: { key, source, found, ...data, fetchedAt: now },
    update: { found, title: data.title ?? null, extract: data.extract ?? null, url: data.url ?? null, thumbnailUrl: data.thumbnailUrl ?? null, fetchedAt: now },
  });
  return { found, ...data, source, fetchedAt: now.toISOString() };
}

export function cityTitles(title: string) {
  const city = title.split(",")[0].trim();
  const aliases: Record<string, string> = { "new york": "New York City", nyc: "New York City", washington: "Washington, D.C.", dc: "Washington, D.C." };
  return [...new Set([aliases[city.toLowerCase()] ?? city, city])];
}

/** City cards prefer sourced guides; AI is a labelled, cached last resort. */
export async function getCityInfo(title: string): Promise<PlaceInfo> {
  const titles = cityTitles(title);
  for (const source of ["wikivoyage", "wikipedia"] as const) for (const candidate of titles) {
    const result = await getPlaceInfo(candidate, source);
    if (result.found && wikiMatches(candidate, result.title ?? "", result.extract ?? "")) return result;
  }
  const key = `city-ai:${title.trim().toLowerCase()}`;
  const hit = await prisma.placeInfoCache.findUnique({ where: { key } });
  if (hit?.found && Date.now() - hit.fetchedAt.getTime() < TTL) return { found: true, title: hit.title!, extract: hit.extract!, source: "AI summary", fetchedAt: hit.fetchedAt.toISOString() };
  try {
    const result = await callJson(z.object({ summary: z.string().min(1).max(600) }), [{ role: "system", content: 'Return JSON {"summary":"..."}: a short practical city travel overview. This will be labelled AI summary. No prices, hours or availability. If you cannot confidently identify the city, explicitly say its details could not be verified and give only general planning advice; never invent attractions.' }, { role: "user", content: title }]);
    const fetchedAt = new Date(), data = { source: "AI summary", found: true, title: titles[0], extract: result.summary, fetchedAt };
    await prisma.placeInfoCache.upsert({ where: { key }, create: { key, ...data }, update: data });
    return { ...data, fetchedAt: fetchedAt.toISOString() };
  } catch { return { found: false, source: "AI summary", fetchedAt: new Date().toISOString() }; }
}
