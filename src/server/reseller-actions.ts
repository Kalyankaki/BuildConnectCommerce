"use server";
/**
 * Reseller dashboard actions (B.10). Every action re-checks the reseller session for the
 * resolved tenant (defense in depth beyond the route-group layout guard) and writes via the
 * RLS-scoped connection where tenant-owned, or adminDb for the global tenants registry.
 */
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb, withTenant } from "@/db";
import { markupPolicies, tenantCatalog, tenants } from "@/db/schema";
import { getResellerSession } from "@/server/auth";
import { getCurrentTenant, type Tenant } from "@/server/tenant";

async function requireReseller(): Promise<Tenant> {
  const tenant = await getCurrentTenant();
  if (!tenant) redirect("/reseller/login");
  const session = await getResellerSession(tenant.id);
  if (!session) redirect("/reseller/login");
  return tenant;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export async function toggleCatalogItem(formData: FormData): Promise<void> {
  const tenant = await requireReseller();
  const variantId = z.string().uuid().safeParse(String(formData.get("variantId") ?? ""));
  if (!variantId.success) return;
  const enabled = String(formData.get("enabled") ?? "") === "true";

  await withTenant(tenant.id, async (tx) => {
    await tx
      .insert(tenantCatalog)
      .values({ tenantId: tenant.id, variantId: variantId.data, enabled })
      .onConflictDoUpdate({
        target: [tenantCatalog.tenantId, tenantCatalog.variantId],
        set: { enabled },
      });
  });
  revalidatePath("/reseller/catalog");
  revalidatePath("/");
}

export async function setVariantMarkup(formData: FormData): Promise<void> {
  const tenant = await requireReseller();
  const variantId = z.string().uuid().safeParse(String(formData.get("variantId") ?? ""));
  if (!variantId.success) return;
  const raw = String(formData.get("markupPercent") ?? "").trim();
  const markupBps = raw === "" ? null : Math.round(Number(raw) * 100);
  if (markupBps !== null && (Number.isNaN(markupBps) || markupBps < 0)) return;

  await withTenant(tenant.id, async (tx) => {
    await tx
      .insert(tenantCatalog)
      .values({ tenantId: tenant.id, variantId: variantId.data, enabled: true, markupBps })
      .onConflictDoUpdate({
        target: [tenantCatalog.tenantId, tenantCatalog.variantId],
        set: { markupBps },
      });
  });
  revalidatePath("/reseller/catalog");
  revalidatePath("/");
}

export async function setPolicyDefaultMarkup(formData: FormData): Promise<void> {
  const tenant = await requireReseller();
  const pct = Number(formData.get("defaultPercent") ?? 0);
  if (Number.isNaN(pct) || pct < 0) return;
  const bps = Math.round(pct * 100);

  await withTenant(tenant.id, async (tx) => {
    if (tenant.defaultMarkupPolicyId) {
      await tx
        .update(markupPolicies)
        .set({ defaultMarkupBps: bps })
        .where(eq(markupPolicies.id, tenant.defaultMarkupPolicyId));
    } else {
      const [p] = await tx
        .insert(markupPolicies)
        .values({ tenantId: tenant.id, name: "Standard", defaultMarkupBps: bps })
        .returning();
      await adminDb.update(tenants).set({ defaultMarkupPolicyId: p.id }).where(eq(tenants.id, tenant.id));
    }
  });
  revalidatePath("/reseller/catalog");
  revalidatePath("/");
}

const brandingSchema = z.object({
  displayName: z.string().min(1),
  primaryColor: hex,
  secondaryColor: hex.or(z.literal("")),
  font: z.string().optional().or(z.literal("")),
  logoUrl: z.string().url().or(z.literal("")),
  supportEmail: z.string().email().or(z.literal("")),
});

export async function updateBranding(formData: FormData): Promise<void> {
  const tenant = await requireReseller();
  const parsed = brandingSchema.safeParse({
    displayName: String(formData.get("displayName") ?? "").trim(),
    primaryColor: String(formData.get("primaryColor") ?? "#0f172a"),
    secondaryColor: String(formData.get("secondaryColor") ?? ""),
    font: String(formData.get("font") ?? ""),
    logoUrl: String(formData.get("logoUrl") ?? ""),
    supportEmail: String(formData.get("supportEmail") ?? ""),
  });
  if (!parsed.success) return;
  const d = parsed.data;

  await adminDb
    .update(tenants)
    .set({
      displayName: d.displayName,
      primaryColor: d.primaryColor,
      secondaryColor: d.secondaryColor || null,
      font: d.font || null,
      logoUrl: d.logoUrl || null,
      supportEmail: d.supportEmail || null,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenant.id));
  revalidatePath("/reseller/branding");
  revalidatePath("/");
}

export async function setCustomDomain(formData: FormData): Promise<void> {
  const tenant = await requireReseller();
  const domain = String(formData.get("domain") ?? "").trim().toLowerCase();
  const ok = /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain);
  if (!ok) return;
  await adminDb
    .update(tenants)
    .set({ customDomain: domain, customDomainVerified: false, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));
  revalidatePath("/reseller/domain");
}

/** DEV: mark the custom domain verified (production verifies the CNAME/TXT record). */
export async function verifyCustomDomain(): Promise<void> {
  const tenant = await requireReseller();
  if (!tenant.customDomain) return;
  await adminDb
    .update(tenants)
    .set({ customDomainVerified: true, updatedAt: new Date() })
    .where(and(eq(tenants.id, tenant.id)));
  revalidatePath("/reseller/domain");
}
