import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env (drizzle-kit only auto-loads .env, not .env.local).
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
