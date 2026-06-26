"use server";
/**
 * Tenant provisioning — the "fork a self-branded site" flow (B.3). Inserts a tenants row +
 * markup policy + the reseller's chosen catalog items, and the storefront goes live at
 * /store/<slug> immediately. Runs with the admin (RLS-bypass) connection.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { markupPolicies, memberships, tenantCatalog, tenants } from "@/db/schema";
import { getSession, isAuthConfigured } from "@/server/auth";
import { getTheme } from "@/lib/themes";

export type ProvisionState = { ok: boolean; error?: string; slug?: string };

const schema = z.object({
  displayName: z.string().min(1, "Storefront name is required"),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Subdomain: lowercase letters, digits, and hyphens only"),
  themeId: z.string().min(1),
  supportEmail: z.string().email().optional().or(z.literal("")),
  variantIds: z.array(z.string().uuid()).min(1, "Pick at least one product to resell"),
  markupBps: z.number().int().min(0).max(100000),
  coverageZips: z.array(z.string().regex(/^\d{3,5}$/)),
});

export async function provisionTenant(_prev: ProvisionState, formData: FormData): Promise<ProvisionState> {
  const parsed = schema.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    themeId: String(formData.get("themeId") ?? "midnight"),
    supportEmail: String(formData.get("supportEmail") ?? ""),
    variantIds: formData.getAll("variantIds").map(String),
    markupBps: Math.round(Number(formData.get("markupPercent") ?? 0) * 100),
    coverageZips: String(formData.get("coverageZips") ?? "")
      .split(",")
      .map((zip) => zip.trim())
      .filter(Boolean),
  });

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const session = await getSession();
  if (isAuthConfigured() && !session) return { ok: false, error: "Please sign in to create a storefront." };

  const existing = await adminDb
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, data.slug))
    .limit(1);
  if (existing.length > 0) return { ok: false, error: `Subdomain "${data.slug}" is already taken` };

  const theme = getTheme(data.themeId);

  const [tenant] = await adminDb
    .insert(tenants)
    .values({
      slug: data.slug,
      displayName: data.displayName,
      status: "active",
      primaryColor: theme.primary,
      secondaryColor: theme.secondary,
      supportEmail: data.supportEmail || null,
      coverageZips: data.coverageZips,
    })
    .returning();

  const [policy] = await adminDb
    .insert(markupPolicies)
    .values({ tenantId: tenant.id, name: "Standard", defaultMarkupBps: data.markupBps })
    .returning();
  await adminDb.update(tenants).set({ defaultMarkupPolicyId: policy.id }).where(eq(tenants.id, tenant.id));

  if (session) {
    await adminDb
      .insert(memberships)
      .values({ tenantId: tenant.id, userId: session.profileId, role: "reseller_owner" })
      .onConflictDoNothing();
  }

  // Enable the chosen items.
  await adminDb
    .insert(tenantCatalog)
    .values(data.variantIds.map((variantId) => ({ tenantId: tenant.id, variantId, enabled: true })))
    .onConflictDoNothing();

  return { ok: true, slug: tenant.slug };
}
