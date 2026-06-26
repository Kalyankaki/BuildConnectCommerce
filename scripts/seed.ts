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
import { createClient } from "@supabase/supabase-js";

// If Supabase is configured, create matching Auth users so the demo accounts can log in.
// Profile rows are keyed by the auth user id (see src/server/auth.ts).
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb =
  SB_URL && SB_SERVICE
    ? createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
export const DEMO_PASSWORD = "renovate123";

async function ensureAuthUser(email: string): Promise<string | undefined> {
  if (!sb) return undefined; // no Supabase configured → DB generates a random profile id
  const created = await sb.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (created.data?.user) return created.data.user.id;
  // Already exists — find it.
  for (let page = 1; page <= 10; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const found = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (!data || data.users.length < 200) break;
  }
  if (created.error) console.warn(`auth user ${email}: ${created.error.message}`);
  return undefined;
}

function withId(id: string | undefined) {
  return id ? { id } : {};
}

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

  // ── Extra sample product lines (for testing variety) ────────────────────
  const [sinks, panels, blindsV, island] = await adminDb
    .insert(verticals)
    .values([
      { slug: "sinks", name: "Sinks", configuratorType: "unit", icon: "🚰" },
      { slug: "panels", name: "Decorative Wall Panels", configuratorType: "area", icon: "🧱" },
      { slug: "blinds", name: "Blinds", configuratorType: "unit", icon: "🪟" },
      { slug: "kitchen-island", name: "Kitchen Island", configuratorType: "unit", icon: "🍽️" },
    ])
    .returning();

  const [sinkP, panelP, blindP, islandP] = await adminDb
    .insert(products)
    .values([
      { verticalId: sinks.id, name: "Undermount Quartz Sink", brand: "BasinWorks" },
      { verticalId: panels.id, name: "Acoustic Slat Panel", brand: "WallCraft" },
      { verticalId: blindsV.id, name: "Motorized Roller Blind", brand: "Lumina" },
      { verticalId: island.id, name: "Quartz-Top Kitchen Island", brand: "BuildCo" },
    ])
    .returning();

  const more = await adminDb
    .insert(productVariants)
    .values([
      { productId: sinkP.id, sku: "SNK-STD", attributes: { material: "Quartz" }, unitOfMeasure: "each", wholesaleCents: 9000, platformListCents: 14000 },
      { productId: sinkP.id, sku: "SNK-DBL", attributes: { material: "Quartz", bowls: "Double" }, unitOfMeasure: "each", wholesaleCents: 13000, platformListCents: 19000 },
      { productId: panelP.id, sku: "PNL-OAK", attributes: { finish: "Oak" }, unitOfMeasure: "sqft", wholesaleCents: 550, platformListCents: 900 },
      { productId: panelP.id, sku: "PNL-WAL", attributes: { finish: "Walnut" }, unitOfMeasure: "sqft", wholesaleCents: 650, platformListCents: 1050 },
      { productId: blindP.id, sku: "BLN-RLR", attributes: { type: "Roller" }, unitOfMeasure: "each", wholesaleCents: 9000, platformListCents: 15000 },
      { productId: islandP.id, sku: "ISL-WTF", attributes: { edge: "Waterfall" }, unitOfMeasure: "each", wholesaleCents: 160000, platformListCents: 240000 },
    ])
    .returning();
  variants.push(...more); // include in the demo tenants' catalogs below

  await adminDb.insert(services).values([
    // Sinks (unit)
    { verticalId: sinks.id, type: "delivery", pricingModel: "flat", baseCents: 3900, perUnitCents: 0 },
    { verticalId: sinks.id, type: "labor", pricingModel: "per_unit", baseCents: 0, perUnitCents: 16000 },
    { verticalId: sinks.id, type: "haulaway", pricingModel: "per_unit", baseCents: 0, perUnitCents: 3000 },
    // Decorative panels (area)
    { verticalId: panels.id, type: "delivery", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    { verticalId: panels.id, type: "labor", pricingModel: "per_area", baseCents: 0, perUnitCents: 600 },
    { verticalId: panels.id, type: "haulaway", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    // Blinds (unit)
    { verticalId: blindsV.id, type: "delivery", pricingModel: "flat", baseCents: 1900, perUnitCents: 0 },
    { verticalId: blindsV.id, type: "labor", pricingModel: "per_unit", baseCents: 0, perUnitCents: 6000 },
    { verticalId: blindsV.id, type: "haulaway", pricingModel: "per_unit", baseCents: 0, perUnitCents: 1500 },
    // Kitchen island (unit; labor = quote after a site visit)
    { verticalId: island.id, type: "delivery", pricingModel: "flat", baseCents: 14900, perUnitCents: 0 },
    { verticalId: island.id, type: "labor", pricingModel: "quote", baseCents: 0, perUnitCents: 0 },
    { verticalId: island.id, type: "haulaway", pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
  ]);
  console.log("✓ extra product lines: sinks, panels, blinds, kitchen-island");

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
  const ivanId = await ensureAuthUser("ivan@acme.test");
  const [installer] = await adminDb
    .insert(profiles)
    .values({ ...withId(ivanId), email: "ivan@acme.test", fullName: "Ivan Installer", phone: "+15555550100" })
    .returning();
  await adminDb.insert(memberships).values({
    tenantId: acme.id,
    userId: installer.id,
    role: "installer",
    coverageZips: ["98036", "98037", "98101"],
  });
  console.log("✓ installer 'Ivan' for acme");

  // Reseller owners (for dev sign-in to the dashboard).
  const acmeOwnerId = await ensureAuthUser("owner@acme.test");
  const ngOwnerId = await ensureAuthUser("owner@northgate.test");
  const owners = await adminDb
    .insert(profiles)
    .values([
      { ...withId(acmeOwnerId), email: "owner@acme.test", fullName: "Acme Owner" },
      { ...withId(ngOwnerId), email: "owner@northgate.test", fullName: "Northgate Owner" },
    ])
    .returning();
  await adminDb.insert(memberships).values([
    { tenantId: acme.id, userId: owners[0].id, role: "reseller_owner" },
    { tenantId: northgate.id, userId: owners[1].id, role: "reseller_owner" },
  ]);
  console.log("✓ reseller owners for acme + northgate");

  // Platform super-admin (apex host).
  const adminId = await ensureAuthUser("admin@renovateconnect.test");
  await adminDb
    .insert(profiles)
    .values({ ...withId(adminId), email: "admin@renovateconnect.test", fullName: "Platform Admin", isPlatformAdmin: true });
  console.log("✓ platform admin");

  // Third demo tenant (green, all verticals).
  const [riverside] = await adminDb
    .insert(tenants)
    .values({
      slug: "riverside",
      displayName: "Riverside Renovations",
      status: "active",
      primaryColor: "#047857",
      secondaryColor: "#6ee7b7",
      coverageZips: ["98036", "98037"],
    })
    .returning();
  const [rsPolicy] = await adminDb
    .insert(markupPolicies)
    .values({ tenantId: riverside.id, name: "Value", defaultMarkupBps: 1800 })
    .returning();
  await adminDb.update(tenants).set({ defaultMarkupPolicyId: rsPolicy.id }).where(eq(tenants.id, riverside.id));
  await adminDb
    .insert(tenantCatalog)
    .values(variants.map((v) => ({ tenantId: riverside.id, variantId: v.id, enabled: true })));
  console.log("✓ demo tenant 'riverside' (green, all verticals)");

  // Sample orders for acme so dashboards/reporting show data.
  const oakNatV = variants.find((v) => v.sku === "OAK-NAT")!;
  const [bookedOrder] = await adminDb
    .insert(orders)
    .values({
      tenantId: acme.id,
      customerEmail: "jane@example.com",
      customerPhone: "+15555550150",
      status: "booked",
      serviceAddress: { line1: "123 Oak St", city: "Lynnwood", state: "WA", zip: "98036" },
      subtotalCents: 150000,
      deliveryCents: 7500,
      laborCents: 70000,
      haulawayCents: 20000,
      taxCents: 25988,
      totalCents: 273488,
      platformMarginCents: 47500,
      depositCents: 136744,
      balanceCents: 136744,
      depositPaid: true,
      paymentProvider: "mock",
      depositPaymentRef: "mock_pi_seed_booked",
    })
    .returning();
  await adminDb.insert(orderItems).values({
    tenantId: acme.id,
    orderId: bookedOrder.id,
    variantId: oakNatV.id,
    qty: 200,
    unitPriceCents: 750,
    lineTotalCents: 273488,
  });

  await adminDb.insert(orders).values({
    tenantId: acme.id,
    customerEmail: "mike@example.com",
    status: "completed",
    serviceAddress: { line1: "9 Pine Ave", city: "Lynnwood", state: "WA", zip: "98037" },
    subtotalCents: 60000,
    deliveryCents: 4900,
    laborCents: 36000,
    haulawayCents: 7000,
    taxCents: 11339,
    totalCents: 119239,
    platformMarginCents: 17000,
    depositCents: 59620,
    balanceCents: 59619,
    depositPaid: true,
    balancePaid: true,
    paymentProvider: "mock",
    depositPaymentRef: "mock_pi_seed_dep",
    balancePaymentRef: "mock_pi_seed_bal",
  });
  console.log("✓ sample orders for acme");

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
