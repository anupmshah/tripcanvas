import "server-only";
import { prisma } from "../db";
import type { Rates } from "./currency";
export async function getRates(): Promise<Rates | null> {
  const hit = await prisma.fxRate.findUnique({ where: { base: "USD" } });
  const stale: Rates | null = hit ? { base: "USD", rateDate: hit.rateDate, rates: JSON.parse(hit.ratesJson) } : null;
  if (hit && Date.now() - hit.fetchedAt.getTime() < 12 * 3600_000) return stale;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return stale;
    const data = await r.json();
    if (data.result !== "success" || !data.rates?.USD) return stale;
    const rateDate = new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10);
    await prisma.fxRate.upsert({ where: { base: "USD" }, create: { base: "USD", ratesJson: JSON.stringify(data.rates), rateDate, fetchedAt: new Date() }, update: { ratesJson: JSON.stringify(data.rates), rateDate, fetchedAt: new Date() } });
    return { base: "USD", rates: data.rates, rateDate };
  } catch { return stale; }
}
