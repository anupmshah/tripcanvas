import { flightUrls } from "../price/deeplink";
import { addDays } from "../dates";
const enc = encodeURIComponent;
export function airlineSite(iata: string | undefined, name: string) {
  const sites: Record<string, string> = { GF: "gulfair.com", TP: "flytap.com", EK: "emirates.com", QR: "qatarairways.com", EY: "etihad.com", TK: "turkishairlines.com", BA: "britishairways.com", LH: "lufthansa.com", AF: "airfrance.com", KL: "klm.com", IB: "iberia.com", U2: "easyjet.com", FR: "ryanair.com" };
  return iata && sites[iata] ? `https://www.${sites[iata]}` : `https://www.google.com/search?q=${enc(`${name} official airline site`)}`;
}
export function linksForItem(item: { type: string; title: string }, day: { index: number; date: string; stopId: string }, trip: { originAirport: string; adults: number; children: number }, stops: { id: string; order: number; city: string; airport: string | null; endDate: string }[], lastDayIndex: number) {
  const stop = stops.find((s) => s.id === day.stopId)!;
  if (item.type === "flight") {
    const ret = day.index === lastDayIndex;
    const origin = ret ? stop.airport ?? stop.city : stop.order === 0 ? trip.originAirport : stops[stop.order - 1].airport ?? stops[stop.order - 1].city;
    const dest = ret ? trip.originAirport : stop.airport ?? stop.city;
    return [...flightUrls(origin, dest, { depart: day.date }, trip), { label: "Find airline site", url: `https://www.google.com/search?q=${enc(`${origin} to ${dest} airlines official site ${day.date} ${trip.adults} adults ${trip.children} children`)}` }];
  }
  if (item.type === "stay") {
    const checkout = stop.endDate > day.date ? stop.endDate : addDays(day.date, 1);
    return [
      { label: "Booking.com", url: `https://www.booking.com/searchresults.html?ss=${enc(`${item.title}, ${stop.city}`)}&checkin=${day.date}&checkout=${checkout}&group_adults=${trip.adults}&group_children=${trip.children}&no_rooms=1` },
      { label: "Airbnb", url: `https://www.airbnb.com/s/${enc(stop.city)}/homes?checkin=${day.date}&checkout=${checkout}&adults=${trip.adults}&children=${trip.children}` },
    ];
  }
  return item.type === "activity" ? [{ label: "GetYourGuide", url: `https://www.getyourguide.com/s/?q=${enc(`${item.title} ${stop.city}`)}&date_from=${day.date}&date_to=${day.date}&adults=${trip.adults}&children=${trip.children}` }] : [];
}
