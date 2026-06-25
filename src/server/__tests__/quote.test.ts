/**
 * M3 integration test — proves a homeowner can configure BOTH reference job types and get a
 * correct, server-priced itemized quote (area + unit), plus the coverage-ZIP gate. Exercises
 * the real DB path (markup policy, catalog, services, zone, tax) via computeQuoteForTenant.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminDb, closeDb } from "@/db";
import {
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
import { computeQuoteForTenant } from "@/server/quote-core";
import type { Tenant } from "@/server/tenant";

const ZIP = "00001"; // unique test ZIP to avoid colliding with seeded zones
let tenant: Tenant;
let areaVerticalId: string;
let unitVerticalId: string;
let areaVariantId: string;
let unitVariantId: string;

beforeAll(async () => {
  const sfx = randomUUID().slice(0, 8);

  // Clean any leftovers from a previous crashed run.
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));

  const [areaV, unitV] = await adminDb
    .insert(verticals)
    .values([
      { slug: `q-area-${sfx}`, name: "Test Flooring", configuratorType: "area" },
      { slug: `q-unit-${sfx}`, name: "Test Toilets", configuratorType: "unit" },
    ])
    .returning();
  areaVerticalId = areaV.id;
  unitVerticalId = unitV.id;

  const [areaP, unitP] = await adminDb
    .insert(products)
    .values([
      { verticalId: areaV.id, name: "Test Oak" },
      { verticalId: unitV.id, name: "Test Commode" },
    ])
    .returning();

  const [areaVar, unitVar] = await adminDb
    .insert(productVariants)
    .values([
      { productId: areaP.id, sku: `AREA-${sfx}`, unitOfMeasure: "sqft", wholesaleCents: 400, platformListCents: 600 },
      { productId: unitP.id, sku: `UNIT-${sfx}`, unitOfMeasure: "each", wholesaleCents: 18000, platformListCents: 25000 },
    ])
    .returning();
  areaVariantId = areaVar.id;
  unitVariantId = unitVar.id;

  await adminDb.insert(services).values([
    { verticalId: areaV.id, type: "delivery", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    { verticalId: areaV.id, type: "labor", pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    { verticalId: areaV.id, type: "haulaway", pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
    { verticalId: unitV.id, type: "delivery", pricingModel: "flat", baseCents: 4900, perUnitCents: 0 },
    { verticalId: unitV.id, type: "labor", pricingModel: "per_unit", baseCents: 0, perUnitCents: 18000 },
    { verticalId: unitV.id, type: "haulaway", pricingModel: "per_unit", baseCents: 0, perUnitCents: 3500 },
  ]);

  await adminDb.insert(serviceZones).values({
    zip: ZIP,
    deliveryFeeCents: 7500,
    laborMultiplierBps: 10000,
    leadTimeDays: 7,
  });
  await adminDb.insert(taxRules).values({ zip: ZIP, rateBps: 1050 });

  const [t] = await adminDb
    .insert(tenants)
    .values({ slug: `q-tenant-${sfx}`, displayName: "Quote Test Co.", status: "active", coverageZips: [ZIP] })
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

  await adminDb.insert(tenantCatalog).values([
    { tenantId: t.id, variantId: areaVar.id, enabled: true },
    { tenantId: t.id, variantId: unitVar.id, enabled: true },
  ]);
});

afterAll(async () => {
  await adminDb.delete(tenants).where(eq(tenants.id, tenant.id)); // cascades policy + catalog
  // products.vertical_id is RESTRICT, so delete products (cascades variants) before verticals.
  await adminDb.delete(products).where(inArray(products.verticalId, [areaVerticalId, unitVerticalId]));
  await adminDb.delete(verticals).where(inArray(verticals.id, [areaVerticalId, unitVerticalId])); // cascades services
  await adminDb.delete(serviceZones).where(eq(serviceZones.zip, ZIP));
  await adminDb.delete(taxRules).where(eq(taxRules.zip, ZIP));
  await closeDb();
});

describe("computeQuoteForTenant — area job (Carpet→Hardwood)", () => {
  it("returns a correct itemized quote for 200 sq ft", async () => {
    const r = await computeQuoteForTenant(tenant, { variantId: areaVariantId, zip: ZIP, quantity: 200 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.configuratorType).toBe("area");
    expect(r.unitOfMeasure).toBe("sqft");
    expect(r.leadTimeDays).toBe(7);
    expect(r.quote.subtotalCents).toBe(150000); // 600*1.25 * 200
    expect(r.quote.deliveryCents).toBe(7500); // flat 0 + zone 7500
    expect(r.quote.laborCents).toBe(70000); // 350 * 200
    expect(r.quote.haulawayCents).toBe(20000); // 100 * 200
    expect(r.quote.taxCents).toBe(25988); // 247500 * 10.5%
    expect(r.quote.totalCents).toBe(273488);
    expect(r.quote.needsQuote).toBe(false);
  });
});

describe("computeQuoteForTenant — unit job (Commode)", () => {
  it("returns a correct itemized quote for 2 units", async () => {
    const r = await computeQuoteForTenant(tenant, { variantId: unitVariantId, zip: ZIP, quantity: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.configuratorType).toBe("unit");
    expect(r.unitOfMeasure).toBe("each");
    expect(r.quote.subtotalCents).toBe(60000); // 25000*1.2 * 2 (default 20% markup)
    expect(r.quote.deliveryCents).toBe(12400); // flat 4900 + zone 7500
    expect(r.quote.laborCents).toBe(36000); // 18000 * 2
    expect(r.quote.haulawayCents).toBe(7000); // 3500 * 2
    expect(r.quote.taxCents).toBe(12117); // 115400 * 10.5%
    expect(r.quote.totalCents).toBe(127517);
  });
});

describe("coverage + availability gates", () => {
  it("rejects a ZIP outside the tenant's coverage", async () => {
    const r = await computeQuoteForTenant(tenant, { variantId: areaVariantId, zip: "99999", quantity: 10 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/doesn't serve/i);
  });

  it("rejects a variant not enabled on the storefront", async () => {
    const r = await computeQuoteForTenant(tenant, { variantId: randomUUID(), zip: ZIP, quantity: 1 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/isn't available/i);
  });
});
