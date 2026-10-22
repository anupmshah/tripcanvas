export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
let stage = "?";
export const setStage = (s) => {
  stage = s;
  console.log(`\n=== ${s} (${BASE_URL}) ===`);
};
export function assert(cond, msg) {
  if (!cond) {
    console.error(`SMOKE FAIL [${stage}]: ${msg}`);
    process.exit(1);
  }
  console.log(`  ok - ${msg}`);
}
/** fetch + parse JSON. Returns {status, data, res}. */
export async function j(path, opts = {}) {
  const res = await fetch(BASE_URL + path, {
    ...opts,
    headers: { ...(opts.body ? { "Content-Type": "application/json" } : {}), ...opts.headers },
    body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, res };
}
export async function newDemoTrip() {
  const r = await j("/api/dev/demo", { method: "POST" });
  assert(r.status === 200 && r.data.id, "created demo trip");
  const t = await j(`/api/trips/${r.data.id}`);
  return { id: r.data.id, dto: t.data };
}
export const items = (dto) => dto.days.flatMap((d) => d.items);
export const findItem = (dto, title) => items(dto).find((i) => i.title === title);
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
