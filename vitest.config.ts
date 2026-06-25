import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts"],
    // DB tests share state — run files serially to avoid cross-file races.
    fileParallelism: false,
  },
});
