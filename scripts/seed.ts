/**
 * Dev seed. Populates the shared sample catalog (~10 items/category) + demo tenants and
 * accounts. Idempotent: clears the seeded tables then re-inserts.
 *
 * Run:  npm run db:seed   (requires db:setup + db:migrate first)
 * If Supabase env is set, matching Auth users are created (password "renovate123").
 */
import "./load-env"; // must be first — loads env before src/db is imported

import { eq } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
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
import { SAMPLE_CATALOG } from "../src/server/sample-catalog";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb =
  SB_URL && SB_SERVICE
    ? createClient(SB_URL, SB_SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;
export const DEMO_PASSWORD = "renovate123";

async function ensureAuthUser(email: string): Promise<string | undefined> {
  if (!sb) return undefined;
  const created = await sb.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true });
  if (created.data?.user) return created.data.user.id;
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

type Model = "flat" | "per_unit" | "per_area" | "quote";
function svc(model: Model, cents: number): { baseCents: number; perUnitCents: number } {
  if (model === "flat") return { baseCents: cents, perUnitCents: 0 };
  if (model === "quote") return { baseCents: 0, perUnitCents: 0 };
  return { baseCents: 0, perUnitCents: cents };
}

async function clearAll() {
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

  // ── Catalog from the shared dataset ─────────────────────────────────────
  const variants: { id: string; sku: string; platformListCents: number; wholesaleCents: number; slug: string }[] = [];
  const verticalIdBySlug = new Map<string, string>();
  for (const cat of SAMPLE_CATALOG) {
    const [v] = await adminDb
      .insert(verticals)
      .values({ slug: cat.slug, name: cat.name, icon: cat.icon, configuratorType: cat.cfg })
      .returning();
    verticalIdBySlug.set(cat.slug, v.id);
    for (const it of cat.items) {
      const [p] = await adminDb.insert(products).values({ verticalId: v.id, name: it.product, brand: it.brand }).returning();
      const [variant] = await adminDb
        .insert(productVariants)
        .values({
          productId: p.id,
          sku: it.sku,
          attributes: it.attrs ?? {},
          unitOfMeasure: cat.uom,
          wholesaleCents: it.wholesaleCents,
          platformListCents: it.platformListCents,
        })
        .returning();
      variants.push({ id: variant.id, sku: variant.sku, platformListCents: variant.platformListCents, wholesaleCents: variant.wholesaleCents, slug: cat.slug });
    }
    await adminDb.insert(services).values([
      { verticalId: v.id, type: "delivery", pricingModel: cat.delivery.model, ...svc(cat.delivery.model, cat.delivery.cents) },
      { verticalId: v.id, type: "labor", pricingModel: cat.labor.model, ...svc(cat.labor.model, cat.labor.cents) },
      { verticalId: v.id, type: "haulaway", pricingModel: cat.haulaway.model, ...svc(cat.haulaway.model, cat.haulaway.cents) },
    ]);
  }
  console.log(`✓ catalog: ${SAMPLE_CATALOG.length} categories, ${variants.length} items`);

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

  const flooringVid = verticalIdBySlug.get("flooring")!;
  const flooringVariant = variants.find((v) => v.slug === "flooring")!;
  const toiletVariants = variants.filter((v) => v.slug === "toilets");

  // ── Demo tenants ────────────────────────────────────────────────────────
  const [acme] = await adminDb
    .insert(tenants)
    .values([{ slug: "acme", displayName: "Acme Remodel", status: "active", primaryColor: "#b91c1c", secondaryColor: "#fca5a5", supportEmail: "help@acmeremodel.test", coverageZips: ["98036", "98037", "98101"] }])
    .returning();
  const [policy] = await adminDb
    .insert(markupPolicies)
    .values([{ tenantId: acme.id, name: "Standard", defaultMarkupBps: 2000, perVertical: { [flooringVid]: 2500 } }])
    .returning();
  await adminDb.update(tenants).set({ defaultMarkupPolicyId: policy.id }).where(eq(tenants.id, acme.id));
  await adminDb.insert(tenantCatalog).values(variants.map((v) => ({ tenantId: acme.id, variantId: v.id, enabled: true, markupBps: null })));
  console.log("✓ tenant 'acme' (crimson, all items)");

  const [northgate] = await adminDb
    .insert(tenants)
    .values([{ slug: "northgate", displayName: "Northgate Home Co.", status: "active", primaryColor: "#1d4ed8", secondaryColor: "#93c5fd", supportEmail: "support@northgatehome.test", coverageZips: ["98101"] }])
    .returning();
  const [ngPolicy] = await adminDb.insert(markupPolicies).values([{ tenantId: northgate.id, name: "Value", defaultMarkupBps: 1500 }]).returning();
  await adminDb.update(tenants).set({ defaultMarkupPolicyId: ngPolicy.id }).where(eq(tenants.id, northgate.id));
  await adminDb.insert(tenantCatalog).values(toiletVariants.map((v) => ({ tenantId: northgate.id, variantId: v.id, enabled: true, markupBps: null })));
  console.log("✓ tenant 'northgate' (ocean, toilets only)");

  const [riverside] = await adminDb
    .insert(tenants)
    .values({ slug: "riverside", displayName: "Riverside Renovations", status: "active", primaryColor: "#166534", secondaryColor: "#86efac", coverageZips: ["98036", "98037"] })
    .returning();
  const [rsPolicy] = await adminDb.insert(markupPolicies).values({ tenantId: riverside.id, name: "Value", defaultMarkupBps: 1800 }).returning();
  await adminDb.update(tenants).set({ defaultMarkupPolicyId: rsPolicy.id }).where(eq(tenants.id, riverside.id));
  await adminDb.insert(tenantCatalog).values(variants.map((v) => ({ tenantId: riverside.id, variantId: v.id, enabled: true })));
  console.log("✓ tenant 'riverside' (forest, all items)");

  // ── People ──────────────────────────────────────────────────────────────
  const ivanId = await ensureAuthUser("ivan@acme.test");
  const [installer] = await adminDb
    .insert(profiles)
    .values({ ...withId(ivanId), email: "ivan@acme.test", fullName: "Ivan Installer", phone: "+15555550100" })
    .returning();
  await adminDb.insert(memberships).values({ tenantId: acme.id, userId: installer.id, role: "installer", coverageZips: ["98036", "98037", "98101"] });

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

  const adminId = await ensureAuthUser("admin@renovateconnect.test");
  await adminDb
    .insert(profiles)
    .values({ ...withId(adminId), email: "admin@renovateconnect.test", fullName: "Platform Admin", isPlatformAdmin: true });
  console.log("✓ installer + reseller owners + platform admin");

  // ── Sample orders for acme (first flooring item, 200 sq ft) ──────────────
  const [bookedOrder] = await adminDb
    .insert(orders)
    .values({ tenantId: acme.id, customerEmail: "jane@example.com", customerPhone: "+15555550150", status: "booked", serviceAddress: { line1: "123 Oak St", city: "Lynnwood", state: "WA", zip: "98036" }, subtotalCents: 150000, deliveryCents: 7500, laborCents: 70000, haulawayCents: 20000, taxCents: 25988, totalCents: 273488, platformMarginCents: 47500, depositCents: 136744, balanceCents: 136744, depositPaid: true, paymentProvider: "mock", depositPaymentRef: "mock_pi_seed_booked" })
    .returning();
  await adminDb.insert(orderItems).values({ tenantId: acme.id, orderId: bookedOrder.id, variantId: flooringVariant.id, qty: 200, unitPriceCents: 750, lineTotalCents: 273488 });
  await adminDb.insert(orders).values({ tenantId: acme.id, customerEmail: "mike@example.com", status: "completed", serviceAddress: { line1: "9 Pine Ave", city: "Lynnwood", state: "WA", zip: "98037" }, subtotalCents: 60000, deliveryCents: 4900, laborCents: 36000, haulawayCents: 7000, taxCents: 11339, totalCents: 119239, platformMarginCents: 17000, depositCents: 59620, balanceCents: 59619, depositPaid: true, balancePaid: true, paymentProvider: "mock", depositPaymentRef: "mock_pi_seed_dep", balancePaymentRef: "mock_pi_seed_bal" });
  console.log("✓ sample orders for acme");

  // ── Sanity quote ─────────────────────────────────────────────────────────
  const markupBps = resolveMarkupBps({ catalogOverrideBps: null, perVerticalBps: policy.perVertical[flooringVid] ?? null, defaultBps: policy.defaultMarkupBps });
  const quote = computeJobQuote({
    lines: [{ platformListCents: flooringVariant.platformListCents, wholesaleCents: flooringVariant.wholesaleCents, markupBps, qty: 200 }],
    quantity: 200,
    delivery: { pricingModel: "flat", baseCents: 0, perUnitCents: 0 },
    labor: { pricingModel: "per_area", baseCents: 0, perUnitCents: 350 },
    haulaway: { pricingModel: "per_area", baseCents: 0, perUnitCents: 100 },
    zone: { deliveryFeeCents: 7500, laborMultiplierBps: 10000, taxRateBps: 1050 },
    platformTakeRateBps: 500,
  });
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  console.log(
    `\nSample quote — 200 sqft ${flooringVariant.sku} @ ${markupBps / 100}% markup in 98036:` +
      ` unit ${usd(customerUnitPrice(flooringVariant.platformListCents, flooringVariant.wholesaleCents, markupBps))} · TOTAL ${usd(quote.totalCents)} · margin ${usd(quote.platformMarginCents)}`,
  );

  console.log("\nSeed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
