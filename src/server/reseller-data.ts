import "server-only";
/**
 * Reseller dashboard read queries (tenant-scoped via withTenant; global catalog via adminDb).
 */
import { cache } from "react";
import { desc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { getResellerSession, type Session } from "@/server/auth";
import { getCurrentTenant } from "@/server/tenant";
import { adminDb, withTenant } from "@/db";
import {
  markupPolicies,
  memberships,
  orders,
  productVariants,
  products,
  profiles,
  tenantCatalog,
  verticals,
} from "@/db/schema";
import { customerUnitPrice } from "@/lib/pricing";
import { getTenantPricingContext, variantMarkupBps } from "@/server/pricing-context";
import type { Tenant } from "@/server/tenant";

export interface CatalogRow {
  variantId: string;
  productName: string;
  sku: string;
  attributes: Record<string, string>;
  unitOfMeasure: string;
  enabled: boolean;
  overrideBps: number | null;
  effectiveMarkupBps: number;
  unitPriceCents: number;
}

export interface CatalogGroup {
  verticalId: string;
  verticalName: string;
  rows: CatalogRow[];
}

/** Full master catalog annotated with this tenant's enable state + markup + customer price. */
export async function getCatalogForReseller(tenant: Tenant): Promise<CatalogGroup[]> {
  const ctx = await getTenantPricingContext(tenant);
  const rows = await adminDb
    .select({ variant: productVariants, product: products, vertical: verticals })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(verticals, eq(products.verticalId, verticals.id));

  const groups = new Map<string, CatalogGroup>();
  for (const { variant, product, vertical } of rows) {
    if (!groups.has(vertical.id)) {
      groups.set(vertical.id, { verticalId: vertical.id, verticalName: vertical.name, rows: [] });
    }
    const cat = ctx.catalogMap.get(variant.id);
    const effective = variantMarkupBps(ctx, vertical.id, variant.id);
    groups.get(vertical.id)!.rows.push({
      variantId: variant.id,
      productName: product.name,
      sku: variant.sku,
      attributes: variant.attributes,
      unitOfMeasure: variant.unitOfMeasure,
      enabled: cat?.enabled ?? false,
      overrideBps: cat?.markupBps ?? null,
      effectiveMarkupBps: effective,
      unitPriceCents: customerUnitPrice(variant.platformListCents, variant.wholesaleCents, effective),
    });
  }
  return [...groups.values()];
}

export async function getMarkupPolicy(tenant: Tenant) {
  if (!tenant.defaultMarkupPolicyId) return null;
  return withTenant(tenant.id, async (tx) => {
    const [p] = await tx
      .select()
      .from(markupPolicies)
      .where(eq(markupPolicies.id, tenant.defaultMarkupPolicyId!))
      .limit(1);
    return p ?? null;
  });
}

export const listOrdersForReseller = cache(async (tenant: Tenant) => {
  return withTenant(tenant.id, (tx) =>
    tx
      .select({
        id: orders.id,
        status: orders.status,
        customerEmail: orders.customerEmail,
        totalCents: orders.totalCents,
        depositPaid: orders.depositPaid,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt)),
  );
});

export interface RevenueSummary {
  bookedRevenueCents: number;
  platformFeesCents: number;
  resellerPayoutCents: number;
  orderCount: number;
  byStatus: Record<string, number>;
}

export async function getRevenueSummary(tenant: Tenant): Promise<RevenueSummary> {
  const rows = await withTenant(tenant.id, (tx) =>
    tx
      .select({
        status: orders.status,
        totalCents: orders.totalCents,
        platformMarginCents: orders.platformMarginCents,
        depositPaid: orders.depositPaid,
      })
      .from(orders),
  );
  const summary: RevenueSummary = {
    bookedRevenueCents: 0,
    platformFeesCents: 0,
    resellerPayoutCents: 0,
    orderCount: rows.length,
    byStatus: {},
  };
  for (const r of rows) {
    summary.byStatus[r.status] = (summary.byStatus[r.status] ?? 0) + 1;
    if (r.depositPaid) {
      summary.bookedRevenueCents += r.totalCents;
      summary.platformFeesCents += r.platformMarginCents;
      summary.resellerPayoutCents += r.totalCents - r.platformMarginCents;
    }
  }
  return summary;
}

/** Guard for protected reseller pages: resolves tenant + reseller session or redirects. */
export async function resellerContextOrRedirect(): Promise<{ tenant: Tenant; session: Session }> {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const session = await getResellerSession(tenant.id);
  if (!session) redirect("/login?next=/reseller");
  return { tenant, session };
}

/** Reseller memberships (for the dev login screen). */
export async function listResellerMemberships(tenant: Tenant) {
  return withTenant(tenant.id, (tx) =>
    tx
      .select({ membershipId: memberships.id, role: memberships.role, email: profiles.email, name: profiles.fullName })
      .from(memberships)
      .innerJoin(profiles, eq(profiles.id, memberships.userId))
      .where(eq(memberships.role, "reseller_owner")),
  );
}
