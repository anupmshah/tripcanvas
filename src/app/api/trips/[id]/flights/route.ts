import { getTripDTO } from "@/lib/dto";
import { err, json } from "@/lib/http";
import { flightsForTrip } from "@/lib/price/legs";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const dto = await getTripDTO((await params).id);
  return dto ? json(await flightsForTrip(dto)) : err(404, "Trip not found");
}
