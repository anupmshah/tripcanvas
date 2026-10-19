import type { PriceOffer, PriceProvider } from "./types";
export function flightUrls(origin: string, dest: string, dates: { depart: string; return?: string }, travellers: { adults: number; children: number }) {
  const q = `Flights from ${origin} to ${dest} on ${dates.depart}${dates.return ? ` returning ${dates.return}` : " one way"} for ${travellers.adults} adults and ${travellers.children} children`;
  const short = (d: string) => d.slice(2).replaceAll("-", "");
  return [
    { label: "Google Flights", url: `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}` },
    { label: "Skyscanner", url: `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${short(dates.depart)}/${dates.return ? short(dates.return) + "/" : ""}?adultsv2=${travellers.adults}&childrenv2=${Array(travellers.children).fill(10).join("%7C")}&cabinclass=economy` },
  ];
}
export class DeepLinkProvider implements PriceProvider {
  name = "deeplink";
  async searchFlights(...args: Parameters<PriceProvider["searchFlights"]>): Promise<PriceOffer[]> {
    return flightUrls(...args).map((l) => ({ provider: "deeplink", price: null, currency: null, fetchedAt: new Date().toISOString(), deepLink: l.url, isLive: false, summary: l.label }));
  }
}
