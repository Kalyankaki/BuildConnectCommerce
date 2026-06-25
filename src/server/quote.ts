"use server";
/**
 * Job quote action (B.6/B.7). Called by the configurator. Validates input, resolves the
 * tenant from the host, then delegates to computeQuoteForTenant (server-side pricing).
 */
import { z } from "zod";
import { computeQuoteForTenant, type QuoteResult } from "@/server/quote-core";
import { getCurrentTenant } from "@/server/tenant";

export type { QuoteResult };

const inputSchema = z.object({
  variantId: z.string().uuid(),
  zip: z.string().regex(/^\d{3,5}$/, "Enter a valid ZIP code"),
  quantity: z.number().int().positive("Enter a quantity greater than zero"),
});

export async function quoteJob(input: unknown): Promise<QuoteResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const tenant = await getCurrentTenant();
  if (!tenant) return { ok: false, error: "No storefront resolved for this host." };

  return computeQuoteForTenant(tenant, parsed.data);
}
