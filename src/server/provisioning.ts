"use server";
/**
 * Tenant provisioning — the "fork a self-branded site" flow (B.3). Provisioning a tenant
 * is NOT copying code: it inserts a tenants row + markup policy + enabled catalog, and the
 * subdomain goes live immediately against the shared storefront.
 *
 * Runs with the admin (RLS-bypass) connection: it creates a brand-new tenant, so there is
 * no current_tenant context to scope to yet. Stripe Connect onboarding is stubbed (M4).
 */
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { adminDb } from "@/db";
import {
  markupPolicies,
  memberships,
  productVariants,
  products,
  tenantCatalog,
  tenants,
  verticals,
} from "@/db/schema";
import { getSession } from "@/server/auth";

export type ProvisionState = { ok: boolean; error?: string; slug?: string };

const schema = z.object({
  displayName: z.string().min(1, "Storefront name is required"),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Subdomain: lowercase letters, digits, and hyphens only"),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #b91c1c"),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().or(z.literal("")),
  supportEmail: z.string().email().optional().or(z.literal("")),
  verticalSlugs: z.array(z.string()).min(1, "Pick at least one product line"),
  markupBps: z.number().int().min(0).max(100000),
  coverageZips: z.array(z.string().regex(/^\d{3,5}$/)),
});

export async function provisionTenant(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const parsed = schema.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    primaryColor: String(formData.get("primaryColor") ?? "#0f172a"),
    secondaryColor: String(formData.get("secondaryColor") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
    verticalSlugs: formData.getAll("verticalSlugs").map(String),
    markupBps: Math.round(Number(formData.get("markupPercent") ?? 0) * 100),
    coverageZips: String(formData.get("coverageZips") ?? "")
      .split(",")
      .map((zip) => zip.trim())
      .filter(Boolean),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in to create a storefront." };

  // Subdomain must be unique.
  const existing = await adminDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, data.slug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: `Subdomain "${data.slug}" is already taken` };
  }

  // Provision: tenant -> markup policy -> catalog.
  const [tenant] = await adminDb
    .insert(tenants)
    .values({
      slug: data.slug,
      displayName: data.displayName,
      status: "active",
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor || null,
      supportEmail: data.supportEmail || null,
      coverageZips: data.coverageZips,
    })
    .returning();

  const [policy] = await adminDb
    .insert(markupPolicies)
    .values({ tenantId: tenant.id, name: "Standard", defaultMarkupBps: data.markupBps })
    .returning();

  await adminDb
    .update(tenants)
    .set({ defaultMarkupPolicyId: policy.id })
    .where(eq(tenants.id, tenant.id));

  // The creator becomes the storefront owner.
  await adminDb
    .insert(memberships)
    .values({ tenantId: tenant.id, userId: session.profileId, role: "reseller_owner" })
    .onConflictDoNothing();

  // Enable every variant in the chosen verticals.
  const variants = await adminDb
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .innerJoin(verticals, eq(products.verticalId, verticals.id))
    .where(inArray(verticals.slug, data.verticalSlugs));

  if (variants.length > 0) {
    await adminDb
      .insert(tenantCatalog)
      .values(variants.map((v) => ({ tenantId: tenant.id, variantId: v.id, enabled: true })));
  }

  // TODO(M4): kick off Stripe Connect onboarding for this tenant.

  return { ok: true, slug: tenant.slug };
}
