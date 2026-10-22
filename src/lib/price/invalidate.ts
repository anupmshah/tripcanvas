/** A quote applies to its original schedule. Entered prices and booked items stay untouched. */
export function invalidateQuote(
  item: { status: string; priceSource: string | null },
  changed: boolean,
) {
  return changed && item.status !== "booked" && item.priceSource === "live"
    ? {
        price: null,
        priceLow: null,
        priceHigh: null,
        currency: null,
        priceSource: null,
        priceFetchedAt: null,
        offerId: null,
        sourceUrl: null,
        provider: null,
      }
    : {};
}
