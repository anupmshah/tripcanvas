import "server-only";
import { prisma } from "../db";
import { env } from "../env";

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
    if (source === "wikipedia") { // title search finds "Belém Tower" from "Belem tower" etc.
      const s = await getJson(`https://${host}/w/rest.php/v1/search/title?q=${encodeURIComponent(title)}&limit=1`);
      pageKey = s?.pages?.[0]?.key ?? "";
    }
    if (pageKey) page = await getJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(pageKey)}`);
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
