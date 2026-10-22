import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PriceProvider } from "./types";
import { normalizeOffers } from "./duffel";
import { flightUrls } from "./deeplink";
export class FixtureProvider implements PriceProvider {
  name = "fixture";
  async searchFlights(...args: Parameters<PriceProvider["searchFlights"]>) {
    const fixture = JSON.parse(
      await readFile(join(process.cwd(), "tests/fixtures/duffel-offers.json"), "utf8"),
    );
    return normalizeOffers(fixture, "fixture", flightUrls(...args)[0].url);
  }
}
