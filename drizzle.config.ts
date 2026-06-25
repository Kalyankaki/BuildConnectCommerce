import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load local env (drizzle-kit only auto-loads .env, not .env.local).
config({ path: ".env.local" });

// Migrations target MIGRATE_DATABASE_URL when set (e.g. a one-off prod/Supabase migration),
// otherwise DATABASE_URL. Because .env.local does NOT define MIGRATE_DATABASE_URL, a shell
// override of it survives drizzle-kit's auto env-injection (which clobbers DATABASE_URL).
const migrationUrl = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl!,
  },
  verbose: true,
  strict: true,
});
