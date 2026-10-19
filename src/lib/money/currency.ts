export type Rates = { base: "USD"; rateDate: string; rates: Record<string, number> };
export function convert(amount: number, from: string, to: string, r: Rates | null): number | null {
  if (from === to) return amount;
  const a = r?.rates[from], b = r?.rates[to];
  return a && b ? amount / a * b : null;
}
export const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
