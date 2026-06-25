import { config } from "dotenv";

// Load local env for DB-backed tests.
config({ path: ".env.local" });
