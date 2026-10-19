import { err, json } from "@/lib/http";
import { getPlaceInfo } from "@/lib/info/wiki";

export const runtime = "nodejs";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const title = u.searchParams.get("title")?.trim(), source = u.searchParams.get("source");
  if (!title || title.length > 150 || (source !== "wikipedia" && source !== "wikivoyage")) return err(400, "title and source=wikipedia|wikivoyage required");
  return json(await getPlaceInfo(title, source));
}
