// Checks .env credentials without printing them. Run: npm run check-env
import { PrismaClient } from "@prisma/client";

const problems = [];
const need = (name, hint) => {
  const v = process.env[name] ?? "";
  if (!v || /USER:PASSWORD|ep-xxx/.test(v)) problems.push(`${name} is missing — ${hint}`);
  return v;
};

const key = need("OPENAI_API_KEY", "create one at platform.openai.com → API keys");
const db = need("DATABASE_URL", "a Postgres URL, e.g. a free Neon database (pooled connection)");
need("DIRECT_URL", "the direct (non-pooled) Postgres URL; for plain Postgres use the same URL");
need("NOMINATIM_CONTACT", "your email or site URL (OpenStreetMap's usage policy asks for it)");
if (db && !/[?&]schema=tripcanvas\b/.test(db))
  problems.push("DATABASE_URL and DIRECT_URL should end with &schema=tripcanvas");

if (key && !problems.some((p) => p.startsWith("OPENAI"))) {
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);
  if (!r) problems.push("OpenAI: could not reach api.openai.com");
  else if (!r.ok) problems.push(`OpenAI rejected the key (HTTP ${r.status})`);
  else console.log("ok - OpenAI key works");
}

if (db && !problems.some((p) => p.startsWith("DATABASE_URL"))) {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("ok - database reachable");
  } catch (e) {
    problems.push(`Database: could not connect (${e.constructor.name})`);
  } finally {
    await prisma.$disconnect();
  }
}

if (!process.env.DUFFEL_ACCESS_TOKEN)
  console.log("note - no DUFFEL_ACCESS_TOKEN: flights use labelled AI estimates + booking links");

if (problems.length) {
  console.error(problems.map((p) => `FAIL - ${p}`).join("\n"));
  process.exit(1);
}
console.log("ENV OK");
