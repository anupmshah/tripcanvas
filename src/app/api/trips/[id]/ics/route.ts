import { getTripDTO } from "@/lib/dto";
import { makeIcs } from "@/lib/export/ics";
import { err } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id, dto = await getTripDTO(id);
  if (!dto) return err(404, "Trip not found");
  return new Response(makeIcs(dto), { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="tripcanvas-${id}.ics"` } });
}
