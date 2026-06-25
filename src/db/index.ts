/**
 * Database clients.
 *
 * Two connections, by design:
 *  - `adminDb`  — connects as a superuser/service role that BYPASSES RLS. Use ONLY in
 *                 platform-admin server actions, migrations, and seeding.
 *  - `appDb`    — connects as a non-superuser role with RLS ENFORCED. All tenant-scoped
 *                 runtime queries go through `withTenant()`, which sets the per-request
 *                 tenant id so RLS policies can isolate rows.
 *
 * This mirrors the Supabase model (service_role bypasses RLS; anon/authenticated do not),
 * so the same code works against Supabase later with different connection strings.
 *
 * NOTE: not marked "server-only" so it stays importable from Vitest (node). Never import
 * this module from a Client Component — tenant-scoped DB access is server-only by convention.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// Reuse clients across hot-reloads in dev to avoid exhausting connections.
const globalForDb = globalThis as unknown as {
  __adminClient?: ReturnType<typeof postgres>;
  __appClient?: ReturnType<typeof postgres>;
};

const adminClient =
  globalForDb.__adminClient ?? postgres(required("DATABASE_URL"), { max: 5 });
const appClient =
  globalForDb.__appClient ?? postgres(required("APP_DATABASE_URL"), { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__adminClient = adminClient;
  globalForDb.__appClient = appClient;
}

/** RLS-bypassing client. Admin/service/migration use only. */
export const adminDb = drizzle(adminClient, { schema });

/** RLS-enforced client. Do not query tenant-scoped tables directly — use withTenant(). */
export const appDb = drizzle(appClient, { schema });

export type AppDb = typeof appDb;
export type TenantTx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

/**
 * Run a callback inside a transaction scoped to a single tenant. Sets
 * `app.current_tenant` (transaction-local) so RLS policies isolate rows.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return appDb.transaction(async (tx) => {
    // set_config(..., true) => local to this transaction only.
    await tx.execute(sql`select set_config('app.current_tenant', ${tenantId}, true)`);
    return callback(tx);
  });
}

/** Close both pooled connections (used by tests / scripts to exit cleanly). */
export async function closeDb(): Promise<void> {
  await Promise.all([adminClient.end(), appClient.end()]);
}

export { schema };
