/**
 * Proxy (Next 16 — formerly `middleware.ts`).
 *
 * Resolves the tenant *identity* from the request host and forwards it to the app via
 * request headers. Kept intentionally lightweight (no DB) — per the Next 16 proxy docs,
 * proxy may run at the edge and must not rely on shared modules/globals. The actual
 * tenant DB lookup + RLS scoping happens server-side (see src/server/tenant.ts).
 *
 *   acme.renovateconnect.app          -> x-tenant-subdomain: acme
 *   shop.acmeremodel.com (custom)     -> x-tenant-custom-domain: shop.acmeremodel.com
 *   renovateconnect.app (apex)        -> no tenant headers (platform/admin host)
 */
import { NextResponse, type NextRequest } from "next/server";

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];

  const headers = new Headers(request.headers);
  headers.set("x-host", host);
  // Clear any client-supplied spoofs of our trusted headers.
  headers.delete("x-tenant-subdomain");
  headers.delete("x-tenant-custom-domain");

  if (hostname === rootHostname || hostname === `www.${rootHostname}`) {
    // Apex / platform host — no tenant.
  } else if (hostname.endsWith(`.${rootHostname}`)) {
    const subdomain = hostname.slice(0, hostname.length - rootHostname.length - 1);
    if (subdomain && subdomain !== "www") headers.set("x-tenant-subdomain", subdomain);
  } else if (hostname && hostname !== "localhost") {
    headers.set("x-tenant-custom-domain", hostname);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Run on everything except static assets and metadata files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
