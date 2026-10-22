import type { Db } from "./db";
import { addDays, today } from "./dates";
import { createTrip } from "./trips";

// [day, type, title, placeQuery, lat, lng, estimate low/mid/high | null, start]
type Row = [
  number,
  string,
  string,
  string,
  number,
  number,
  [number, number, number] | null,
  string | null,
];
const ROWS: Row[] = [
  [0, "flight", "Bahrain → Lisbon", "Lisbon Airport, Portugal", 38.7742, -9.1342, null, null],
  [0, "stay", "Hotel Avenida Palace", "Hotel Avenida Palace, Lisbon", 38.7149, -9.1413, null, null], // booked below
  [
    0,
    "food",
    "Time Out Market dinner",
    "Time Out Market Lisboa",
    38.7069,
    -9.1459,
    [40, 60, 90],
    "19:30",
  ],
  [1, "activity", "Belém Tower", "Torre de Belém, Lisbon", 38.6916, -9.216, [20, 24, 30], "10:00"],
  [
    1,
    "activity",
    "Jerónimos Monastery",
    "Mosteiro dos Jerónimos, Lisbon",
    38.6979,
    -9.2068,
    [20, 24, 30],
    "11:30",
  ],
  [
    1,
    "food",
    "Pastéis de Belém",
    "Pastéis de Belém, Lisbon",
    38.6975,
    -9.2032,
    [8, 12, 18],
    "13:00",
  ],
  [1, "activity", "MAAT", "MAAT, Lisbon", 38.6957, -9.1941, [20, 22, 30], "15:00"],
  [
    2,
    "activity",
    "São Jorge Castle",
    "Castelo de São Jorge, Lisbon",
    38.7139,
    -9.1335,
    [30, 30, 36],
    "10:00",
  ],
  [
    2,
    "activity",
    "Miradouro de Santa Luzia",
    "Miradouro de Santa Luzia, Lisbon",
    38.7118,
    -9.1302,
    [0, 0, 0],
    "12:30",
  ],
  [2, "activity", "Fado Museum", "Museu do Fado, Lisbon", 38.7106, -9.1281, [10, 12, 16], "15:00"],
  [
    3,
    "transport",
    "Train Lisbon → Porto",
    "Estação de Santa Apolónia, Lisbon",
    38.7146,
    -9.122,
    [60, 80, 110],
    "09:00",
  ],
  [
    3,
    "stay",
    "Hotel Infante Sagres",
    "Hotel Infante Sagres, Porto",
    41.147,
    -8.612,
    [220, 280, 360],
    null,
  ],
  [
    3,
    "activity",
    "Livraria Lello",
    "Livraria Lello, Porto",
    41.1468,
    -8.615,
    [10, 14, 20],
    "16:00",
  ],
  [
    4,
    "activity",
    "Dom Luís I Bridge walk",
    "Ponte Dom Luís I, Porto",
    41.1399,
    -8.6094,
    [0, 0, 0],
    "10:00",
  ],
  [
    4,
    "activity",
    "Taylor's Port Cellars",
    "Taylor's Port, Vila Nova de Gaia",
    41.1343,
    -8.6144,
    [30, 36, 46],
    "14:00",
  ],
  [
    4,
    "food",
    "Francesinha at Café Santiago",
    "Café Santiago, Porto",
    41.1475,
    -8.6086,
    [25, 32, 44],
    "19:30",
  ],
  [
    5,
    "flight",
    "Porto → Bahrain",
    "Francisco Sá Carneiro Airport, Porto",
    41.2481,
    -8.6814,
    null,
    null,
  ],
];

/** Fresh demo trip: Bahrain → Lisbon (3 nights) → Porto (2 nights), dates relative to today so forecasts/offers work. */
export async function createDemoTrip(db: Db) {
  await db.profile.upsert({
    where: { id: "default" },
    create: { id: "default", displayCurrency: "BHD" },
    update: {},
  });
  const start = addDays(today(), 10);
  const { trip, days } = await createTrip(db, {
    title: "Lisbon + Porto",
    originAirport: "BAH",
    startDate: start,
    adults: 2,
    children: 0,
    budgetAmount: 1500,
    budgetCurrency: "BHD",
    stops: [
      {
        city: "Lisbon",
        country: "Portugal",
        countryCode: "pt",
        lat: 38.7223,
        lng: -9.1393,
        airport: "LIS",
        localCurrency: "EUR",
        nights: 3,
      },
      {
        city: "Porto",
        country: "Portugal",
        countryCode: "pt",
        lat: 41.1496,
        lng: -8.6109,
        airport: "OPO",
        localCurrency: "EUR",
        nights: 2,
      },
    ],
  });
  const dayOf = (i: number) => days[i];
  const perDay: Record<string, number> = {};
  const now = new Date();
  for (const [d, type, title, placeQuery, lat, lng, est, start] of ROWS) {
    const day = dayOf(d);
    const order = (perDay[day.id] = (perDay[day.id] ?? -1) + 1);
    const booked = title === "Hotel Avenida Palace";
    await db.item.create({
      data: {
        tripId: trip.id,
        dayId: day.id,
        order,
        type,
        title,
        placeQuery,
        lat,
        lng,
        geoStatus: "ok",
        start,
        status: booked ? "booked" : "proposed",
        ...(booked
          ? {
              price: 620,
              currency: "EUR",
              priceSource: "entered",
              provider: "user",
              bookingRef: "DEMO-4821",
              priceFetchedAt: now,
            }
          : est
            ? {
                price: est[1],
                priceLow: est[0],
                priceHigh: est[2],
                currency: "EUR",
                priceSource: "estimate",
                provider: "llm-seed",
                priceFetchedAt: now,
              }
            : {}),
      },
    });
  }
  return trip;
}
