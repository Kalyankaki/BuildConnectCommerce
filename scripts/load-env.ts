// Side-effect module: load .env.local BEFORE any module that reads process.env.
// Import this FIRST (import "./load-env") so it runs before hoisted imports like src/db.
import { config } from "dotenv";

config({ path: ".env.local" });
