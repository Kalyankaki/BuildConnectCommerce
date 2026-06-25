/**
 * Storefront layout. Resolves the active tenant from the host and applies its brand
 * tokens as CSS variables at the layout root, so the same code renders every reseller's
 * storefront with their own colors — no rebuild (B.3 dynamic branding).
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentTenant } from "@/server/tenant";

/** Per-tenant SEO: the reseller's brand in the title + description (B.12). */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { title: "RenovateConnect", description: "White-label renovation commerce." };
  }
  return {
    title: { default: tenant.displayName, template: `%s · ${tenant.displayName}` },
    description: `Full-service renovation from ${tenant.displayName} — parts, delivery, professional install, and haulaway in one transparent price.`,
  };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  // Brand tokens -> CSS variables. Falls back to platform defaults on the apex host.
  const brandVars = {
    "--brand-primary": tenant?.primaryColor ?? "#0f172a",
    "--brand-secondary": tenant?.secondaryColor ?? "#64748b",
  } as CSSProperties;

  return (
    <div style={brandVars} className="flex min-h-full flex-col">
      <header
        className="flex items-center justify-between px-6 py-4 text-white"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="h-7 w-7 rounded" />
          ) : (
            <span aria-hidden>🏠</span>
          )}
          {tenant?.displayName ?? "RenovateConnect"}
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm opacity-90 sm:inline">Parts · Delivery · Install · Haulaway</span>
          {tenant && (
            <Link href="/cart" className="text-sm font-medium underline-offset-2 hover:underline">
              Cart
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t px-6 py-4 text-sm text-slate-500">
        {tenant ? (
          <span>
            {tenant.displayName}
            {tenant.supportEmail ? ` · ${tenant.supportEmail}` : ""}
          </span>
        ) : (
          <span>RenovateConnect — white-label renovation commerce</span>
        )}
      </footer>
    </div>
  );
}
