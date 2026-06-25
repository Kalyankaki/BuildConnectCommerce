import "server-only";
/**
 * Server-side tenant resolution. Reads the identity headers set by src/proxy.ts and
 * looks up the tenant in the global `tenants` registry (admin connection — the registry
 * is platform data, not tenant-scoped). Cached per request via React `cache`.
 */
import { cache } from "react";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { tenants } from "@/db/schema";

export type Tenant = typeof tenants.$inferSelect;

export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const h = await headers();
  const subdomain = h.get("x-tenant-subdomain");
  const customDomain = h.get("x-tenant-custom-domain");

  if (subdomain) {
    const [t] = await adminDb
      .select()
      .from(tenants)
      .where(eq(tenants.slug, subdomain))
      .limit(1);
    return t ?? null;
  }

  if (customDomain) {
    const [t] = await adminDb
      .select()
      .from(tenants)
      .where(and(eq(tenants.customDomain, customDomain), eq(tenants.customDomainVerified, true)))
      .limit(1);
    return t ?? null;
  }

  return null; // apex / platform host
});
