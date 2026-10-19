import type { ItemDTO } from "@/lib/dto";
import { formatMoney } from "@/lib/money/currency";
export default function PriceLabel({ item, displayCurrency }: { item: ItemDTO; displayCurrency: string }) {
  const tone: Record<string, string> = { live: "bg-emerald-50 text-emerald-800", stale: "bg-amber-50 text-amber-800", estimate: "bg-violet-50 text-violet-800", entered: "bg-slate-100 text-slate-700", none: "text-slate-500" };
  const test = item.provider === "duffel-test" || item.provider === "fixture";
  return <div className={`my-1 rounded p-1 text-xs ${tone[item.label.tone]}`} title={item.priceSource === "estimate" ? "AI estimate for the whole party; verify the actual price with the provider" : undefined}>
    <span>{test ? "TEST fares — not real prices" : item.label.text}</span>
    {item.price != null && item.currency && <strong className="ml-1">{formatMoney(item.price, item.currency)}</strong>}
    {item.priceSource === "estimate" && item.priceLow != null && item.priceHigh != null && item.currency && <span> ({formatMoney(item.priceLow, item.currency)}–{formatMoney(item.priceHigh, item.currency)})</span>}
    {item.displayPrice != null && item.currency !== displayCurrency && <span> ≈ {formatMoney(item.displayPrice, displayCurrency)}</span>}
    {item.priceFetchedAt && <span className="block opacity-75">{item.priceFetchedAt.slice(0, 16).replace("T", " ")} UTC{item.label.mayHaveChanged && test ? " · may have changed" : ""}</span>}
  </div>;
}
