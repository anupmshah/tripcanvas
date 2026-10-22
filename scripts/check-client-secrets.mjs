import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import envPackage from "@next/env";
envPackage.loadEnvConfig(process.cwd());
const secrets = ["OPENAI_API_KEY", "DUFFEL_ACCESS_TOKEN", "DATABASE_URL", "DIRECT_URL"]
  .map((k) => process.env[k])
  .filter(Boolean);
let files = 0,
  hits = 0;
async function scan(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await scan(p);
    else {
      files++;
      const b = await readFile(p);
      if (secrets.some((s) => b.includes(Buffer.from(s)))) {
        hits++;
        console.error("Secret found in a client artifact (value withheld)");
      }
    }
  }
}
await scan(".next/static");
console.log(
  `Client secret scan: ${files} files, ${secrets.length} configured secrets, ${hits} hits`,
);
if (hits) process.exitCode = 1;
