import "server-only";
/**
 * Server-side tenant resolution. Order:
 *  1. subdomain header (acme.example.com)
 *  2. verified custom-domain header (shop.acme.com)
 *  3. `rc_preview_tenant` cookie — single-domain preview, for when wildcard subdomains aren't
 *     available (e.g. *.vercel.app). Set via /preview/<slug>.
 * Cached per request.
 */
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { adminDb } from "@/db";
import { tenants } from "@/db/schema";

export type Tenant = typeof tenants.$inferSelect;

export const PREVIEW_COOKIE = "rc_preview_tenant";

export const getCurrentTenant = cache(async (): Promise<Tenant | null> => {
  const h = await headers();
  const subdomain = h.get("x-tenant-subdomain");
  const customDomain = h.get("x-tenant-custom-domain");

  if (subdomain) {
    const [t] = await adminDb.select().from(tenants).where(eq(tenants.slug, subdomain)).limit(1);
    if (t) return t;
  }

  if (customDomain) {
    const [t] = await adminDb
      .select()
      .from(tenants)
      .where(and(eq(tenants.customDomain, customDomain), eq(tenants.customDomainVerified, true)))
      .limit(1);
    if (t) return t;
  }

  // Single-domain preview fallback.
  const store = await cookies();
  const preview = store.get(PREVIEW_COOKIE)?.value;
  if (preview) {
    const [t] = await adminDb.select().from(tenants).where(eq(tenants.slug, preview)).limit(1);
    if (t) return t;
  }

  return null;
});
