/**
 * Dev seed (M1). Populates the platform catalog + a demo tenant via the admin
 * (RLS-bypass) connection. Idempotent: clears seeded tables then re-inserts.
 *
 * Run:  npm run db:seed   (requires db:setup + db:migrate first)
 *
 * Seeds the two reference verticals (B.6): Flooring (Carpet→Hardwood, area) and
 * Toilets/Commodes (unit), with products, variants, services, zones, and tax rules.
 */
import "./load-env"; // must be first — loads env before src/db is imported

import { eq } from "drizzle-orm";
import { adminDb, closeDb } from "../src/db";
import {
  appointments,
  markupPolicies,
  memberships,
  orderItems,
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
} from "../src/db/schema";
import { computeJobQuote, customerUnitPrice, resolveMarkupBps } from "../src/lib/pricing";

async function clearAll() {
  // FK-safe order (children first).
  await adminDb.delete(appointments);
  await adminDb.delete(orderItems);
  await adminDb.delete(orders);
  await adminDb.delete(tenantCatalog);
  await adminDb.delete(memberships);
  await adminDb.delete(markupPolicies);
  await adminDb.delete(tenants);
  await adminDb.delete(services);
  await adminDb.delete(productVariants);
  await adminDb.delete(products);
  await adminDb.delete(verticals);
  await adminDb.delete(serviceZones);
  await adminDb.delete(taxRules);
  await adminDb.delete(profiles);
}

