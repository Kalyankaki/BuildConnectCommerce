/**
 * Local-only DB bootstrap (native Postgres dev setup).
 *
 * Creates, idempotently:
 *  1. the `renovateconnect` database
 *  2. the `rc_app` login role  — non-superuser, RLS ENFORCED (the runtime role)
 *  3. schema USAGE + DEFAULT PRIVILEGES so tables created later by `db:migrate`
 *     are automatically granted to `rc_app`
 *
 * Run BEFORE `db:migrate`:  npm run db:setup
 *
 * On Supabase you do NOT run this — Supabase provides anon/authenticated/service_role
 * roles already. This is purely to mirror that role model on local Postgres so the
 * cross-tenant isolation test is meaningful (superusers always bypass RLS).
 */
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

const APP_ROLE = "rc_app";
const APP_PASSWORD = "rc_app_pw"; // local dev only
const APP_DB = "renovateconnect";

async function main() {
  const bootstrapUrl = process.env.ADMIN_BOOTSTRAP_URL;
  if (!bootstrapUrl) throw new Error("Missing ADMIN_BOOTSTRAP_URL in .env.local");

  // Connect to the default `postgres` db to create our database + role.
  const root = postgres(bootstrapUrl, { max: 1 });
  try {
    const dbExists = await root`select 1 from pg_database where datname = ${APP_DB}`;
    if (dbExists.length === 0) {
      await root.unsafe(`create database ${APP_DB}`);
      console.log(`✓ created database ${APP_DB}`);
    } else {
      console.log(`• database ${APP_DB} already exists`);
    }

    const roleExists = await root`select 1 from pg_roles where rolname = ${APP_ROLE}`;
    if (roleExists.length === 0) {
      await root.unsafe(
        `create role ${APP_ROLE} with login password '${APP_PASSWORD}' nosuperuser nocreatedb nocreaterole noinherit nobypassrls`,
      );
      console.log(`✓ created role ${APP_ROLE}`);
    } else {
      console.log(`• role ${APP_ROLE} already exists`);
    }
  } finally {
    await root.end();
  }

  // Connect to the app db to set schema usage + default privileges.
  const appDbUrl = new URL(bootstrapUrl);
  appDbUrl.pathname = `/${APP_DB}`;
  const db = postgres(appDbUrl.toString(), { max: 1 });
  try {
    await db.unsafe(`grant connect on database ${APP_DB} to ${APP_ROLE}`);
    await db.unsafe(`grant usage on schema public to ${APP_ROLE}`);
    // Existing tables (if re-run after a migration).
    await db.unsafe(
      `grant select, insert, update, delete on all tables in schema public to ${APP_ROLE}`,
    );
    await db.unsafe(`grant usage, select on all sequences in schema public to ${APP_ROLE}`);
    // Future tables created by the migration owner (postgres) auto-grant to rc_app.
    await db.unsafe(
      `alter default privileges for role postgres in schema public grant select, insert, update, delete on tables to ${APP_ROLE}`,
    );
    await db.unsafe(
      `alter default privileges for role postgres in schema public grant usage, select on sequences to ${APP_ROLE}`,
    );
    console.log(`✓ granted schema/default privileges to ${APP_ROLE}`);
  } finally {
    await db.end();
  }

  console.log("\nLocal DB bootstrap complete. Next: npm run db:migrate");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
