/**
 * RLS isolation for the M4 tenant-scoped tables (carts). Same guarantee as the orders test:
 * the runtime role can't read or write another tenant's carts.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "../index";
import { carts, tenants } from "../schema";

let tenantA: string;
let tenantB: string;

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);
  const [a, b] = await adminDb
    .insert(tenants)
    .values([
      { slug: `cart-a-${sfx}`, displayName: "Cart A" },
      { slug: `cart-b-${sfx}`, displayName: "Cart B" },
    ])
    .returning({ id: tenants.id });
  tenantA = a.id;
  tenantB = b.id;

  await adminDb.insert(carts).values([
    { tenantId: tenantA, sessionToken: `tok-a-${sfx}` },
    { tenantId: tenantB, sessionToken: `tok-b-${sfx}` },
  ]);
});

afterAll(async () => {
  await adminDb.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  await closeDb();
});

describe("carts RLS isolation", () => {
  it("a tenant sees only its own carts", async () => {
    const rows = await withTenant(tenantA, (tx) => tx.select().from(carts));
    expect(rows.length).toBe(1);
    expect(rows[0].tenantId).toBe(tenantA);
  });

  it("a tenant cannot read another tenant's carts by id filter", async () => {
    const rows = await withTenant(tenantA, (tx) =>
      tx.select().from(carts).where(eq(carts.tenantId, tenantB)),
    );
    expect(rows.length).toBe(0);
  });

  it("a tenant cannot create a cart for another tenant (WITH CHECK)", async () => {
    await expect(
      withTenant(tenantA, (tx) =>
        tx.insert(carts).values({ tenantId: tenantB, sessionToken: "evil" }),
      ),
    ).rejects.toThrow();
  });
});