async function main() {
  console.log("Clearing existing seed data…");
  await clearAll();

  // ── Verticals ──────────────────────────────────────────────────────────
  const [flooring, toilets] = await adminDb
    .insert(verticals)
    .values([
      { slug: "flooring", name: "Flooring (Carpet → Hardwood)", configuratorType: "area", icon: "🪵" },
      { slug: "toilets", name: "Toilets / Commodes", configuratorType: "unit", icon: "🚽" },
    ])
    .returning();
  console.log("✓ verticals: flooring, toilets");

  // ── Products + variants ────────────────────────────────────────────────
  const [oak, maple] = await adminDb
    .insert(products)
    .values([
      { verticalId: flooring.id, name: "Oak Hardwood Plank", brand: "TimberCo", description: "5\" engineered oak plank." },
      { verticalId: flooring.id, name: "Maple Hardwood Plank", brand: "TimberCo", description: "5\" engineered maple plank." },
    ])
    .returning();

  const [toilet] = await adminDb
    .insert(products)
    .values([
      { verticalId: toilets.id, name: "AquaSave Two-Piece Toilet", brand: "PlumbPro", description: "1.28 GPF high-efficiency." },
    ])
    .returning();

  const variants = await adminDb
    .insert(productVariants)
    .values([
      // Flooring (priced per sqft)
      { productId: oak.id, sku: "OAK-NAT", attributes: { finish: "Natural" }, unitOfMeasure: "sqft", wholesaleCents: 400, platformListCents: 600 },
      { productId: oak.id, sku: "OAK-ESP", attributes: { finish: "Espresso" }, unitOfMeasure: "sqft", wholesaleCents: 450, platformListCents: 680 },
      { productId: maple.id, sku: "MPL-NAT", attributes: { finish: "Natural" }, unitOfMeasure: "sqft", wholesaleCents: 500, platformListCents: 760 },
      // Toilets (priced each)
      { productId: toilet.id, sku: "TLT-STD", attributes: { height: "Standard" }, unitOfMeasure: "each", wholesaleCents: 18000, platformListCents: 25000 },
      { productId: toilet.id, sku: "TLT-ADA", attributes: { height: "Comfort/ADA" }, unitOfMeasure: "each", wholesaleCents: 22000, platformListCents: 30000 },
    ])
    .returning();
  console.log(`✓ products + ${variants.length} variants`);

  // ── Services (delivery / labor / haulaway per vertical) ─────────────────
  await adminDb.insert(services).values([
    // Flooring — area-based labor + haulaway (remove old carpet)
    { verticalId: flooring.id, type: "delivery", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    { verticalId: flooring.id, type: "labor", pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    { verticalId: flooring.id, type: "haulaway", pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
    // Toilets — unit-based install + haulaway (old toilet)
    { verticalId: toilets.id, type: "delivery", pricingModel: "flat", baseCents: 4900, perUnitCents: 0 },
    { verticalId: toilets.id, type: "labor", pricingModel: "per_unit", baseCents: 0, perUnitCents: 18000 },
    { verticalId: toilets.id, type: "haulaway", pricingModel: "per_unit", baseCents: 0, perUnitCents: 3500 },
  ]);
  console.log("✓ services");

  // ── ZIP zones + tax (Lynnwood/Seattle WA, per the BuildConnect reference) ─
  await adminDb.insert(serviceZones).values([
    { zip: "98036", deliveryFeeCents: 7500, laborMultiplierBps: 10000, leadTimeDays: 7 },
    { zip: "98037", deliveryFeeCents: 7500, laborMultiplierBps: 11000, leadTimeDays: 10 },
    { zip: "98101", deliveryFeeCents: 9900, laborMultiplierBps: 12500, leadTimeDays: 5 },
  ]);
  await adminDb.insert(taxRules).values([
    { zip: "98036", rateBps: 1050 },
    { zip: "98037", rateBps: 1050 },
    { zip: "98101", rateBps: 1035 },
  ]);
  console.log("✓ service zones + tax rules");

  // ── Demo tenant (a reseller storefront) ─────────────────────────────────
  const [acme] = await adminDb
    .insert(tenants)
    .values([
      {
        slug: "acme",
        displayName: "Acme Remodel",
        status: "active",
        primaryColor: "#b91c1c",
        secondaryColor: "#fca5a5",
        supportEmail: "help@acmeremodel.test",
        coverageZips: ["98036", "98037", "98101"],
      },
    ])
    .returning();

  const [policy] = await adminDb
    .insert(markupPolicies)
    .values([
      { tenantId: acme.id, name: "Standard", defaultMarkupBps: 2000, perVertical: { [flooring.id]: 2500 } },
    ])
    .returning();

  await adminDb.update(tenants).set({ defaultMarkupPolicyId: policy.id }).where(eq(tenants.id, acme.id));

  // Acme sells everything.
  await adminDb.insert(tenantCatalog).values(
    variants.map((v) => ({ tenantId: acme.id, variantId: v.id, enabled: true, markupBps: null })),
  );
  console.log("✓ demo tenant 'acme' (red, all verticals)");

  // Second demo tenant: distinct brand + a narrower catalog (toilets only).
  const [northgate] = await adminDb
    .insert(tenants)
    .values([
      {
        slug: "northgate",
        displayName: "Northgate Home Co.",
        status: "active",
        primaryColor: "#1d4ed8",
        secondaryColor: "#93c5fd",
        supportEmail: "support@northgatehome.test",
        coverageZips: ["98101"],
      },
    ])
    .returning();

  const [ngPolicy] = await adminDb
    .insert(markupPolicies)
    .values([{ tenantId: northgate.id, name: "Value", defaultMarkupBps: 1500 }])
    .returning();

  await adminDb
    .update(tenants)
    .set({ defaultMarkupPolicyId: ngPolicy.id })
    .where(eq(tenants.id, northgate.id));

  const toiletVariants = variants.filter((v) => v.sku.startsWith("TLT-"));
  await adminDb.insert(tenantCatalog).values(
    toiletVariants.map((v) => ({ tenantId: northgate.id, variantId: v.id, enabled: true, markupBps: null })),
  );
  console.log("✓ demo tenant 'northgate' (blue, toilets only)");

  // An installer for acme (so jobs can be scheduled/assigned).
  const [installer] = await adminDb
    .insert(profiles)
    .values({ email: "ivan@acme.test", fullName: "Ivan Installer", phone: "+15555550100" })
    .returning();
  await adminDb.insert(memberships).values({
    tenantId: acme.id,
    userId: installer.id,
    role: "installer",
    coverageZips: ["98036", "98037", "98101"],
  });
  console.log("✓ installer 'Ivan' for acme");

  // Reseller owners (for dev sign-in to the dashboard).
  const owners = await adminDb
    .insert(profiles)
    .values([
      { email: "owner@acme.test", fullName: "Acme Owner" },
      { email: "owner@northgate.test", fullName: "Northgate Owner" },
    ])
    .returning();
  await adminDb.insert(memberships).values([
    { tenantId: acme.id, userId: owners[0].id, role: "reseller_owner" },
    { tenantId: northgate.id, userId: owners[1].id, role: "reseller_owner" },
  ]);
  console.log("✓ reseller owners for acme + northgate");

  // ── Sanity: compute a sample quote with the pricing engine ──────────────
  const oakNat = variants.find((v) => v.sku === "OAK-NAT")!;
  const markupBps = resolveMarkupBps({
    catalogOverrideBps: null,
    perVerticalBps: policy.perVertical[flooring.id] ?? null,
    defaultBps: policy.defaultMarkupBps,
  });
  const quote = computeJobQuote({
    lines: [{ platformListCents: oakNat.platformListCents, wholesaleCents: oakNat.wholesaleCents, markupBps, qty: 200 }],
    quantity: 200,
    delivery: { pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    labor: { pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    haulaway: { pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
    zone: { deliveryFeeCents: 7500, laborMultiplierBps: 10000, taxRateBps: 1050 },
    platformTakeRateBps: 500,
  });
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  console.log(
    `\nSample quote — 200 sqft OAK-NAT in ZIP 98036 (markup ${markupBps / 100}%):` +
      `\n  unit price/sqft : ${usd(customerUnitPrice(oakNat.platformListCents, oakNat.wholesaleCents, markupBps))}` +
      `\n  subtotal        : ${usd(quote.subtotalCents)}` +
      `\n  delivery        : ${usd(quote.deliveryCents)}` +
      `\n  labor (install) : ${usd(quote.laborCents)}` +
      `\n  haulaway        : ${usd(quote.haulawayCents)}` +
      `\n  tax             : ${usd(quote.taxCents)}` +
      `\n  TOTAL           : ${usd(quote.totalCents)}` +
      `\n  platform margin : ${usd(quote.platformMarginCents)}`,
  );

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
