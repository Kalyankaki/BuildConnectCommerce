/**
 * Storefront + marketing layout. Resolves the active tenant and applies its brand tokens as
 * CSS variables. Header adapts: marketing nav on the apex host, store nav on a tenant host.
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Hammer, Phone, ShoppingCart } from "lucide-react";
import { getCurrentTenant } from "@/server/tenant";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  if (!tenant) {
    return { title: "RenovateConnect — Renovation materials, fully installed", description: "White-label renovation commerce." };
  }
  return {
    title: { default: tenant.displayName, template: `%s · ${tenant.displayName}` },
    description: `Full-service renovation from ${tenant.displayName} — parts, delivery, professional install, and haulaway in one transparent price.`,
  };
}

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();

  const brandVars = {
    "--brand-primary": tenant?.primaryColor ?? "#0f172a",
    "--brand-secondary": tenant?.secondaryColor ?? "#475569",
  } as CSSProperties;

  return (
    <div style={brandVars} className="flex min-h-full flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: tenant ? "var(--brand-primary)" : "#0f172a" }}
            >
              {tenant?.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <Hammer className="h-5 w-5" strokeWidth={2.5} />
              )}
            </span>
            <span className="font-display text-lg font-bold tracking-tight">
              {tenant?.displayName ?? "RenovateConnect"}
            </span>
          </Link>

          {tenant ? (
            <div className="flex items-center gap-5">
              {tenant.supportPhone && (
                <a href={`tel:${tenant.supportPhone}`} className="hidden items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 sm:flex">
                  <Phone className="h-4 w-4" /> {tenant.supportPhone}
                </a>
              )}
              <Link
                href="/cart"
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-medium hover:border-slate-400 hover:bg-slate-50"
              >
                <ShoppingCart className="h-4 w-4" /> Cart
              </Link>
            </div>
          ) : (
            <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="/#how" className="hidden hover:text-slate-900 sm:inline">How it works</a>
              <a href="/#verticals" className="hidden hover:text-slate-900 sm:inline">What we install</a>
              <Link
                href="/onboarding"
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-400"
              >
                Start your storefront
              </Link>
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-white">
              <Hammer className="h-5 w-5" strokeWidth={2.5} />
              <span className="font-display text-lg font-bold">{tenant?.displayName ?? "RenovateConnect"}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm">
              Full-service renovation materials — parts, delivery, professional install, and
              haulaway of your old fixtures, in one transparent price.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Service</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>Parts &amp; materials</li>
              <li>Delivery</li>
              <li>Professional install</li>
              <li>Old-fixture haulaway</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Contact</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {tenant?.supportEmail && <li>{tenant.supportEmail}</li>}
              {tenant?.supportPhone && <li>{tenant.supportPhone}</li>}
              {!tenant && <li>Powered by RenovateConnect</li>}
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
          © {tenant?.displayName ?? "RenovateConnect"} · Renovation materials, fully installed.
        </div>
      </footer>
    </div>
  );
}
