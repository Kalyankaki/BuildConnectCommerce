import "server-only";
/**
 * Resolves a tenant's pricing context once (markup policy + per-variant catalog overrides)
 * so storefront pages and the quote action can compute customer prices without N+1 queries.
 */
import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { markupPolicies, tenantCatalog } from "@/db/schema";
import { resolveMarkupBps } from "@/lib/pricing";
import type { Tenant } from "@/server/tenant";

export interface TenantPricingContext {
  defaultMarkupBps: number;
  perVertical: Record<string, number>;
  /** variantId -> { enabled, markupBps override (nullable) } */
  catalogMap: Map<string, { enabled: boolean; markupBps: number | null }>;
}

export async function getTenantPricingContext(tenant: Tenant): Promise<TenantPricingContext> {
  return withTenant(tenant.id, async (tx) => {
    const policyRows = tenant.defaultMarkupPolicyId
      ? await tx
          .select()
          .from(markupPolicies)
          .where(eq(markupPolicies.id, tenant.defaultMarkupPolicyId))
          .limit(1)
      : [];
    const policy = policyRows[0];

    const catalog = await tx
      .select({
        variantId: tenantCatalog.variantId,
        enabled: tenantCatalog.enabled,
        markupBps: tenantCatalog.markupBps,
      })
      .from(tenantCatalog);

    return {
      defaultMarkupBps: policy?.defaultMarkupBps ?? 0,
      perVertical: policy?.perVertical ?? {},
      catalogMap: new Map(catalog.map((c) => [c.variantId, { enabled: c.enabled, markupBps: c.markupBps }])),
    };
  });
}

/** Effective markup for a variant: catalog override → per-vertical → policy default. */
export function variantMarkupBps(
  ctx: TenantPricingContext,
  verticalId: string,
  variantId: string,
): number {
  const cat = ctx.catalogMap.get(variantId);
  return resolveMarkupBps({
    catalogOverrideBps: cat?.markupBps ?? null,
    perVerticalBps: ctx.perVertical[verticalId] ?? null,
    defaultBps: ctx.defaultMarkupBps,
  });
}
