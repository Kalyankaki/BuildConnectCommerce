import "server-only";
/**
 * Storefront read queries. These run through withTenant() so RLS scopes tenant-owned
 * rows (tenant_catalog) to the active tenant; joined global catalog tables are visible
 * to all. This is the runtime path that proves data isolation on the storefront.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { products, productVariants, tenantCatalog, verticals } from "@/db/schema";

export type EnabledVertical = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  configuratorType: "unit" | "area" | "linear" | "custom";
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
