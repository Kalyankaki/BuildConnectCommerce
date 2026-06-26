/**
 * Proxy (Next 16). Two jobs:
 *  1. Resolve the tenant from the host → request headers (x-tenant-subdomain / -custom-domain).
 *  2. Refresh the Supabase auth session cookies (only when Supabase is configured).
 * Kept lightweight; the tenant DB lookup + RLS scoping happen server-side.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();

export async function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const hostname = host.split(":")[0];
  const rootHostname = ROOT_DOMAIN.split(":")[0];

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-host", host);
  requestHeaders.delete("x-tenant-subdomain");
  requestHeaders.delete("x-tenant-custom-domain");

  if (hostname === rootHostname || hostname === `www.${rootHostname}`) {
    // Apex / platform host — no tenant.
  } else if (hostname.endsWith(`.${rootHostname}`)) {
    const subdomain = hostname.slice(0, hostname.length - rootHostname.length - 1);
    if (subdomain && subdomain !== "www") requestHeaders.set("x-tenant-subdomain", subdomain);
  } else if (hostname && hostname !== "localhost") {
    requestHeaders.set("x-tenant-custom-domain", hostname);
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Refresh Supabase auth session (no-op until Supabase keys are set).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getUser();
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
