import { notFound } from "next/navigation";
import { getCurrentTenant } from "@/server/tenant";
import { getInstallerSession } from "@/server/auth";
import { signOut } from "@/server/auth-actions";

export default async function InstallerLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getCurrentTenant();
  if (!tenant) notFound();
  const session = await getInstallerSession(tenant.id);

  if (!session) return <div className="min-h-full bg-slate-50">{children}</div>;

  return (
    <div className="min-h-full bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-4">
        <span className="font-semibold">{tenant.displayName} · Installer</span>
        <form action={signOut}>
          <button className="text-sm text-slate-500 underline">Sign out ({session.email})</button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
