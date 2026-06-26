/**
 * Proxy (Next 16). Resolves the tenant and refreshes the Supabase session.
 *
 * Tenant resolution, in order:
 *  - Path-based: /store/<slug>/... → tenant = <slug>, rewritten internally to the root route
 *    so one domain hosts every store (works on *.vercel.app, no DNS). Sets x-tenant-base so
 *    the storefront can prefix its links.
 *  - Host-based: subdomain / custom domain (for real domains in production).
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
  requestHeaders.delete("x-tenant-base");

  const url = request.nextUrl.clone();
  const storeMatch = url.pathname.match(/^\/store\/([a-z0-9-]+)(\/.*)?$/);
  let rewritten = false;

  if (storeMatch) {
    // Path-based store: /store/<slug>/rest -> tenant=<slug>, render /rest.
    requestHeaders.set("x-tenant-subdomain", storeMatch[1]);
    requestHeaders.set("x-tenant-base", `/store/${storeMatch[1]}`);
    url.pathname = storeMatch[2] || "/";
    rewritten = true;
  } else if (hostname === rootHostname || hostname === `www.${rootHostname}`) {
    // Apex / platform host — no tenant.
  } else if (hostname.endsWith(`.${rootHostname}`)) {
    const subdomain = hostname.slice(0, hostname.length - rootHostname.length - 1);
    if (subdomain && subdomain !== "www") requestHeaders.set("x-tenant-subdomain", subdomain);
  } else if (hostname && hostname !== "localhost") {
    requestHeaders.set("x-tenant-custom-domain", hostname);
  }

  const makeResponse = () =>
    rewritten
      ? NextResponse.rewrite(url, { request: { headers: requestHeaders } })
      : NextResponse.next({ request: { headers: requestHeaders } });

  let response = makeResponse();

  // Refresh Supabase auth session (no-op until Supabase keys are set).
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (sbUrl && sbKey) {
    const supabase = createServerClient(sbUrl, sbKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = makeResponse();
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
