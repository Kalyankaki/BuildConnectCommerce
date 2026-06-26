"use server";
/**
 * Platform-admin actions (B.11). All guarded by a platform_admin session and executed via the
 * admin (service-role) connection. Money inputs are in integer CENTS.
 */
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminDb } from "@/db";
import {
  productVariants,
  products,
  serviceZones,
  services,
  taxRules,
  tenants,
  verticals,
} from "@/db/schema";
import { getAdminSession } from "@/server/auth";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/admin");
}

const cents = z.coerce.number().int().nonnegative();

export async function createVertical(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      slug: z.string().regex(/^[a-z0-9-]+$/),
      name: z.string().min(1),
      configuratorType: z.enum(["unit", "area", "linear", "custom"]),
      icon: z.string().optional(),
    })
    .safeParse({
      slug: String(formData.get("slug") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      configuratorType: String(formData.get("configuratorType") ?? "unit"),
      icon: String(formData.get("icon") ?? "").trim() || undefined,
    });
  if (!parsed.success) return;
  await adminDb.insert(verticals).values(parsed.data).onConflictDoNothing();
  revalidatePath("/admin/catalog");
}

export async function createProduct(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ verticalId: z.string().uuid(), name: z.string().min(1), brand: z.string().optional(), description: z.string().optional() })
    .safeParse({
      verticalId: String(formData.get("verticalId") ?? ""),
      name: String(formData.get("name") ?? "").trim(),
      brand: String(formData.get("brand") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || undefined,
    });
  if (!parsed.success) return;
  await adminDb.insert(products).values(parsed.data);
  revalidatePath("/admin/catalog");
}

export async function createVariant(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      productId: z.string().uuid(),
      sku: z.string().min(1),
      unitOfMeasure: z.string().min(1),
      wholesaleCents: cents,
      platformListCents: cents,
    })
    .safeParse({
      productId: String(formData.get("productId") ?? ""),
      sku: String(formData.get("sku") ?? "").trim(),
      unitOfMeasure: String(formData.get("unitOfMeasure") ?? "each").trim(),
      wholesaleCents: formData.get("wholesaleCents"),
      platformListCents: formData.get("platformListCents"),
    });
  if (!parsed.success) return;
  if (parsed.data.platformListCents < parsed.data.wholesaleCents) return; // list >= cost
  await adminDb.insert(productVariants).values(parsed.data).onConflictDoNothing();
  revalidatePath("/admin/catalog");
}

export async function createService(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      verticalId: z.string().uuid(),
      type: z.enum(["delivery", "labor", "haulaway"]),
      pricingModel: z.enum(["flat", "per_unit", "per_area", "quote"]),
      baseCents: cents,
      perUnitCents: cents,
    })
    .safeParse({
      verticalId: String(formData.get("verticalId") ?? ""),
      type: String(formData.get("type") ?? ""),
      pricingModel: String(formData.get("pricingModel") ?? ""),
      baseCents: formData.get("baseCents") ?? 0,
      perUnitCents: formData.get("perUnitCents") ?? 0,
    });
  if (!parsed.success) return;
  await adminDb.insert(services).values(parsed.data);
  revalidatePath("/admin/services");
}

export async function createZone(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({
      zip: z.string().regex(/^\d{3,5}$/),
      deliveryFeeCents: cents,
      laborMultiplierBps: z.coerce.number().int().positive(),
      leadTimeDays: z.coerce.number().int().nonnegative(),
    })
    .safeParse({
      zip: String(formData.get("zip") ?? "").trim(),
      deliveryFeeCents: formData.get("deliveryFeeCents") ?? 0,
      laborMultiplierBps: formData.get("laborMultiplierBps") ?? 10000,
      leadTimeDays: formData.get("leadTimeDays") ?? 7,
    });
  if (!parsed.success) return;
  await adminDb
    .insert(serviceZones)
    .values(parsed.data)
    .onConflictDoUpdate({ target: serviceZones.zip, set: parsed.data });
  revalidatePath("/admin/services");
}

export async function createTaxRule(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ zip: z.string().regex(/^\d{3,5}$/), rateBps: cents })
    .safeParse({ zip: String(formData.get("zip") ?? "").trim(), rateBps: formData.get("rateBps") ?? 0 });
  if (!parsed.success) return;
  await adminDb
    .insert(taxRules)
    .values(parsed.data)
    .onConflictDoUpdate({ target: taxRules.zip, set: { rateBps: parsed.data.rateBps } });
  revalidatePath("/admin/services");
}

export async function setTenantStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z
    .object({ tenantId: z.string().uuid(), status: z.enum(["pending", "active", "suspended"]) })
    .safeParse({ tenantId: String(formData.get("tenantId") ?? ""), status: String(formData.get("status") ?? "") });
  if (!parsed.success) return;
  await adminDb.update(tenants).set({ status: parsed.data.status, updatedAt: new Date() }).where(eq(tenants.id, parsed.data.tenantId));
  revalidatePath("/admin/tenants");
  revalidatePath(`/admin/tenants/${parsed.data.tenantId}`);
}
