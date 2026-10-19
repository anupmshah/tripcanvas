import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
