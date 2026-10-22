import "server-only";
// The only place secrets are read. Never import this from a client component.
export const env = {
  get OPENAI_API_KEY() {
    return process.env.OPENAI_API_KEY ?? "";
  },
  get OPENAI_MODEL() {
    return process.env.OPENAI_MODEL || "gpt-4.1";
  },
  get DUFFEL_ACCESS_TOKEN() {
    return process.env.DUFFEL_ACCESS_TOKEN ?? "";
  },
  get NOMINATIM_CONTACT() {
    return process.env.NOMINATIM_CONTACT || "local dev; set NOMINATIM_CONTACT";
  },
  get CHAT_RATE_LIMIT_PER_MIN() {
    return Number(process.env.CHAT_RATE_LIMIT_PER_MIN) || 10;
  },
  get PRICE_PROVIDER() {
    return process.env.PRICE_PROVIDER ?? "";
  },
};
