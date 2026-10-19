import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const files = readdirSync(new URL(".", import.meta.url)).filter((f) => /^smoke-stage\d+\.mjs$/.test(f)).sort();
for (const f of files) {
  const r = spawnSync(process.execPath, [new URL(f, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`\n${f} FAILED`); process.exit(1); }
}
console.log(`\nALL ${files.length} SMOKE SCRIPTS PASSED`);
