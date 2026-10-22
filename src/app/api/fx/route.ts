import { getRates } from "@/lib/money/fx";
import { convert } from "@/lib/money/currency";
import { err, json } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const to = new URL(req.url).searchParams.get("to")?.toUpperCase() ?? "BHD";
  const rates = await getRates();
  if (!rates || !rates.rates[to]) return err(503, "Rates unavailable for this currency");
  return json({
    base: rates.base,
    to,
    rateDate: rates.rateDate,
    rates: Object.fromEntries(
      Object.keys(rates.rates).map((from) => [from, convert(1, from, to, rates)]),
    ),
  });
}
