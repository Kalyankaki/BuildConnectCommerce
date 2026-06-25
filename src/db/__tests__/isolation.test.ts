/**
 * Cross-tenant isolation proof (M0 acceptance check).
 *
 * Proves that the RLS-enforced runtime role (rc_app, via withTenant) cannot read or
 * write across tenants, while the admin role (service role) can see everything.
 *
 * Requires a migrated local DB. Run:  npm run db:setup && npm run db:migrate && npm test
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "../index";
import { orders, tenants } from "../schema";

let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const [a, b] = await adminDb
    .insert(tenants)
    .values([
      { slug: `iso-a-${suffix}`, displayName: "Tenant A" },
      { slug: `iso-b-${suffix}`, displayName: "Tenant B" },
    ])
    .returning({ id: tenants.id });
  tenantA = a.id;
  tenantB = b.id;

  await adminDb.insert(orders).values([
    { tenantId: tenantA, customerEmail: "a1@example.com" },
    { tenantId: tenantA, customerEmail: "a2@example.com" },
    { tenantId: tenantB, customerEmail: "b1@example.com" },
  ]);
});

afterAll(async () => {
  // Cascades to orders.
  await adminDb.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  await closeDb();
});

describe("RLS tenant isolation", () => {
  it("tenant A's runtime sees only tenant A orders", async () => {
    const rows = await withTenant(tenantA, (tx) => tx.select().from(orders));
    expect(rows.length).toBe(2);
    expect(rows.every((r) => r.tenantId === tenantA)).toBe(true);
  });

  it("tenant B's runtime sees only tenant B orders", async () => {
    const rows = await withTenant(tenantB, (tx) => tx.select().from(orders));
    expect(rows.length).toBe(1);
    expect(rows.every((r) => r.tenantId === tenantB)).toBe(true);
  });

  it("tenant A cannot read tenant B's rows even when filtering by B's id", async () => {
    const rows = await withTenant(tenantA, (tx) =>
      tx.select().from(orders).where(eq(orders.tenantId, tenantB)),
    );
    expect(rows.length).toBe(0);
  });

  it("the admin (service) role sees all tenants' orders", async () => {
    const rows = await adminDb
      .select()
      .from(orders)
      .where(inArray(orders.tenantId, [tenantA, tenantB]));
    expect(rows.length).toBe(3);
  });

  it("tenant A cannot WRITE a row belonging to tenant B (RLS WITH CHECK)", async () => {
    await expect(
      withTenant(tenantA, (tx) =>
        tx.insert(orders).values({ tenantId: tenantB, customerEmail: "evil@example.com" }),
      ),
    ).rejects.toThrow();
  });

  it("the cross-tenant write was actually blocked (no leaked row)", async () => {
    const leaked = await adminDb
      .select()
      .from(orders)
      .where(and(eq(orders.tenantId, tenantB), eq(orders.customerEmail, "evil@example.com")));
    expect(leaked.length).toBe(0);
  });
});
