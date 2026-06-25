/**
 * M9 RLS coverage audit — asserts every tenant-scoped table has RLS enabled + the
 * tenant_isolation policy, and that global catalog tables do NOT have RLS. A safety net so a
 * future tenant-scoped table can't ship without isolation.
 */
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "../index";

const TENANT_SCOPED = [
  "memberships",
  "markup_policies",
  "tenant_catalog",
  "orders",
  "order_items",
  "appointments",
  "carts",
  "cart_items",
  "order_events",
];

const GLOBAL = ["products", "product_variants", "verticals", "services", "service_zones", "tax_rules", "tenants"];

afterAll(async () => {
  await closeDb();
});

async function rlsEnabled(table: string): Promise<boolean> {
  const rows = (await adminDb.execute(
    sql`select relrowsecurity as e from pg_class where relname = ${table}`,
  )) as unknown as Array<{ e: boolean }>;
  return rows[0]?.e ?? false;
}

async function hasIsolationPolicy(table: string): Promise<boolean> {
  const rows = (await adminDb.execute(
    sql`select 1 from pg_policies where tablename = ${table} and policyname = 'tenant_isolation'`,
  )) as unknown as Array<unknown>;
  return rows.length > 0;
}

describe("RLS coverage audit", () => {
  it.each(TENANT_SCOPED)("tenant-scoped table %s has RLS + isolation policy", async (table) => {
    expect(await rlsEnabled(table)).toBe(true);
    expect(await hasIsolationPolicy(table)).toBe(true);
  });

  it.each(GLOBAL)("global table %s has no RLS", async (table) => {
    expect(await rlsEnabled(table)).toBe(false);
  });
});
