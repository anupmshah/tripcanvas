import "server-only";
import type { PriceOffer, PriceProvider } from "./types";
import { flightUrls } from "./deeplink";
export const DUFFEL_VERSION = "v2";
export function normalizeOffers(data: any, provider: PriceOffer["provider"], deepLink: string): PriceOffer[] {
  return (data.data?.offers ?? []).filter((o: any) => o.total_amount != null && Number.isFinite(Number(o.total_amount)) && Number(o.total_amount) >= 0 && /^[A-Z]{3}$/.test(o.total_currency))
    .sort((a: any, b: any) => Number(a.total_amount) - Number(b.total_amount)).slice(0, 5).map((o: any) => ({
      provider, price: Number(o.total_amount), currency: o.total_currency, fetchedAt: new Date().toISOString(), deepLink, isLive: true,
      offerId: o.id, airline: { name: o.owner?.name ?? "Airline", iata: o.owner?.iata_code }, summary: o.owner?.name,
    }));
}
export class DuffelProvider implements PriceProvider {
  name = "duffel";
  constructor(private token: string) {}
  async searchFlights(...args: Parameters<PriceProvider["searchFlights"]>) {
    const [origin, dest, dates, travellers] = args;
    const slices = [{ origin, destination: dest, departure_date: dates.depart }];
    if (dates.return) slices.push({ origin: dest, destination: origin, departure_date: dates.return });
    const r = await fetch("https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=15000", {
      method: "POST", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${this.token}`, "Duffel-Version": DUFFEL_VERSION, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ data: { slices, passengers: [...Array.from({ length: travellers.adults }, () => ({ type: "adult" })), ...Array.from({ length: travellers.children }, () => ({ age: 10 })), ...Array.from({ length: travellers.infants ?? 0 }, () => ({ age: 1 }))], cabin_class: "economy", max_connections: 1 } }),
    });
    if (!r.ok) throw new Error(`Duffel returned HTTP ${r.status}`);
    return normalizeOffers(await r.json(), this.token.startsWith("duffel_test_") ? "duffel-test" : "duffel", flightUrls(...args)[0].url);
  }
}
