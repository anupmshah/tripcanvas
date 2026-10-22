export type PriceOffer = {
  provider: "duffel" | "duffel-test" | "fixture" | "deeplink";
  price: number | null;
  currency: string | null;
  fetchedAt: string;
  deepLink: string;
  isLive: boolean;
  offerId?: string;
  airline?: { name: string; iata?: string };
  summary?: string;
  leg?: { origin: string; dest: string; depart: string; dayIndex: number };
};

export interface PriceProvider {
  name: string;
  searchFlights(
    origin: string,
    dest: string,
    dates: { depart: string; return?: string },
    travellers: { adults: number; children: number; infants?: number },
  ): Promise<PriceOffer[]>;
}
