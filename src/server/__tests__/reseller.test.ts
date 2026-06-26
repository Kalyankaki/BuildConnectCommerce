/**
 * M6 tests — reseller catalog/markup + revenue read logic.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import {
  markupPolicies,
  orders,
  productVariants,
  products,
  tenantCatalog,
  tenants,
  verticals,
} from "@/db/schema";
import { getCatalogForReseller, getRevenueSummary } from "@/server/reseller-data";
import type { Tenant } from "@/server/tenant";

describe("reseller catalog + revenue", () => {
  let tenant: Tenant;
  let verticalId: string;
  let v1: string;
  let v2: string;

  beforeAll(async () => {
    const sfx = randomUUID().slice(0, 8);
    const [vert] = await adminDb
      .insert(verticals)
      .values({ slug: `rs-${sfx}`, name: "RS", configuratorType: "unit" })
      .returning();
    verticalId = vert.id;
    const [prod] = await adminDb.insert(products).values({ verticalId: vert.id, name: "RS Prod" }).returning();
    const vrows = await adminDb
      .insert(productVariants)
      .values([
        { productId: prod.id, sku: `V1-${sfx}`, wholesaleCents: 8000, platformListCents: 10000 },
        { productId: prod.id, sku: `V2-${sfx}`, wholesaleCents: 8000, platformListCents: 10000 },
      ])
      .returning();
    v1 = vrows[0].id;
    v2 = vrows[1].id;

    const [t] = await adminDb
      .insert(tenants)
      .values({ slug: `rs-t-${sfx}`, displayName: "RS Co.", status: "active" })
      .returning();
    const [policy] = await adminDb
      .insert(markupPolicies)
      .values({ tenantId: t.id, name: "Std", defaultMarkupBps: 2000, perVertical: { [vert.id]: 2500 } })
      .returning();
    const [updated] = await adminDb
      .update(tenants)
      .set({ defaultMarkupPolicyId: policy.id })
      .where(eq(tenants.id, t.id))
      .returning();
    tenant = updated;

    await adminDb.insert(tenantCatalog).values([
      { tenantId: t.id, variantId: v1, enabled: true, markupBps: 1000 }, // override
      { tenantId: t.id, variantId: v2, enabled: true, markupBps: null }, // uses per-vertical
    ]);

    await adminDb.insert(orders).values({
      tenantId: t.id,
      customerEmail: "c@x.com",
      status: "booked",
      totalCents: 100000,
      platformMarginCents: 20000,
      depositPaid: true,
    });
  });

  afterAll(async () => {
    await adminDb.delete(tenants).where(eq(tenants.id, tenant.id));
    await adminDb.delete(products).where(eq(products.verticalId, verticalId));
    await adminDb.delete(verticals).where(eq(verticals.id, verticalId));
    await closeDb();
  });

  it("applies the per-variant override and the per-vertical default", async () => {
    const groups = await getCatalogForReseller(tenant);
    const rows = groups.flatMap((g) => g.rows);
    const r1 = rows.find((r) => r.variantId === v1)!;
    const r2 = rows.find((r) => r.variantId === v2)!;
    expect(r1.effectiveMarkupBps).toBe(1000); // override
    expect(r1.unitPriceCents).toBe(11000); // 10000 * 1.10
    expect(r2.effectiveMarkupBps).toBe(2500); // per-vertical
    expect(r2.unitPriceCents).toBe(12500); // 10000 * 1.25
  });

  it("summarizes booked revenue, fees, and payout", async () => {
    const rev = await getRevenueSummary(tenant);
    expect(rev.bookedRevenueCents).toBe(100000);
    expect(rev.platformFeesCents).toBe(20000);
    expect(rev.resellerPayoutCents).toBe(80000);
    expect(rev.byStatus.booked).toBe(1);
  });
});
