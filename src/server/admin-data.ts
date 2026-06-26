import "server-only";
/**
 * Platform-admin reads. All via the admin (service-role) connection — admin paths
 * deliberately bypass RLS to see across every tenant (B.2).
 */
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { adminDb } from "@/db";
import {
  markupPolicies,
  memberships,
  orders,
  productVariants,
  products,
  profiles,
  serviceZones,
  services,
  taxRules,
  tenants,
  verticals,
} from "@/db/schema";
import { getAdminSession, isAuthConfigured, type Session } from "@/server/auth";

export async function adminContextOrRedirect(): Promise<Session> {
  const session = await getAdminSession();
  if (session) return session;
  // Demo mode: when Supabase auth isn't configured, allow admin access.
  if (!isAuthConfigured()) {
    return { profileId: "demo", email: "demo@local", isPlatformAdmin: true, role: "platform_admin", tenantId: null };
  }
  redirect("/login?next=/admin");
}

export async function listAdminProfiles() {
  return adminDb
    .select({ id: profiles.id, email: profiles.email, name: profiles.fullName })
    .from(profiles)
    .where(eq(profiles.isPlatformAdmin, true));
}

export interface GlobalReport {
  tenantCount: number;
  orderCount: number;
  grossRevenueCents: number;
  platformFeesCents: number;
  resellerPayoutsCents: number;
  byStatus: Record<string, number>;
}

export async function getGlobalReport(): Promise<GlobalReport> {
  const [allTenants, allOrders] = await Promise.all([
    adminDb.select({ id: tenants.id }).from(tenants),
    adminDb
      .select({
        status: orders.status,
        totalCents: orders.totalCents,
        platformMarginCents: orders.platformMarginCents,
        depositPaid: orders.depositPaid,
      })
      .from(orders),
  ]);

  const report: GlobalReport = {
    tenantCount: allTenants.length,
    orderCount: allOrders.length,
    grossRevenueCents: 0,
    platformFeesCents: 0,
    resellerPayoutsCents: 0,
    byStatus: {},
  };
  for (const o of allOrders) {
    report.byStatus[o.status] = (report.byStatus[o.status] ?? 0) + 1;
    if (o.depositPaid) {
      report.grossRevenueCents += o.totalCents;
      report.platformFeesCents += o.platformMarginCents;
      report.resellerPayoutsCents += o.totalCents - o.platformMarginCents;
    }
  }
  return report;
}

export async function listTenants() {
  return adminDb.select().from(tenants).orderBy(desc(tenants.createdAt));
}

export async function getTenantById(id: string) {
  const [t] = await adminDb.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return t ?? null;
}

export async function listMasterCatalog() {
  const rows = await adminDb
    .select({ vertical: verticals, product: products, variant: productVariants })
    .from(verticals)
    .leftJoin(products, eq(products.verticalId, verticals.id))
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .orderBy(verticals.name);
  return rows;
}

export async function listVerticalsAdmin() {
  return adminDb.select().from(verticals).orderBy(verticals.name);
}

export async function listProductsAdmin() {
  return adminDb.select().from(products).orderBy(products.name);
}

export async function listServicesAdmin() {
  return adminDb
    .select({ service: services, verticalName: verticals.name })
    .from(services)
    .leftJoin(verticals, eq(services.verticalId, verticals.id));
}

export async function listZonesAdmin() {
  return adminDb.select().from(serviceZones).orderBy(serviceZones.zip);
}

export async function listTaxRulesAdmin() {
  return adminDb.select().from(taxRules).orderBy(taxRules.zip);
}

export async function listInstallersAdmin() {
  return adminDb
    .select({
      profileId: profiles.id,
      name: profiles.fullName,
      email: profiles.email,
      coverageZips: memberships.coverageZips,
      tenantName: tenants.displayName,
    })
    .from(memberships)
    .innerJoin(profiles, eq(profiles.id, memberships.userId))
    .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
    .where(eq(memberships.role, "installer"));
}

/** D1 export: build a standalone-storefront config payload for a tenant. */
export async function getTenantExport(id: string) {
  const tenant = await getTenantById(id);
  if (!tenant) return null;
  const policy = tenant.defaultMarkupPolicyId
    ? (await adminDb.select().from(markupPolicies).where(eq(markupPolicies.id, tenant.defaultMarkupPolicyId)).limit(1))[0]
    : null;
  const catalogCount = (
    await adminDb.select({ id: verticals.id }).from(verticals)
  ).length;

  return {
    generatedFor: tenant.slug,
    tenant: {
      slug: tenant.slug,
      displayName: tenant.displayName,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      coverageZips: tenant.coverageZips,
      customDomain: tenant.customDomain,
    },
    markupPolicy: policy
      ? { defaultMarkupBps: policy.defaultMarkupBps, perVertical: policy.perVertical }
      : null,
    verticalsAvailable: catalogCount,
    envTemplate: [
      "DATABASE_URL=",
      "APP_DATABASE_URL=",
      "STRIPE_SECRET_KEY=",
      "NEXT_PUBLIC_ROOT_DOMAIN=",
    ],
    note: "Standalone repo generation is a follow-up; this payload pre-seeds one tenant's config.",
  };
}
