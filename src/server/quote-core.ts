import "server-only";
/**
 * Core quote computation (server-only, no request context). quoteJob() resolves the tenant
 * from the host then delegates here; tests call this directly with a tenant. Recomputes the
 * full bundle price SERVER-SIDE from catalog + zone + tenant markup (B.7) and enforces the
 * coverage-ZIP gate.
 */
import { eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { productVariants, products, verticals } from "@/db/schema";
import { computeJobQuote, type JobQuote } from "@/lib/pricing";
import { getTenantPricingContext, variantMarkupBps } from "@/server/pricing-context";
import { getVerticalServices, getZoneAndTax } from "@/server/storefront";
import type { Tenant } from "@/server/tenant";

export type QuoteInput = { variantId: string; zip: string; quantity: number };

export type QuoteResult =
  | {
      ok: true;
      quote: JobQuote;
      leadTimeDays: number;
      unitOfMeasure: string;
      configuratorType: "unit" | "area" | "linear" | "custom";
    }
  | { ok: false; error: string };

export async function computeQuoteForTenant(
  tenant: Tenant,
  { variantId, zip, quantity }: QuoteInput,
): Promise<QuoteResult> {
  // Coverage-ZIP gate (B.12).
  if (tenant.coverageZips.length > 0 && !tenant.coverageZips.includes(zip)) {
    return { ok: false, error: `${tenant.displayName} doesn't serve ZIP ${zip} yet.` };
  }

  const ctx = await getTenantPricingContext(tenant);
  if (!ctx.catalogMap.get(variantId)?.enabled) {
    return { ok: false, error: "That product isn't available on this storefront." };
  }

  const [variant] = await adminDb
    .select()
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);
  if (!variant) return { ok: false, error: "Product not found." };

  const [product] = await adminDb
    .select()
    .from(products)
    .where(eq(products.id, variant.productId))
    .limit(1);
  const [vertical] = await adminDb
    .select()
    .from(verticals)
    .where(eq(verticals.id, product!.verticalId))
    .limit(1);

  const { zone, taxRateBps } = await getZoneAndTax(zip);
  if (!zone) return { ok: false, error: `No delivery zone configured for ZIP ${zip}.` };

  const svc = await getVerticalServices(vertical.id);
  const takeRateBps = tenant.platformTakeRateBps ?? Number(process.env.PLATFORM_TAKE_RATE_BPS ?? 500);

  const quote = computeJobQuote({
    lines: [
      {
        platformListCents: variant.platformListCents,
        wholesaleCents: variant.wholesaleCents,
        markupBps: variantMarkupBps(ctx, vertical.id, variant.id),
        qty: quantity,
      },
    ],
    quantity,
    delivery: svc.delivery,
    labor: svc.labor,
    haulaway: svc.haulaway,
    zone: { deliveryFeeCents: zone.deliveryFeeCents, laborMultiplierBps: zone.laborMultiplierBps, taxRateBps },
    platformTakeRateBps: takeRateBps,
  });

  return {
    ok: true,
    quote,
    leadTimeDays: zone.leadTimeDays,
    unitOfMeasure: variant.unitOfMeasure,
    configuratorType: vertical.configuratorType,
  };
}
