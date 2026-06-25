import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Map "@/..." -> src/... (only the prefix, so scoped packages like @next/* are safe).
      { find: /^@\//, replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
      // Stub the `server-only` guard so server modules import cleanly under Node tests.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // DB tests share state — run files serially to avoid cross-file races.
    fileParallelism: false,
  },
});
