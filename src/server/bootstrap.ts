import "server-only";
/**
 * Auto-bootstrap the sample catalog so the app is usable on a fresh/empty database (e.g. a
 * newly deployed Supabase). Runs only when there are zero verticals — a no-op otherwise.
 * Uses the shared SAMPLE_CATALOG dataset. For a full reseed use `npm run db:seed`.
 */
import { sql } from "drizzle-orm";
import { adminDb } from "@/db";
import { productVariants, products, serviceZones, services, taxRules, verticals } from "@/db/schema";
import { SAMPLE_CATALOG } from "@/server/sample-catalog";

type Model = "flat" | "per_unit" | "per_area" | "quote";
function svc(model: Model, cents: number): { baseCents: number; perUnitCents: number } {
  if (model === "flat") return { baseCents: cents, perUnitCents: 0 };
  if (model === "quote") return { baseCents: 0, perUnitCents: 0 };
  return { baseCents: 0, perUnitCents: cents };
}

let attempted = false;

export async function ensureSampleCatalog(): Promise<void> {
  if (attempted) return;
  attempted = true;

  const [{ count }] = await adminDb.select({ count: sql<number>`count(*)::int` }).from(verticals);
  if (Number(count) > 0) return;

  for (const cat of SAMPLE_CATALOG) {
    const [v] = await adminDb
      .insert(verticals)
      .values({ slug: cat.slug, name: cat.name, icon: cat.icon, configuratorType: cat.cfg })
      .onConflictDoNothing()
      .returning();
    if (!v) continue;

    for (const it of cat.items) {
      const [p] = await adminDb
        .insert(products)
        .values({ verticalId: v.id, name: it.product, brand: it.brand })
        .returning();
      await adminDb
        .insert(productVariants)
        .values({
          productId: p.id,
          sku: it.sku,
          attributes: it.attrs ?? {},
          unitOfMeasure: cat.uom,
          wholesaleCents: it.wholesaleCents,
          platformListCents: it.platformListCents,
        })
        .onConflictDoNothing();
    }

    await adminDb.insert(services).values([
      { verticalId: v.id, type: "delivery", pricingModel: cat.delivery.model, ...svc(cat.delivery.model, cat.delivery.cents) },
      { verticalId: v.id, type: "labor", pricingModel: cat.labor.model, ...svc(cat.labor.model, cat.labor.cents) },
      { verticalId: v.id, type: "haulaway", pricingModel: cat.haulaway.model, ...svc(cat.haulaway.model, cat.haulaway.cents) },
    ]);
  }

  await adminDb
    .insert(serviceZones)
    .values([
      { zip: "98036", deliveryFeeCents: 7500, laborMultiplierBps: 10000, leadTimeDays: 7 },
      { zip: "98101", deliveryFeeCents: 9900, laborMultiplierBps: 12500, leadTimeDays: 5 },
    ])
    .onConflictDoNothing();
  await adminDb
    .insert(taxRules)
    .values([
      { zip: "98036", rateBps: 1050 },
      { zip: "98101", rateBps: 1035 },
    ])
    .onConflictDoNothing();
}
