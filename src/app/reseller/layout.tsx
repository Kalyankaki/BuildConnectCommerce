/**
 * Reseller dashboard shell at /reseller/*. Nav shows only with a reseller session; per-page
 * guards enforce auth.
 */
import Link from "next/link";
import { Hammer, LayoutGrid, Package, ClipboardList, Palette, Wallet, Globe } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getResellerSession } from "@/server/auth";
import { signOut } from "@/server/auth-actions";

const NAV: [string, string, React.ComponentType<{ className?: string }>][] = [
  ["/reseller", "Overview", LayoutGrid],
  ["/reseller/catalog", "Catalog & pricing", Package],
  ["/reseller/orders", "Orders", ClipboardList],
  ["/reseller/branding", "Branding", Palette],
  ["/reseller/payouts", "Payouts", Wallet],
  ["/reseller/domain", "Domain", Globe],
];

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const session = await getResellerSession(tenant.id);
  const demo = !session;

  if (!session && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Auth configured but not a reseller → render bare (page guard redirects to /login).
    return <div className="min-h-full bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 md:flex-row">
      <aside className="shrink-0 border-b border-slate-200 bg-white p-5 md:w-64 md:border-b-0 md:border-r">
        <Link href="/reseller" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ backgroundColor: tenant.primaryColor }}>
            <Hammer className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="font-display text-base font-bold leading-tight">{tenant.displayName}</span>
        </Link>
        <p className="mt-1 pl-12 text-xs uppercase tracking-wide text-slate-400">Reseller</p>

        <nav className="mt-6 flex flex-wrap gap-1 md:flex-col">
          {NAV.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>

        <form action={signOut} className="mt-6 border-t border-slate-100 pt-4">
          <button type="submit" className="text-xs text-slate-500 hover:text-slate-900">
            {demo ? "Demo mode" : `Sign out · ${session.email}`}
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6 sm:p-8">{children}</main>
    </div>
  );
}
