import "server-only";
/**
 * Storefront read queries. Tenant-owned rows (tenant_catalog, markup policy) are read via
 * withTenant() so RLS scopes them; global catalog tables (products, variants, services,
 * zones, tax) are read with the admin connection. Customer prices are computed server-side
 * with the pricing engine — never trusted from the client.
 */
import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { adminDb, withTenant } from "@/db";
import {
  products,
  productVariants,
  serviceZones,
  services,
  taxRules,
  tenantCatalog,
  verticals,
} from "@/db/schema";
import { customerUnitPrice, type ServiceInput } from "@/lib/pricing";
import { getTenantPricingContext, variantMarkupBps } from "@/server/pricing-context";
import type { Tenant } from "@/server/tenant";

export type EnabledVertical = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  configuratorType: "unit" | "area" | "linear" | "custom";
};

export type PricedVariant = {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  unitOfMeasure: string;
  unitPriceCents: number;
};

/** Verticals a tenant actively sells (has at least one enabled catalog variant). */
export const getEnabledVerticals = cache(async (tenantId: string): Promise<EnabledVertical[]> => {
  return withTenant(tenantId, async (tx) => {
    return tx
      .selectDistinct({
        id: verticals.id,
        slug: verticals.slug,
        name: verticals.name,
        icon: verticals.icon,
        configuratorType: verticals.configuratorType,
      })
      .from(tenantCatalog)
      .innerJoin(productVariants, eq(tenantCatalog.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .innerJoin(verticals, eq(products.verticalId, verticals.id))
      .where(eq(tenantCatalog.enabled, true));
  });
});

function enabledVariantIds(ctx: Awaited<ReturnType<typeof getTenantPricingContext>>): string[] {
  return [...ctx.catalogMap.entries()].filter(([, c]) => c.enabled).map(([id]) => id);
}

/** A vertical landing page: its products, each with the tenant's enabled, priced variants. */
export async function getStorefrontVertical(tenant: Tenant, slug: string) {
  const [vertical] = await adminDb.select().from(verticals).where(eq(verticals.slug, slug)).limit(1);
  if (!vertical) return null;

  const ctx = await getTenantPricingContext(tenant);
  const ids = enabledVariantIds(ctx);
  if (ids.length === 0) return null; // tenant sells nothing -> 404

  const rows = await adminDb
    .select({ product: products, variant: productVariants })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(products.verticalId, vertical.id), inArray(productVariants.id, ids)));

  const byProduct = new Map<
    string,
    { id: string; name: string; brand: string | null; defaultImageUrl: string | null; variants: PricedVariant[] }
  >();
  for (const { product, variant } of rows) {
    if (!byProduct.has(product.id)) {
      byProduct.set(product.id, {
        id: product.id,
        name: product.name,
        brand: product.brand,
        defaultImageUrl: product.defaultImageUrl,
        variants: [],
      });
    }
    byProduct.get(product.id)!.variants.push({
      id: variant.id,
      sku: variant.sku,
      attributes: variant.attributes,
      unitOfMeasure: variant.unitOfMeasure,
      unitPriceCents: customerUnitPrice(
        variant.platformListCents,
        variant.wholesaleCents,
        variantMarkupBps(ctx, vertical.id, variant.id),
      ),
    });
  }

  const productList = [...byProduct.values()];
  if (productList.length === 0) return null; // vertical not offered by this tenant -> 404
  return { vertical, products: productList };
}

/** Product detail: the product, its vertical, and the tenant's enabled priced variants. */
export async function getStorefrontProduct(tenant: Tenant, productId: string) {
  const [product] = await adminDb.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return null;
  const [vertical] = await adminDb
    .select()
    .from(verticals)
    .where(eq(verticals.id, product.verticalId))
    .limit(1);
  if (!vertical) return null;

  const ctx = await getTenantPricingContext(tenant);
  const ids = new Set(enabledVariantIds(ctx));

  const variantRows = await adminDb
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId));

  const variants: PricedVariant[] = variantRows
    .filter((v) => ids.has(v.id))
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      attributes: v.attributes,
      unitOfMeasure: v.unitOfMeasure,
      unitPriceCents: customerUnitPrice(
        v.platformListCents,
        v.wholesaleCents,
        variantMarkupBps(ctx, vertical.id, v.id),
      ),
    }));

  return { product, vertical, variants };
}

/** Delivery / labor / haulaway service inputs for a vertical (global catalog). */
export async function getVerticalServices(verticalId: string): Promise<{
  delivery: ServiceInput | null;
  labor: ServiceInput | null;
  haulaway: ServiceInput | null;
}> {
  const rows = await adminDb.select().from(services).where(eq(services.verticalId, verticalId));
  const pick = (type: "delivery" | "labor" | "haulaway"): ServiceInput | null => {
    const s = rows.find((r) => r.type === type);
    return s ? { pricingModel: s.pricingModel, baseCents: s.baseCents, perUnitCents: s.perUnitCents } : null;
  };
  return { delivery: pick("delivery"), labor: pick("labor"), haulaway: pick("haulaway") };
}

/** Zone + tax for a ZIP (global). */
export async function getZoneAndTax(zip: string) {
  const [zone] = await adminDb
    .select()
    .from(serviceZones)
    .where(and(eq(serviceZones.zip, zip), eq(serviceZones.active, true)))
    .limit(1);
  const [tax] = await adminDb.select().from(taxRules).where(eq(taxRules.zip, zip)).limit(1);
  return { zone: zone ?? null, taxRateBps: tax?.rateBps ?? 0 };
}
