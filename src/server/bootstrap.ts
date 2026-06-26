import "server-only";
/**
 * Auto-bootstrap a sample catalog so the app is usable on a fresh/empty database (e.g. a newly
 * deployed Supabase). Runs only when there are zero verticals — a no-op otherwise. Idempotent
 * via unique slugs/SKUs. For a richer dataset use `npm run db:seed`.
 */
import { sql } from "drizzle-orm";
import { adminDb } from "@/db";
import { productVariants, products, serviceZones, services, taxRules, verticals } from "@/db/schema";

type Cfg = "unit" | "area" | "linear" | "custom";

interface SampleLine {
  slug: string;
  name: string;
  icon: string;
  cfg: Cfg;
  uom: string;
  product: string;
  brand: string;
  sku: string;
  wholesaleCents: number;
  platformListCents: number;
  laborModel: "per_unit" | "per_area" | "quote";
  laborCents: number;
  deliveryCents: number;
  haulModel: "per_unit" | "per_area" | "flat";
  haulCents: number;
}

const SAMPLE: SampleLine[] = [
  { slug: "flooring", name: "Flooring (Carpet → Hardwood)", icon: "🪵", cfg: "area", uom: "sqft", product: "Oak Hardwood Plank", brand: "TimberCo", sku: "OAK-NAT", wholesaleCents: 400, platformListCents: 600, laborModel: "per_area", laborCents: 350, deliveryCents: 0, haulModel: "per_area", haulCents: 100 },
  { slug: "tiles", name: "Tile Flooring", icon: "◻️", cfg: "area", uom: "sqft", product: "Porcelain Tile", brand: "StoneWorks", sku: "TILE-MAT", wholesaleCents: 300, platformListCents: 520, laborModel: "per_area", laborCents: 420, deliveryCents: 0, haulModel: "per_area", haulCents: 120 },
  { slug: "toilets", name: "Toilets / Commodes", icon: "🚽", cfg: "unit", uom: "each", product: "AquaSave Two-Piece Toilet", brand: "PlumbPro", sku: "TLT-STD", wholesaleCents: 18000, platformListCents: 25000, laborModel: "per_unit", laborCents: 18000, deliveryCents: 4900, haulModel: "per_unit", haulCents: 3500 },
  { slug: "sinks", name: "Sinks", icon: "🚰", cfg: "unit", uom: "each", product: "Undermount Quartz Sink", brand: "BasinWorks", sku: "SNK-STD", wholesaleCents: 9000, platformListCents: 14000, laborModel: "per_unit", laborCents: 16000, deliveryCents: 3900, haulModel: "per_unit", haulCents: 3000 },
  { slug: "windows", name: "Windows", icon: "🪟", cfg: "unit", uom: "each", product: "Double-Pane Vinyl Window", brand: "ClearView", sku: "WIN-DBL", wholesaleCents: 22000, platformListCents: 32000, laborModel: "per_unit", laborCents: 22000, deliveryCents: 5900, haulModel: "per_unit", haulCents: 4000 },
  { slug: "kitchen-island", name: "Kitchen Island", icon: "🍽️", cfg: "unit", uom: "each", product: "Quartz-Top Kitchen Island", brand: "BuildCo", sku: "ISL-WTF", wholesaleCents: 160000, platformListCents: 240000, laborModel: "quote", laborCents: 0, deliveryCents: 14900, haulModel: "flat", haulCents: 0 },
];

let attempted = false;

export async function ensureSampleCatalog(): Promise<void> {
  if (attempted) return;
  attempted = true;

  const [{ count }] = await adminDb
    .select({ count: sql<number>`count(*)::int` })
    .from(verticals);
  if (Number(count) > 0) return;

  for (const s of SAMPLE) {
    const [v] = await adminDb
      .insert(verticals)
      .values({ slug: s.slug, name: s.name, icon: s.icon, configuratorType: s.cfg })
      .onConflictDoNothing()
      .returning();
    if (!v) continue;

    const [p] = await adminDb.insert(products).values({ verticalId: v.id, name: s.product, brand: s.brand }).returning();
    await adminDb
      .insert(productVariants)
      .values({ productId: p.id, sku: s.sku, unitOfMeasure: s.uom, wholesaleCents: s.wholesaleCents, platformListCents: s.platformListCents })
      .onConflictDoNothing();

    await adminDb.insert(services).values([
      { verticalId: v.id, type: "delivery", pricingModel: "flat", baseCents: s.deliveryCents, perUnitCents: 0 },
      { verticalId: v.id, type: "labor", pricingModel: s.laborModel, baseCents: 0, perUnitCents: s.laborCents },
      { verticalId: v.id, type: "haulaway", pricingModel: s.haulModel, baseCents: 0, perUnitCents: s.haulCents },
    ]);
  }

  // Minimal delivery zones + tax so quotes work out of the box.
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
