/**
 * M4 integration test — proves checkout creates an order, records the deposit, and computes
 * the fund split (platform margin) correctly via the mock payment provider, then converts the
 * cart. Exercises the real DB path end to end.
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import {
  cartItems,
  carts,
  markupPolicies,
  productVariants,
  products,
  serviceZones,
  services,
  taxRules,
  tenantCatalog,
  tenants,
  verticals,
} from "@/db/schema";
import { getOrderForTenant, placeOrderForTenant } from "@/server/order-core";
import type { Tenant } from "@/server/tenant";

const ZIP = "00002";
const TOKEN = `co-${randomUUID().slice(0, 8)}`;
let tenant: Tenant;
let verticalId: string;
let variantId: string;

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));

  const [areaV] = await adminDb
    .insert(verticals)
    .values({ slug: `co-area-${sfx}`, name: "CO Flooring", configuratorType: "area" })
    .returning();
  verticalId = areaV.id;

  const [areaP] = await adminDb
    .insert(products)
    .values({ verticalId: areaV.id, name: "CO Oak" })
    .returning();

  const [areaVar] = await adminDb
    .insert(productVariants)
    .values({ productId: areaP.id, sku: `CO-${sfx}`, unitOfMeasure: "sqft", wholesaleCents: 400, platformListCents: 600 })
    .returning();
  variantId = areaVar.id;

  await adminDb.insert(services).values([
    { verticalId: areaV.id, type: "delivery", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    { verticalId: areaV.id, type: "labor", pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    { verticalId: areaV.id, type: "haulaway", pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
  ]);
  await adminDb.insert(serviceZones).values({ zip: ZIP, deliveryFeeCents: 7500, laborMultiplierBps: 10000, leadTimeDays: 7 });
  await adminDb.insert(taxRules).values({ zip: ZIP, rateBps: 1050 });

  const [t] = await adminDb
    .insert(tenants)
    .values({ slug: `co-tenant-${sfx}`, displayName: "Checkout Co.", status: "active", coverageZips: [ZIP] })
    .returning();

  const [policy] = await adminDb
    .insert(markupPolicies)
    .values({ tenantId: t.id, name: "Std", defaultMarkupBps: 2000, perVertical: { [areaV.id]: 2500 } })
    .returning();
  const [updated] = await adminDb
    .update(tenants)
    .set({ defaultMarkupPolicyId: policy.id })
    .where(eq(tenants.id, t.id))
    .returning();
  tenant = updated;

  await adminDb.insert(tenantCatalog).values({ tenantId: t.id, variantId: areaVar.id, enabled: true });

  // Seed an active cart with one configured line (200 sqft).
  const [cart] = await adminDb
    .insert(carts)
    .values({ tenantId: t.id, sessionToken: TOKEN })
    .returning();
  await adminDb.insert(cartItems).values({
    tenantId: t.id,
    cartId: cart.id,
    variantId: areaVar.id,
    qty: 200,
    zip: ZIP,
    quoteSnapshot: { totalCents: 270000 }, // stale on purpose; order uses re-priced totals
  });
});

afterAll(async () => {
  await adminDb.delete(tenants).where(eq(tenants.id, tenant.id)); // cascades carts/items/orders/policy/catalog
  await adminDb.delete(products).where(eq(products.verticalId, verticalId));
  await adminDb.delete(verticals).where(eq(verticals.id, verticalId));
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));
  await closeDb();
});

describe("placeOrderForTenant — booking + deposit", () => {
  it("creates a booked order with deposit recorded and correct fund split", async () => {
    const res = await placeOrderForTenant(tenant, TOKEN, {
      email: "homeowner@example.com",
      name: "Homeowner",
      address: { line1: "1 Main St", city: "Lynnwood", state: "WA", zip: ZIP },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const loaded = await getOrderForTenant(tenant, res.orderId);
    expect(loaded).not.toBeNull();
    const { order, items } = loaded!;

    // Re-priced totals (200 sqft oak, 25% markup, ZIP 00002 @ 10.5% tax) = $2,734.88.
    expect(order.totalCents).toBe(273488);
    expect(order.depositCents).toBe(136744); // 50% default deposit
    expect(order.balanceCents).toBe(136744);
    expect(order.platformMarginCents).toBe(47500); // goods spread 40000 + take 7500
    expect(order.depositPaid).toBe(true);
    expect(order.status).toBe("booked");
    expect(order.paymentProvider).toBe("mock");
    expect(order.depositPaymentRef?.startsWith("mock_pi_")).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].lineTotalCents).toBe(273488);
  });

  it("converts the cart and clears its items after checkout", async () => {
    const [cart] = await adminDb
      .select()
      .from(carts)
      .where(and(eq(carts.tenantId, tenant.id), eq(carts.sessionToken, TOKEN)))
      .limit(1);
    expect(cart.status).toBe("converted");
    const remaining = await adminDb.select().from(cartItems).where(eq(cartItems.cartId, cart.id));
    expect(remaining.length).toBe(0);
  });
});
