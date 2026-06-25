/**
 * Reseller dashboard shell. Lives at /reseller/* on a tenant host. Shows nav only when the
 * visitor has a reseller session; the login page renders bare. Per-page guards enforce auth.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getResellerSession } from "@/server/auth";
import { signOut } from "@/server/auth-actions";

const NAV = [
  ["/reseller", "Overview"],
  ["/reseller/catalog", "Catalog & pricing"],
  ["/reseller/orders", "Orders"],
  ["/reseller/branding", "Branding"],
  ["/reseller/payouts", "Payouts"],
  ["/reseller/domain", "Domain"],
];

export default async function ResellerLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const session = await getResellerSession(tenant.id);

  if (!session) {
    return <div className="min-h-full bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex min-h-full flex-col bg-slate-50 md:flex-row">
      <aside className="border-b bg-white p-4 md:w-60 md:border-b-0 md:border-r">
        <div className="mb-4 font-semibold">{tenant.displayName}</div>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm hover:bg-slate-100">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-4">
          <button type="submit" className="text-sm text-slate-500 underline">
            Sign out ({session.email})
          </button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
