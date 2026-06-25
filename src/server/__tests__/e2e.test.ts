/**
 * M9 end-to-end happy path: cart → checkout (deposit) → schedule → in_progress → completed
 * (balance) → closed, all against the real DB. One test that exercises the whole B2C loop.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb, withTenant } from "@/db";
import {
  appointments,
  cartItems,
  carts,
  markupPolicies,
  memberships,
  orders,
  productVariants,
  products,
  profiles,
  serviceZones,
  services,
  taxRules,
  tenantCatalog,
  tenants,
  verticals,
} from "@/db/schema";
import { placeOrderForTenant } from "@/server/order-core";
import { scheduleOrderForTenant } from "@/server/scheduling-core";
import { transitionOrderForTenant } from "@/server/lifecycle-core";
import type { Tenant } from "@/server/tenant";

const ZIP = "00009";
const TOKEN = `e2e-${randomUUID().slice(0, 8)}`;
let tenant: Tenant;
let verticalId: string;
let installerId: string;

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));

  const [vert] = await adminDb
    .insert(verticals)
    .values({ slug: `e2e-${sfx}`, name: "E2E Flooring", configuratorType: "area" })
    .returning();
  verticalId = vert.id;
  const [prod] = await adminDb.insert(products).values({ verticalId: vert.id, name: "E2E Oak" }).returning();
  const [variant] = await adminDb
    .insert(productVariants)
    .values({ productId: prod.id, sku: `E2E-${sfx}`, unitOfMeasure: "sqft", wholesaleCents: 400, platformListCents: 600 })
    .returning();

  await adminDb.insert(services).values([
    { verticalId: vert.id, type: "delivery", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    { verticalId: vert.id, type: "labor", pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    { verticalId: vert.id, type: "haulaway", pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
  ]);
  await adminDb.insert(serviceZones).values({ zip: ZIP, deliveryFeeCents: 7500, laborMultiplierBps: 10000, leadTimeDays: 7 });
  await adminDb.insert(taxRules).values({ zip: ZIP, rateBps: 1050 });

  const [t] = await adminDb
    .insert(tenants)
    .values({ slug: `e2e-t-${sfx}`, displayName: "E2E Co.", status: "active", coverageZips: [ZIP] })
    .returning();
  const [policy] = await adminDb
    .insert(markupPolicies)
    .values({ tenantId: t.id, name: "Std", defaultMarkupBps: 2500 })
    .returning();
  const [updated] = await adminDb
    .update(tenants)
    .set({ defaultMarkupPolicyId: policy.id })
    .where(eq(tenants.id, t.id))
    .returning();
  tenant = updated;
  await adminDb.insert(tenantCatalog).values({ tenantId: t.id, variantId: variant.id, enabled: true });

  const [inst] = await adminDb
    .insert(profiles)
    .values({ email: `e2e-inst-${sfx}@t.dev`, fullName: "E2E Installer" })
    .returning();
  installerId = inst.id;
  await adminDb.insert(memberships).values({ tenantId: t.id, userId: inst.id, role: "installer", coverageZips: [ZIP] });

  // Simulate the customer's cart (what addToCart would create).
  const [cart] = await adminDb.insert(carts).values({ tenantId: t.id, sessionToken: TOKEN }).returning();
  await adminDb.insert(cartItems).values({
    tenantId: t.id,
    cartId: cart.id,
    variantId: variant.id,
    qty: 200,
    zip: ZIP,
    quoteSnapshot: { totalCents: 273488 },
  });
});

afterAll(async () => {
  await adminDb.delete(tenants).where(eq(tenants.id, tenant.id));
  await adminDb.delete(products).where(eq(products.verticalId, verticalId));
  await adminDb.delete(verticals).where(eq(verticals.id, verticalId));
  await adminDb.delete(profiles).where(eq(profiles.id, installerId));
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));
  await closeDb();
});

describe("B2C end-to-end happy path", () => {
  it("runs cart → deposit → schedule → complete → closed", async () => {
    // Checkout.
    const placed = await placeOrderForTenant(tenant, TOKEN, {
      email: "homeowner@example.com",
      name: "Homeowner",
      address: { line1: "1 Main", city: "Lynnwood", state: "WA", zip: ZIP },
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    const orderId = placed.orderId;

    // Schedule.
    const start = new Date(Date.now() + 86400000);
    const sched = await scheduleOrderForTenant(tenant, orderId, { windowStart: start, windowEnd: new Date(start.getTime() + 7200000) });
    expect(sched.ok).toBe(true);
    if (!sched.ok) return;
    expect(sched.appointmentsCreated).toBe(3);
    expect(sched.installerProfileId).toBe(installerId);

    // Fulfill.
    expect((await transitionOrderForTenant(tenant, orderId, "in_progress")).ok).toBe(true);
    expect((await transitionOrderForTenant(tenant, orderId, "completed")).ok).toBe(true);
    expect((await transitionOrderForTenant(tenant, orderId, "closed")).ok).toBe(true);

    const [order] = await withTenant(tenant.id, (tx) =>
      tx.select().from(orders).where(eq(orders.id, orderId)).limit(1),
    );
    expect(order.status).toBe("closed");
    expect(order.depositPaid).toBe(true);
    expect(order.balancePaid).toBe(true);
    expect(order.totalCents).toBe(273488);

    const appts = await withTenant(tenant.id, (tx) =>
      tx.select().from(appointments).where(eq(appointments.orderId, orderId)),
    );
    expect(appts.length).toBe(3);
  });
});
