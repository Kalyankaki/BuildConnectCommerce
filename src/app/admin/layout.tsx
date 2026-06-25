/**
 * Platform admin shell (apex host). Nav shows only with a platform_admin session; the login
 * page renders bare. Per-page guards (adminContextOrRedirect) enforce auth.
 */
import Link from "next/link";
import { getAdminSession } from "@/server/auth";
import { signOut } from "@/server/auth-actions";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/catalog", "Master catalog"],
  ["/admin/services", "Services & zones"],
  ["/admin/tenants", "Tenants"],
  ["/admin/installers", "Installers"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) return <div className="min-h-full bg-slate-50">{children}</div>;

  return (
    <div className="flex min-h-full flex-col bg-slate-50 md:flex-row">
      <aside className="border-b bg-slate-900 p-4 text-slate-100 md:w-60 md:border-b-0">
        <div className="mb-4 font-semibold">RenovateConnect · Admin</div>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm hover:bg-slate-700">
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-4">
          <button className="text-sm text-slate-400 underline">Sign out</button>
        </form>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
